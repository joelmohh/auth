document.addEventListener('DOMContentLoaded', async () => {
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const page = document.body.dataset.page;

    const CDN_PRIMARY = 'https://blob.squarecloud.dev/pub';
    const CDN_FALLBACK = 'https://cdn.hackclub.com';

    function assetSources(value) {
        if (!value || typeof value !== 'string') return [];
        if (/^https?:\/\//i.test(value)) {
            if (value.startsWith(CDN_PRIMARY)) return [value, CDN_FALLBACK + value.slice(CDN_PRIMARY.length)];
            if (value.startsWith(CDN_FALLBACK)) return [CDN_PRIMARY + value.slice(CDN_FALLBACK.length), value];
            return [value];
        }
        const key = value.replace(/^\/+/, '');
        return [`${CDN_PRIMARY}/${key}`, `${CDN_FALLBACK}/${key}`];
    }

    function firstReachable(sources) {
        return new Promise((resolve) => {
            if (!sources.length) return resolve(null);
            const probe = new Image();
            probe.onload = () => resolve(sources[0]);
            probe.onerror = () => resolve(firstReachable(sources.slice(1)));
            probe.src = sources[0];
        });
    }

    async function applyBanner(el, value) {
        const url = await firstReachable(assetSources(value));
        if (url) el.style.backgroundImage = `url("${url}")`;
    }

    function fillAvatar(el, name, urlValue) {
        const initials = (name || '?').trim().slice(0, 2).toUpperCase();
        const sources = assetSources(urlValue);
        el.textContent = initials;
        if (!sources.length) return;
        const img = document.createElement('img');
        img.alt = '';
        let i = 0;
        img.addEventListener('error', () => {
            i += 1;
            if (i < sources.length) img.src = sources[i];
        });
        img.addEventListener('load', () => { el.textContent = ''; el.append(img); });
        img.src = sources[0];
    }

    $$('[data-logout]').forEach((b) => b.addEventListener('click', async () => {
        await Api.post('/api/auth/logout', null, false);
        location.href = '/';
    }));

    const [me, appsRes] = await Promise.all([Api.get('/api/me'), Api.get('/api/apps')]);
    const user = me.data || {};
    const label = user.profile?.displayName || user.username || '';
    $$('[data-user-name]').forEach((e) => (e.textContent = user.username || ''));
    $$('[data-user-initials]').forEach((e) => fillAvatar(e, label, user.profile?.avatarUrl));
    if (!appsRes.success) showToast(appsRes.message || 'Could not load your apps.', 'error');
    const apps = appsRes.data || [];

    const urlAppId = location.pathname.match(/\/apps\/([a-f0-9]{24})/)?.[1];
    const currentId = urlAppId || localStorage.getItem('appId') || apps[0]?._id;
    $$('[data-app-select]').forEach((sel) => {
        apps.forEach((a) => sel.add(new Option(a.name, a._id, false, a._id === currentId)));
        if (!apps.length) sel.add(new Option('No apps yet', ''));
        sel.addEventListener('change', () => {
            localStorage.setItem('appId', sel.value);
            if (sel.value) location.href = `/dashboard/apps/${sel.value}`;
        });
    });
    $$('[data-app-link]').forEach((a) => {
        if (currentId) {
            const sub = a.dataset.appLink;
            a.href = sub ? `/dashboard/apps/${currentId}/${sub}` : `/dashboard/apps/${currentId}`;
        } else {
            a.setAttribute('aria-disabled', 'true');
        }
    });
    $$('.nav-link').forEach((a) => {
        const active = a.pathname === location.pathname;
        a.classList.toggle('active', active);
        if (active) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
    });

    const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '–');

    function makeDatepicker(el, { min = null, max = null, inline = false } = {}) {
        if (!window.bootstrap?.Datepicker) return null;
        const options = { datepickerTheme: 'dark' };
        if (min) options.dateMin = min;
        if (max) options.dateMax = max;
        if (inline) options.inline = true;
        return new bootstrap.Datepicker(el, options);
    }

    if (page === 'dashboard') {
        const set = (k, v) => $$(`[data-stat=${k}]`).forEach((e) => (e.textContent = v));
        set('apps', apps.length);
        set('active', apps.filter((a) => a.status === 'active').length);
        set('providers', apps.reduce((n, a) => n + (a.providers || []).filter((p) => p.enabled).length, 0));
    }

    if (page === 'apps') {
        const PER = 6;
        const grid = $('#appGrid'), pager = $('#pager'), empty = $('#empty');
        const st = { q: '', status: '', sort: 'az', page: 1 };

        function render() {
            let list = apps.filter((a) =>
                a.name.toLowerCase().includes(st.q) && (!st.status || a.status === st.status));
            list.sort((a, b) => a.name.localeCompare(b.name) * (st.sort === 'az' ? 1 : -1));

            const pages = Math.max(1, Math.ceil(list.length / PER));
            st.page = Math.min(st.page, pages);
            const slice = list.slice((st.page - 1) * PER, st.page * PER);

            grid.replaceChildren(...slice.map((a) => {
                const el = $('#appTpl').content.cloneNode(true);
                $('[data-name]', el).textContent = a.name;
                const badge = $('[data-status]', el);
                badge.textContent = a.status;
                badge.classList.add(a.status === 'active' ? 'badge-success' : 'badge-danger');
                fillAvatar($('.app-avatar', el), a.name, a.theme?.logoUrl);
                if (a.theme?.bannerUrl) applyBanner($('.app-banner', el), a.theme.bannerUrl);
                const link = $('[data-select]', el);
                link.href = `/dashboard/apps/${a._id}`;
                link.addEventListener('click', () => localStorage.setItem('appId', a._id));
                return el;
            }));
            empty.classList.toggle('d-none', list.length > 0);

            const btn = (text, p, { active = false, disabled = false } = {}) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = text;
                b.disabled = disabled;
                b.className = `btn btn-sm ${active ? 'theme-brand btn-solid' : 'btn-text'}`;
                b.addEventListener('click', () => { st.page = p; render(); });
                return b;
            };
            pager.replaceChildren(
                ...(pages > 1 ? [
                    btn('Previous', st.page - 1, { disabled: st.page === 1 }),
                    ...Array.from({ length: pages }, (_, i) => btn(i + 1, i + 1, { active: i + 1 === st.page })),
                    btn('Next', st.page + 1, { disabled: st.page === pages })
                ] : []));
        }

        $('#search').addEventListener('input', (e) => { st.q = e.target.value.trim().toLowerCase(); st.page = 1; render(); });
        $('#statusFilter').addEventListener('change', (e) => { st.status = e.target.value; st.page = 1; render(); });
        $('#sortBy').addEventListener('change', (e) => { st.sort = e.target.value; render(); });
        render();

        const dlg = $('#newAppDialog'), form = $('#newAppForm');
        $('#newAppBtn').addEventListener('click', () => {
            form.reset(); form.classList.remove('d-none'); $('#secretView').classList.add('d-none'); dlg.showModal();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!Validate.group(form)) return;
            const btn = $('[type=submit]', form);
            btn.disabled = true;
            const r = await Api.post('/api/apps', {
                name: form.elements.name.value.trim(),
                description: form.elements.description.value.trim()
            });
            btn.disabled = false;
            if (!r.success) return showToast(r.message, 'error');

            apps.push(r.data);
            render();
            $('#clientId').value = r.data.clientId;
            $('#clientSecret').value = r.data.clientSecret || '';
            form.classList.add('d-none');
            $('#secretView').classList.remove('d-none');
        });

        $('#copySecret').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText($('#clientSecret').value); showToast('Secret copied.', 'success'); }
            catch { showToast('Could not copy. Select and copy it manually.', 'warning'); }
        });
    }

    if (page === 'app') {
        const r = await Api.get(`/api/apps/${urlAppId}`);
        const main = $('#appMain');
        if (!r.success) {
            main.replaceChildren(Object.assign(document.createElement('p'), { className: 'text-secondary', textContent: r.message || 'App not found.' }));
            return;
        }
        const a = r.data;
        localStorage.setItem('appId', a._id);
        const el = $('#appTpl').content.cloneNode(true);
        fillAvatar($('[data-avatar]', el), a.name, a.theme?.logoUrl);
        if (a.theme?.bannerUrl) applyBanner($('[data-banner]', el), a.theme.bannerUrl);
        $('[data-name]', el).textContent = a.name;
        $('[data-description]', el).textContent = a.description || 'No description';
        const badge = $('[data-status]', el);
        badge.textContent = a.status;
        badge.classList.add(a.status === 'active' ? 'badge-success' : 'badge-danger');
        $('[data-client-id]', el).value = a.clientId;
        $('[data-scopes]', el).textContent = a.scopes?.length ? a.scopes.join(', ') : 'none';
        $('[data-redirects]', el).textContent = a.redirectUrls?.length ? a.redirectUrls.join(', ') : 'none';
        $('[data-created]', el).textContent = fmtDate(a.createdAt);
        $$('[data-link-users]', el).forEach((x) => (x.href = `/dashboard/apps/${a._id}/users`));
        $$('[data-link-settings]', el).forEach((x) => (x.href = `/dashboard/apps/${a._id}/settings`));
        main.replaceChildren(el);
        $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText($(`#${b.dataset.copy}`).value); showToast('Copied.', 'success'); }
            catch { showToast('Could not copy. Select and copy it manually.', 'warning'); }
        }));
    }

    if (page === 'appUsers') {
        const body = $('#usersBody'), empty = $('#emptyUsers');
        const card = body.closest('.card');
        const banDialog = $('#banDialog');
        const banPicker = makeDatepicker($('#banPicker'), { min: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), inline: true });
        let pendingBan = null;

        function userRow({ user, scopes }) {
            const tr = document.createElement('tr');
            const name = user.username || user.email || user.id;
            const detail = user.email && user.username ? user.email : '';

            const cell = document.createElement('td');
            const wrap = document.createElement('div');
            wrap.className = 'user-cell';
            const avatar = document.createElement('span');
            avatar.className = 'avatar';
            fillAvatar(avatar, user.profile?.displayName || name, user.profile?.avatarUrl);
            const who = document.createElement('div');
            const nameEl = document.createElement('div');
            nameEl.className = 'user-name';
            nameEl.textContent = user.profile?.displayName || name;
            who.append(nameEl);
            if (detail) {
                const mail = document.createElement('div');
                mail.className = 'user-email';
                mail.textContent = detail;
                who.append(mail);
            } else if (user.profile?.displayName && user.username) {
                const handle = document.createElement('div');
                handle.className = 'user-email';
                handle.textContent = `@${user.username}`;
                who.append(handle);
            }
            wrap.append(avatar, who);
            cell.append(wrap);

            const scopeCell = document.createElement('td');
            const list = (scopes || []).filter(Boolean);
            if (list.length) {
                list.forEach((s) => {
                    const chip = document.createElement('span');
                    chip.className = 'scope-badge';
                    chip.textContent = s;
                    scopeCell.append(chip);
                });
            } else {
                const none = document.createElement('span');
                none.className = 'form-text';
                none.textContent = '—';
                scopeCell.append(none);
            }

            const actions = document.createElement('td');
            actions.className = 'text-end';
            const revokeBtn = document.createElement('button');
            revokeBtn.type = 'button';
            revokeBtn.className = 'btn btn-text btn-sm';
            revokeBtn.innerHTML = '<i class="fa-solid fa-user-minus" aria-hidden="true"></i> Revoke';
            revokeBtn.addEventListener('click', async () => {
                revokeBtn.disabled = true;
                const rr = await send('DELETE', `/api/apps/${urlAppId}/users/${user.id}`);
                showToast(rr.message, rr.success ? 'success' : 'error');
                load();
            });
            const banBtn = document.createElement('button');
            banBtn.type = 'button';
            banBtn.className = 'btn btn-text theme-danger btn-sm';
            banBtn.innerHTML = '<i class="fa-solid fa-gavel" aria-hidden="true"></i> Ban';
            banBtn.addEventListener('click', () => {
                pendingBan = { id: user.id, name };
                $('[data-ban-name]', banDialog).textContent = name;
                banPicker?.setSelectedDates([]);
                banDialog.showModal();
            });
            actions.append(revokeBtn, banBtn);

            tr.append(cell, scopeCell, actions);
            return tr;
        }

        async function load() {
            const r = await Api.get(`/api/apps/${urlAppId}/users`);
            const rows = r.data || [];
            empty.classList.toggle('d-none', rows.length > 0);
            card.querySelector('.table-wrap').classList.toggle('d-none', rows.length === 0);
            body.replaceChildren(...rows.map(userRow));
        }

        $('#confirmBan').addEventListener('click', async (e) => {
            if (!pendingBan) return;
            const btn = e.currentTarget;
            btn.disabled = true;
            const until = banPicker?.getSelectedDates?.()[0];
            const rr = await send('POST', `/api/apps/${urlAppId}/users/${pendingBan.id}/ban`, until ? { bannedUntil: until } : {});
            btn.disabled = false;
            if (rr.success) banDialog.close();
            showToast(rr.message, rr.success ? 'success' : 'error');
            load();
        });

        const appInfo = await Api.get(`/api/apps/${urlAppId}`);
        if (appInfo.success) $$('[data-app-name]').forEach((e) => (e.textContent = appInfo.data.name));
        load();
    }

    if (page === 'appSettings') {
        const ALL_SCOPES = ['username', 'email', 'profile', 'phone', 'address', 'birthDate'];
        const r = await Api.get(`/api/apps/${urlAppId}`);
        if (!r.success) { showToast(r.message || 'App not found.', 'error'); return; }
        const app = r.data;
        localStorage.setItem('appId', app._id);
        $$('[data-app-name]').forEach((e) => (e.textContent = app.name));

        $('#sName').value = app.name || '';
        $('#sDesc').value = app.description || '';
        $('#sStatus').value = app.status || 'active';
        $('#sRedirects').value = (app.redirectUrls || []).join('\n');
        $('#sColor').value = /^#[0-9a-f]{6}$/i.test(app.theme?.primaryColor || '') ? app.theme.primaryColor : '#f2b23e';
        $('#sDark').checked = app.theme?.darkMode !== false;

        $('#scopeChecks').replaceChildren(...ALL_SCOPES.map((s) => {
            const wrap = document.createElement('div');
            wrap.className = 'form-field';
            const cb = Object.assign(document.createElement('input'), { type: 'checkbox', className: 'check', id: `scope-${s}`, value: s });
            cb.checked = (app.scopes || []).includes(s);
            const content = document.createElement('div');
            content.className = 'form-field-content';
            const lab = Object.assign(document.createElement('label'), { htmlFor: `scope-${s}`, textContent: s });
            content.append(lab);
            wrap.append(cb, content);
            return wrap;
        }));

        $('#generalForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!Validate.group(e.target)) return;
            const rr = await send('PATCH', `/api/apps/${urlAppId}`, {
                name: $('#sName').value.trim(),
                description: $('#sDesc').value.trim(),
                status: $('#sStatus').value
            });
            showToast(rr.message, rr.success ? 'success' : 'error');
        });

        $('#redirectsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const redirectUrls = $('#sRedirects').value.split('\n').map((x) => x.trim()).filter(Boolean);
            const rr = await send('PUT', `/api/apps/${urlAppId}/redirects`, { redirectUrls });
            showToast(rr.message, rr.success ? 'success' : 'error');
        });

        $('#scopesForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const scopes = ALL_SCOPES.filter((s) => $(`#scope-${s}`).checked);
            const rr = await send('PUT', `/api/apps/${urlAppId}/scopes`, { scopes });
            showToast(rr.message, rr.success ? 'success' : 'error');
        });

        $('#appearanceForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const rr = await send('PATCH', `/api/apps/${urlAppId}/appearance`, {
                primaryColor: $('#sColor').value,
                darkMode: $('#sDark').checked
            });
            showToast(rr.message, rr.success ? 'success' : 'error');
        });

        $('#rotateBtn').addEventListener('click', async () => {
            if (!confirm('Rotate the client secret? The current one stops working immediately.')) return;
            const rr = await Api.post(`/api/apps/${urlAppId}/secret/rotate`, {});
            if (!rr.success) return showToast(rr.message, 'error');
            $('#newSecret').value = rr.data || '';
            $('#secretDialog').showModal();
        });
        $('#copyNewSecret').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText($('#newSecret').value); showToast('Secret copied.', 'success'); }
            catch { showToast('Could not copy. Select and copy it manually.', 'warning'); }
        });

        const delDialog = $('#deleteDialog'), delInput = $('#deleteConfirm'), delBtn = $('#confirmDelete');
        $('#deleteBtn').addEventListener('click', () => { delInput.value = ''; delBtn.disabled = true; delDialog.showModal(); });
        delInput.addEventListener('input', () => { delBtn.disabled = delInput.value.trim() !== app.name; });
        delBtn.addEventListener('click', async () => {
            const rr = await send('DELETE', `/api/apps/${urlAppId}`);
            if (!rr.success) return showToast(rr.message, 'error');
            localStorage.removeItem('appId');
            location.href = '/dashboard/apps?message=' + encodeURIComponent('App deleted.') + '&t=success';
        });
    }

    if (page === 'account') {
        $$('[data-user-email]').forEach((e) => (e.textContent = user.email || ''));
        $$('[data-user-verified]').forEach((e) => (e.textContent = user.emailVerified ? 'verified' : 'unverified'));
        $('#pDisplayName').value = user.profile?.displayName || '';
        $('#pBio').value = user.profile?.bio || '';
        $('#pPhone').value = user.phone || '';
        const birthPicker = makeDatepicker($('#pBirthDate'), { min: '1900-01-01', max: new Date().toISOString().slice(0, 10) });
        if (user.birthDate) birthPicker?.setSelectedDates([String(user.birthDate).slice(0, 10)]);

        $('#profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                profile: {
                    displayName: $('#pDisplayName').value.trim() || undefined,
                    bio: $('#pBio').value.trim() || undefined
                },
                phone: $('#pPhone').value.trim() || undefined,
                birthDate: birthPicker?.getSelectedDates?.()[0] || undefined
            };
            const rr = await send('PATCH', '/api/me', body);
            showToast(rr.message, rr.success ? 'success' : 'error');
        });

        const sessionsList = $('#sessionsList');
        const sessRes = await Api.get('/api/me/sessions');
        const sessions = (sessRes.data || []).filter((s) => !s.appId);
        sessionsList.replaceChildren(...(sessions.length ? sessions : []).map((s) => {
            const li = document.createElement('li');
            li.className = 'd-flex align-items-center justify-content-between gap-3';
            const info = document.createElement('span');
            info.className = 'form-text';
            info.textContent = `${(s.userAgent || 'Unknown device').slice(0, 60)} · since ${fmtDate(s.createdAt)}`;
            const btn = Object.assign(document.createElement('button'), { className: 'btn btn-text theme-danger btn-sm', type: 'button', textContent: 'Revoke' });
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                const rr = await send('DELETE', `/api/me/sessions/${s._id}`);
                showToast(rr.message, rr.success ? 'success' : 'error');
                if (rr.success) li.remove();
            });
            li.append(info, btn);
            return li;
        }));
        if (!sessions.length) sessionsList.innerHTML = '<li class="text-secondary">No active sessions found.</li>';

        const authzList = $('#authzList');
        const authz = await Api.get('/api/me/authorizations');
        const grants = authz.data || [];
        authzList.replaceChildren(...grants.map((g) => {
            const li = document.createElement('li');
            li.className = 'd-flex align-items-center justify-content-between gap-3';
            const info = document.createElement('span');
            info.className = 'form-text';
            info.textContent = `${g.app?.name || 'Unknown app'} · ${(g.scopes || []).join(', ') || 'no scopes'}`;
            const btn = Object.assign(document.createElement('button'), { className: 'btn btn-text theme-danger btn-sm', type: 'button', textContent: 'Revoke' });
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                const rr = await send('DELETE', `/api/me/authorizations/${g.appId}`);
                showToast(rr.message, rr.success ? 'success' : 'error');
                if (rr.success) li.remove();
            });
            li.append(info, btn);
            return li;
        }));
        if (!grants.length) authzList.innerHTML = '<li class="text-secondary">You have not authorized any apps yet.</li>';

        $('#exportBtn').addEventListener('click', async () => {
            const rr = await Api.get('/api/me/export');
            if (!rr.success) return showToast(rr.message, 'error');
            const blob = new Blob([JSON.stringify(rr.data, null, 2)], { type: 'application/json' });
            const a = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(blob),
                download: 'my-data.json'
            });
            a.click();
            URL.revokeObjectURL(a.href);
        });

        const dlg = $('#deleteAccountDialog'), input = $('#deleteAccountConfirm'), btn = $('#confirmDeleteAccount');
        $('#deleteAccountBtn').addEventListener('click', () => { input.value = ''; btn.disabled = true; dlg.showModal(); });
        input.addEventListener('input', () => { btn.disabled = input.value.trim() !== 'DELETE'; });
        btn.addEventListener('click', async () => {
            const rr = await send('DELETE', '/api/me');
            if (!rr.success) return showToast(rr.message, 'error');
            await Api.post('/api/auth/logout', null, false);
            location.href = '/?message=' + encodeURIComponent('Your account was deleted.') + '&t=success';
        });
    }

    async function send(method, url, body) {
        const res = await fetch(url, {
            method,
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json().catch(() => ({}));
        return { ...data, success: res.ok && data.success !== false };
    }

    let cachedToken;
    async function authHeader() {
        if (!cachedToken) {
            const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
            const d = await r.json().catch(() => ({}));
            cachedToken = d.accessToken || null;
        }
        return cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {};
    }
});
