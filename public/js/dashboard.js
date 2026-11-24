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

    const initial = JSON.parse($('#dashboardData').textContent);
    const me = { success: true, data: initial.user }, appsRes = { success: true, data: initial.apps };
    const user = me.data || {};

    if (!appsRes.success) showToast(appsRes.message || 'Could not load your apps.', 'error');
    const apps = appsRes.data || [];

    const urlAppId = location.pathname.match(/\/apps\/([a-f0-9]{24})/)?.[1];
    const remembered = localStorage.getItem('appId');
    if (remembered && !apps.some(a => a._id === remembered)) localStorage.removeItem('appId');
    const currentId = apps.some(a => a._id === urlAppId) ? urlAppId : '';
    $$('[data-app-context]').forEach(el => { el.hidden = false; });
    $$('[data-app-select]').forEach((sel) => {
        
        
        sel.disabled = !apps.length;
        sel.addEventListener('change', () => {
            if ($$('form').some(form => form.dataset.dirty) && !confirm('Leave this page and discard unsaved changes?')) { sel.value = currentId; return; }
            if (!sel.value) { localStorage.removeItem('appId'); location.href = '/dashboard'; return; }
            localStorage.setItem('appId', sel.value);
            if (sel.value) {
                const tail = location.pathname.endsWith('/users') ? '/users' : location.pathname.endsWith('/settings') ? '/settings' : location.hash;
                location.href = `/dashboard/apps/${sel.value}${tail}`;
            }
        });
    });
    $$('[data-app-link]').forEach((a) => {
        if (currentId) {
            const sub = a.dataset.appLink;
            a.href = sub ? `/dashboard/apps/${currentId}${sub.startsWith('#') ? '' : '/'}${sub}` : `/dashboard/apps/${currentId}`;
        } else {
            a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href');
        }
    });
    $$('.nav-link').forEach((a) => {
        const active = a.pathname === location.pathname && (a.hash ? a.hash === location.hash : !location.hash);
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

    if (page === 'apps') {
        const PER = 6;
        const grid = $('#appGrid'), pager = $('#pager'), empty = $('#empty');
        const st = { q: '', status: '', sort: 'az', page: 1 };

        function render(initialRender = false) {
            let list = apps.filter((a) =>
                a.name.toLowerCase().includes(st.q) && (!st.status || a.status === st.status));
            list.sort((a, b) => a.name.localeCompare(b.name) * (st.sort === 'az' ? 1 : -1));

            const pages = Math.max(1, Math.ceil(list.length / PER));
            st.page = Math.min(st.page, pages);
            const slice = list.slice((st.page - 1) * PER, st.page * PER);

            if (!initialRender) grid.replaceChildren(...slice.map((a) => {
                const el = $('#appTpl').content.cloneNode(true);
                $('[data-name]', el).textContent = a.name;
                const desc = $('[data-description]', el); if (desc) desc.textContent = a.description || 'Configure authentication for this app.';
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
        if (apps.length > PER) render(true);

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
            localStorage.setItem('appId', r.data._id);
            $$('[data-app-select]').forEach(sel => { sel.replaceChildren(new Option('Select app', '', true, true), ...apps.map(a => new Option(a.name, a._id))); sel.disabled = false; });
            $('#onboarding')?.setAttribute('hidden', '');
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
        const a = initial.selectedApp;
        const main = $('#appMain');
        localStorage.setItem('appId', a._id);
        initIntegration(a, main);
        $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText($(`#${b.dataset.copy}`).value); showToast('Copied.', 'success'); }
            catch { showToast('Could not copy. Select and copy it manually.', 'warning'); }
        }));
    }

    if (page === 'appUsers') {
        const search = document.createElement('input'); search.type = 'search'; search.className = 'form-control mb-3'; search.placeholder = 'Search users'; search.setAttribute('aria-label', 'Search users');
        $('.users-table').closest('.card').before(search);
        search.addEventListener('input', () => $$('#usersBody tr').forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(search.value.toLowerCase()); }));
        const body = $('#usersBody'), empty = $('#emptyUsers');
        const card = body.closest('.card');
        const banDialog = $('#banDialog');
        const banPicker = makeDatepicker($('#banPicker'), { min: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), inline: true });
        let pendingBan = null;

        function userRow({ user, scopes, banned, bannedUntil }) {
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
            if (banned) { const badge=document.createElement('span'); badge.className='badge badge-danger'; badge.textContent=bannedUntil ? `Banned until ${fmtDate(bannedUntil)}` : 'Banned'; who.append(badge); }
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
                if (!confirm(`Revoke ${name}'s current authorization? They can authorize again.`)) return;
                revokeBtn.disabled = true;
                const rr = await send('DELETE', `/api/apps/${urlAppId}/users/${user.id}`);
                showToast(rr.message, rr.success ? 'success' : 'error');
                load();
            });
            const banBtn = document.createElement('button');
            banBtn.type = 'button';
            banBtn.className = 'btn btn-text theme-danger btn-sm';
            banBtn.innerHTML = banned ? '<i class="fa-solid fa-unlock" aria-hidden="true"></i> Unban' : '<i class="fa-solid fa-gavel" aria-hidden="true"></i> Ban';
            banBtn.addEventListener('click', async () => {
                if (banned) { banBtn.disabled=true; const rr=await send('POST',`/api/apps/${urlAppId}/users/${user.id}/unban`,{}); showToast(rr.message,rr.success?'success':'error'); await load(); return; }
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
            if (!r.success) { body.replaceChildren(); const row = body.insertRow(); row.insertCell().textContent = r.message || 'Could not load users. Reload to retry.'; empty.classList.add('d-none'); card.querySelector('.table-wrap').classList.remove('d-none'); return; }
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


        $$('#usersBody tr[data-user-id]').forEach(row => { const item = initial.users.find(item => item.user.id === row.dataset.userId); if (!item) return; const bound = userRow(item); const oldButtons = [...row.querySelectorAll('button')]; [...bound.querySelectorAll('button')].forEach((button,index) => oldButtons[index]?.replaceWith(button)); });
    }

    if (page === 'appSettings') {
        const ALL_SCOPES = ['username', 'email', 'profile', 'phone', 'address', 'birthDate'];
        const r = {success:true, data:initial.selectedApp};
        if (!r.success) { showToast(r.message || 'App not found.', 'error'); return; }
        const app = r.data;
        localStorage.setItem('appId', app._id);





        function addRedirect(value = '') {
            const wrap = $('#redirectInputs');
            if (wrap.children.length >= 20) return;
            const row = document.createElement('div'); row.className = 'redirect-row';
            const field = document.createElement('div'); field.className = 'form-field';
            const input = document.createElement('input'); input.type = 'url'; input.className = 'form-control mono'; input.value = value; input.placeholder = 'https://yourapp.com/callback'; input.setAttribute('aria-label', 'Redirect URL');
            field.append(input); Forms.feedback(input, 'Use an HTTPS URL, or HTTP on localhost. No fragments or wildcards.');
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-outline btn-sm'; remove.textContent = 'Remove';
            remove.addEventListener('click', () => { row.remove(); $('#redirectsForm').dispatchEvent(new Event('input', {bubbles:true})); $('#addRedirect').disabled = false; });
            row.append(field, remove); wrap.append(row); $('#addRedirect').disabled = wrap.children.length >= 20;
        }
        $$('#redirectInputs .redirect-row').forEach(row => { Forms.feedback(row.querySelector('input'), 'Use an HTTPS URL, or HTTP on localhost. No fragments or wildcards.'); row.querySelector('button').addEventListener('click', () => { row.remove(); $('#redirectsForm').dispatchEvent(new Event('input', {bubbles:true})); $('#addRedirect').disabled = false; }); });
        $('#addRedirect').addEventListener('click', () => { addRedirect(); $$('#redirectInputs input').at(-1)?.focus(); $('#redirectsForm').dispatchEvent(new Event('input', {bubbles:true})); });

        function previewAppearance() {
            const avatar = $('[data-preview-avatar]'); avatar.replaceChildren(); fillAvatar(avatar, app.name, $('#sLogo').value);
            $('[data-preview-banner]').replaceChildren(); $('[data-preview-banner]').style.backgroundImage = ''; if ($('#sBanner').value) applyBanner($('[data-preview-banner]'), $('#sBanner').value);
        }
        ['sLogo','sBanner'].forEach(id => $('#' + id).addEventListener('change', () => { if (Forms.imageUrl($('#' + id))) previewAppearance(); }));



        $('#generalForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!Validate.group(e.target)) return;
            const rr = await send('PATCH', `/api/apps/${urlAppId}`, {
                name: $('#sName').value.trim(),
                description: $('#sDesc').value.trim(),
                status: $('#sStatus').checked ? 'active' : 'disabled'
            });
            if (rr.success) { app.name = $('#sName').value.trim(); $$('[data-app-name]').forEach(el => el.textContent = app.name); $$('[data-app-select] option').forEach(el => { if (el.value === app._id) el.textContent = app.name; }); }
            showToast(rr.message, rr.success ? 'success' : 'error');
        });

        $('#redirectsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputs = $$('#redirectInputs input');
            inputs.forEach(input => {
                let ok = !input.value.trim();
                try { const u = new URL(input.value.trim()); ok ||= !u.hash && !input.value.includes('*') && (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname))); } catch {}
                input.setCustomValidity(ok ? '' : 'Invalid redirect URL.');
            });
            if (!Validate.group(e.target)) return;
            const redirectUrls = [...new Set(inputs.map(input => input.value.trim()).filter(Boolean))];
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
            Forms.imageUrl($('#sLogo')); Forms.imageUrl($('#sBanner'));
            if (!Validate.group(e.target)) return;
            const rr = await send('PATCH', `/api/apps/${urlAppId}`, { theme: { ...app.theme,
                logoUrl: $('#sLogo').value.trim(), bannerUrl: $('#sBanner').value.trim(),
                primaryColor: $('#sColor').value,
                darkMode: $('#sDark').checked
            } });
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






        const phone = Forms.phone($('#pPhone'), $('#phoneCountry'));
        const profileSummary = $('#profileForm .form-summary');
        $$('#profileForm input, #profileForm textarea').forEach(input => { input.dataset.apiField = ({pDisplayName:'profile.displayName',pBio:'profile.bio',pPhone:'phone',pBirthDate:'birthDate',pAvatar:'profile.avatarUrl',pBanner:'profile.bannerUrl'})[input.id]; Forms.feedback(input, input.type === 'url' ? 'Use an HTTPS image URL.' : 'Check this value.'); });

        const birthPicker = makeDatepicker($('#pBirthDate'), { min: '1900-01-01', max: new Date().toISOString().slice(0, 10) });
        if (user.birthDate) birthPicker?.setSelectedDates([String(user.birthDate).slice(0, 10)]);

        $('#profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            phone.valid(); Forms.imageUrl($('#pAvatar')); Forms.imageUrl($('#pBanner'));
            const dateValue = $('#pBirthDate').value.trim();
            $('#pBirthDate').setCustomValidity(!dateValue || !isNaN(Date.parse(dateValue)) && new Date(dateValue) <= new Date() ? '' : 'Choose a valid past date.');
            if (!Validate.group(e.target)) { Forms.invalid(e.target, profileSummary); return; }
            Forms.summary(profileSummary, '');
            const body = {
                profile: {
                    displayName: $('#pDisplayName').value.trim(),
                    bio: $('#pBio').value.trim(),
                    avatarUrl: $('#pAvatar').value.trim(), bannerUrl: $('#pBanner').value.trim()
                },
                phone: phone.number(),
                birthDate: birthPicker?.getSelectedDates?.()[0] || undefined
            };
            const rr = await send('PATCH', '/api/me', body);
            if (!rr.success) Forms.serverErrors(e.target, rr, profileSummary);
            else { $$('[data-user-initials]').forEach(el => fillAvatar(el, body.profile.displayName || user.username, body.profile.avatarUrl)); $('#profileBanner').replaceChildren(); $('#profileBanner').style.backgroundImage = ''; if (body.profile.bannerUrl) applyBanner($('#profileBanner'), body.profile.bannerUrl); }
            showToast(rr.message, rr.success ? 'success' : 'error');
        });

        const sessionsList = $('#sessionsList');
        const sessRes = {success:true, data:initial.sessions};
        const sessions = (sessRes.data || []).filter((s) => !s.appId);
        sessionsList.querySelectorAll('[data-revoke-session]').forEach(btn => btn.addEventListener('click', async () => {
            btn.disabled = true;
            const rr = await send('DELETE', `/api/me/sessions/${btn.dataset.revokeSession}`);
            showToast(rr.message, rr.success ? 'success' : 'error');
            if (rr.success) btn.closest('li').remove(); else btn.disabled = false;
        }));
        if (!sessRes.success) sessionsList.textContent = sessRes.message || 'Could not load sessions. Reload to retry.';
        else if (!sessions.length) sessionsList.innerHTML = '<li class="text-secondary">No active sessions found.</li>';

        const authzList = $('#authzList');
        const authz = {success:true, data:initial.authorizations};
        const grants = authz.data || [];
        authzList.querySelectorAll('[data-revoke-authorization]').forEach(btn => btn.addEventListener('click', async () => {
            btn.disabled = true;
            const rr = await send('DELETE', `/api/me/authorizations/${btn.dataset.revokeAuthorization}`);
            showToast(rr.message, rr.success ? 'success' : 'error');
            if (rr.success) btn.closest('li').remove(); else btn.disabled = false;
        }));
        if (!authz.success) authzList.textContent = authz.message || 'Could not load authorizations. Reload to retry.';
        else if (!grants.length) authzList.innerHTML = '<li class="text-secondary">You have not authorized any apps yet.</li>';

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

    $$('[data-image-upload]').forEach(button => button.addEventListener('click', async () => {
        const id = button.dataset.imageUpload;
        const input = $('#' + id + 'File');
        const file = input.files[0];
        const status = $(`[data-image-status="${id}"]`);
        if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size < 512 || file.size > 5 * 1024 * 1024) { status.textContent = 'Choose a PNG, JPEG or WebP between 512 bytes and 5 MB.'; return; }
        if (input.closest('form').dataset.dirty && !confirm('This uploads and saves the image immediately. Your other unsaved fields will not be saved. Continue?')) return;
        button.disabled = true; status.textContent = 'Uploading image…';
        const params = new URLSearchParams({field:button.dataset.imageField});
        if (page === 'appSettings') params.set('appId', urlAppId);
        const result = await Api.upload(`/api/images/${page === 'appSettings' ? 'app' : 'account'}?${params}`, file);
        button.disabled = false;
        status.textContent = result.message || 'Upload failed.';
        if (!result.success) return;
        $('#' + id).value = result.data.url; input.value = '';
        const form = input.closest('form');
        const prior = JSON.parse(form.dataset.snapshot || '[]');
        prior.forEach(entry => { if (entry[0] === id) entry[1] = result.data.url; if (entry[0] === id + 'File') entry[1] = ''; });
        form.dataset.snapshot = JSON.stringify(prior);
        $('#' + id).dispatchEvent(new Event('change', {bubbles:true}));
        if (page === 'account') {
            user.profile ||= {}; user.profile[button.dataset.imageField] = result.data.url;
            if (id === 'pAvatar') $$('[data-user-initials]').forEach(el => fillAvatar(el,user.profile.displayName || user.username,result.data.url));
            else { $('#profileBanner').replaceChildren(); $('#profileBanner').style.backgroundImage = `url("${result.data.url}")`; }
        } else initial.selectedApp.theme[button.dataset.imageField] = result.data.url;
    }));

    function initIntegration(app, main) {
        const section = $('#integration');
        const redirect = $('#playRedirect');
        let state = '', verifier = '';
        const base64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        $('#playgroundForm').addEventListener('submit', async event => {
            event.preventDefault();
            const scopes = $$('#playScopes input:checked').map(cb => cb.value);
            const error = $('#playError'); error.hidden = true;
            if (!redirect.value || !scopes.length || app.status !== 'active') { error.textContent = 'An active app, registered redirect URL and at least one scope are required.'; error.hidden = false; return; }
            if (!crypto.subtle) { error.textContent = 'PKCE needs HTTPS or localhost.'; error.hidden = false; return; }
            verifier = base64(crypto.getRandomValues(new Uint8Array(32))); state = base64(crypto.getRandomValues(new Uint8Array(24)));
            const challenge = base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
            const url = new URL('/oauth/authorize',location.origin); url.search = new URLSearchParams({client_id:app.clientId,redirect_uri:redirect.value,response_type:'code',scope:scopes.join(' '),state,code_challenge:challenge,code_challenge_method:'S256'});
            $('#playUrl').value = url.toString(); $('#playOpen').href = url.toString(); $('#playVerifier').textContent = verifier; $('#playResult').hidden = false;
        });
        $('#playInspect').addEventListener('click', () => {
            const status = $('#playCallbackStatus');
            try {
                const callback = new URL($('#playCallback').value); const expected = new URL(redirect.value);
                if (callback.origin !== expected.origin || callback.pathname !== expected.pathname || [...expected.searchParams].some(([key,value]) => callback.searchParams.get(key) !== value)) throw Error('Callback does not match the selected redirect URL.');
                if (callback.searchParams.get('state') !== state) throw Error('State mismatch. Do not use this callback.');
                if (callback.searchParams.get('error')) { status.textContent = `Authorization returned: ${callback.searchParams.get('error')}`; return; }
                if (!callback.searchParams.get('code')) throw Error('No authorization code found.');
                status.textContent = 'Callback and state match. Exchange the code on your server using the verifier above and your client secret. Do not share them.';
            } catch (error) { status.textContent = error.message || 'Paste a valid callback URL.'; }
        });
        $('#userinfoForm').addEventListener('submit', async event => {
            event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
            const token = $('#playAccessToken').value.trim(); $('#playAccessToken').value = '';
            try { const response = await fetch('/oauth/userinfo',{headers:{Authorization:`Bearer ${token}`},credentials:'omit',cache:'no-store'}); const data = await response.json(); $('#playUserinfo').textContent = JSON.stringify({status:response.status,body:data},null,2); }
            catch { $('#playUserinfo').textContent = 'Could not load userinfo. Check your connection.'; }
            finally { button.disabled = false; }
        });
                const details = [...main.children].filter(el => el !== section);
        function showIntegration() {
            const hash = location.hash;
            const tool = ['#docs','#playground'].includes(hash);
            details.forEach(el => el.hidden = tool);
            $('#docs',section).hidden = hash !== '#docs';
            $('#playground',section).hidden = hash !== '#playground';
            if (!tool) {
                let intro = $('#integrationIntro');
                if (!intro) { intro = document.createElement('p'); intro.id = 'integrationIntro'; intro.className = 'text-secondary mb-0'; intro.textContent = 'Get app-specific integration instructions or test an OAuth request.'; $('.card-body',section).append(intro); }
                intro.hidden = false;
            } else { $('#integrationIntro')?.setAttribute('hidden',''); }
            $$('.nav-link[data-app-link]').forEach(link => { const active = link.pathname === location.pathname && link.hash === hash; link.classList.toggle('active',active); if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
            $$('.integration-tabs a',section).forEach(link => { link.classList.toggle('theme-brand',link.hash === hash); link.classList.toggle('btn-solid',link.hash === hash); });
        }
        window.addEventListener('hashchange',showIntegration); showIntegration();
    }

    async function send(method, url, body) {
        const form = document.activeElement?.closest('form');
        if (form) form.querySelectorAll('[type=submit]').forEach(btn => btn.disabled = true);
        const result = await Api[method.toLowerCase()](url, body);
        if (form) {
            form.querySelectorAll('[type=submit]').forEach(btn => btn.disabled = false);
            if (result.success) { form.dataset.snapshot = snapshot(form); form.dataset.dirty = ''; const note = form.querySelector('.form-save-state'); if (note) note.textContent = 'Saved'; }
        }
        return result;
    }

    function snapshot(form) { return JSON.stringify([...form.querySelectorAll('input,textarea,select')].map(el => [el.id, el.type === 'checkbox' ? el.checked : el.value])); }
    $$('form').forEach(form => {
        form.dataset.snapshot = snapshot(form);
        if (!['appSettings','account'].includes(page)) return;
        const note = document.createElement('span'); note.className = 'form-save-state'; note.setAttribute('aria-live','polite'); form.append(note);
        const update = () => { form.dataset.dirty = snapshot(form) !== form.dataset.snapshot ? 'true' : ''; note.textContent = form.dataset.dirty ? 'Unsaved changes' : ''; };
        form.addEventListener('input', update); form.addEventListener('change', update);
    });
    window.addEventListener('beforeunload', event => { if ($$('form').some(form => form.dataset.dirty)) { event.preventDefault(); event.returnValue = ''; } });

    function deviceLabel(agent = '') {
        const os = /iPad/.test(agent) ? 'iPadOS' : /iPhone/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Windows/.test(agent) ? 'Windows' : /Macintosh|Mac OS/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : 'Unknown device';
        const browser = /Edg/.test(agent) ? 'Edge' : /OPR/.test(agent) ? 'Opera' : /Firefox|FxiOS/.test(agent) ? 'Firefox' : /Chrome|CriOS/.test(agent) ? 'Chrome' : /Safari/.test(agent) ? 'Safari' : 'Unknown browser';
        return `${browser} on ${os}`;
    }

    if (page === 'dashboard') {
        async function activity() {
            const target = $('#activityChart'); target.textContent = 'Loading activity…';
            const result = await Api.get(`/api/analytics?days=${$('#analyticsDays').value}`);
            if (!result.success) { target.textContent = result.message || 'Could not load activity. Change the period to retry.'; return; }
            if (!Array.isArray(result.data?.series) || !Number.isFinite(result.data?.total)) { target.textContent = 'Activity response was incomplete. Change the period to retry.'; return; }
            const series = result.data.series; target.replaceChildren();
            const total = document.createElement('p'); total.className = 'h4'; total.textContent = `${result.data.total} sign-ins in retained records`; target.append(total);
            if (!result.data.total) { const empty = document.createElement('p'); empty.className = 'form-text'; empty.textContent = 'No initial OAuth token issues found for this period in retained records.'; target.append(empty); }
            const bars = document.createElement('div'); bars.className = 'activity-bars'; bars.setAttribute('aria-hidden','true');
            const max = Math.max(1,...series.map(day => day.count));
            series.forEach((day,index) => { const col = document.createElement('div'); col.className = 'activity-day'; col.title = `${day.date}: ${day.count}`; const bar = document.createElement('div'); bar.className = 'activity-bar'; bar.style.height = `${Math.max(1,day.count/max*85)}%`; const label = document.createElement('span'); label.textContent = series.length <= 7 || index % 5 === 0 ? day.date.slice(5) : ''; col.append(bar,label); bars.append(col); });
            target.append(bars);
            const details = document.createElement('details'); details.className = 'activity-table'; const summary = document.createElement('summary'); summary.textContent = 'View daily counts'; details.append(summary);
            const table = document.createElement('table'); table.className = 'table-simple'; table.innerHTML = '<caption class="visually-hidden">Daily sign-in counts in UTC</caption><thead><tr><th>Date (UTC)</th><th>Count</th></tr></thead>'; const tbody = document.createElement('tbody'); series.forEach(day => { const tr = document.createElement('tr'); [day.date,day.count].forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.append(td); }); tbody.append(tr); }); table.append(tbody); details.append(table); target.append(details);
        }
        $('#analyticsDays').addEventListener('change', activity);
    }
});
