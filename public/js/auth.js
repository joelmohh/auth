document.addEventListener('DOMContentLoaded', () => {
    const $ = (s, r = document) => r.querySelector(s);
    const page = document.body.dataset.page;

    function busy(btn, on) {
        btn.dataset.label ??= btn.textContent;
        btn.disabled = on;
        btn.textContent = on ? 'Please wait…' : btn.dataset.label;
    }

    function initOtp(panel) {
        const input = $('.otp-input', panel);
        const submit = $('[data-otp-submit]', panel);
        const resend = $('[data-otp-resend]', panel);
        const s = { email: '', purpose: '', onCode: null };
        let timer;

        function countdown(left = 60) {
            clearInterval(timer);
            const tick = () => {
                resend.disabled = left > 0;
                resend.textContent = left > 0 ? `Resend code (${left}s)` : 'Resend code';
                if (left-- <= 0) clearInterval(timer);
            };
            tick();
            timer = setInterval(tick, 1000);
        }

        resend.addEventListener('click', async () => {
            const r = await Api.post('/api/auth/resend-otp', { email: s.email, purpose: s.purpose }, false);
            showToast(r.message, r.success ? 'success' : 'error');
            if (r.success) countdown();
        });

        submit.addEventListener('click', () => {
            const code = input.value.replace(/\D/g, '');
            if (code.length !== 6) return showToast('Enter the 6-digit code.', 'warning');
            s.onCode(code, submit);
        });

        return {
            show(email, purpose, onCode, { resendCountdown = true } = {}) {
                Object.assign(s, { email, purpose, onCode });
                $('[data-otp-email]', panel).textContent = email;
                panel.classList.remove('d-none');
                if (resendCountdown) countdown();
                input.focus();
            }
        };
    }

    function postAuthRedirect(fallback) {
        const back = new URLSearchParams(location.search).get('redirect');
        if (back && back.startsWith('/') && !back.startsWith('//')) return back;
        return fallback;
    }

    async function verifyEmail(email, code, btn) {
        busy(btn, true);
        const r = await Api.post('/api/auth/verify-otp', { email, otp: code, purpose: 'verify_email' }, false);
        busy(btn, false);
        if (!r.success) return showToast(r.message, 'error');
        location.href = postAuthRedirect('/dashboard');
    }

    if (page === 'login') {
        const form = $('#loginForm');
        const googleLink = $('[data-google-login]');
        const back = new URLSearchParams(location.search).get('redirect');
        if (googleLink && back && back.startsWith('/') && !back.startsWith('//')) {
            googleLink.href = '/api/auth/google?redirect=' + encodeURIComponent(back);
        }
        const otp = initOtp($('[data-otp-panel]'));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!Validate.group(form)) return;
            const btn = $('[type=submit]', form);
            const email = form.elements.email.value.trim();

            busy(btn, true);
            const r = await Api.post('/api/auth/login', { email, password: form.elements.password.value }, false);
            busy(btn, false);

            if (r.success) return (location.href = postAuthRedirect(r.redirectURL || '/dashboard'));
            if (r.verified === false) {
                $('#loginView').classList.add('d-none');
                otp.show(email, 'verify_email', (code, b) => verifyEmail(email, code, b));
                return showToast('Check your email for a verification code.', 'info');
            }
            showToast(r.message, 'error');
        });
    }

    if (page === 'signup') {
        const form = $('#signupForm');
        const steps = [...form.querySelectorAll('[data-step]')];
        const dots = [...document.querySelectorAll('.steps-item')];
        const otp = initOtp($('[data-otp-panel]'));
        let i = 0;
        const summary = $('#signupSummary');
        const phone = Forms.phone(form.elements.phone);


        const birthPicker = window.bootstrap?.Datepicker
            ? new bootstrap.Datepicker(form.elements.birthDate, { dateMin: '1900-01-01', dateMax: new Date().toISOString().slice(0, 10), datepickerTheme: 'dark' })
            : null;

        const go = (n) => {
            i = n;
            Forms.summary(summary, '');
            steps.forEach((el, k) => el.classList.toggle('d-none', k !== n));
            dots.forEach((d, k) => d.classList.toggle('active', k <= n));
        };

        form.addEventListener('click', (e) => {
            if (e.target.closest('[data-prev]')) { e.preventDefault(); go(i - 1); }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (i === 1) phone.valid();
            if (!Validate.group(steps[i])) { Forms.invalid(steps[i], summary); return; }
            Forms.summary(summary, '');
            if (i < steps.length - 1) return go(i + 1);

            const v = (n) => form.elements[n].value.trim() || undefined;
            const address = Object.fromEntries(['city', 'state', 'country'].map((k) => [k, v(k)]).filter(([, x]) => x));
            const body = {
                email: v('email'),
                username: v('username'),
                password: form.elements.password.value,
                termsAccepted: form.elements.terms.checked,
                displayName: v('displayName'),
                bio: v('bio'),
                phone: phone.number(),
                birthDate: birthPicker?.getSelectedDates?.()[0] || undefined,
                address: Object.keys(address).length ? address : undefined
            };

            const btn = $('[type=submit]', steps[i]);
            busy(btn, true);
            const r = await Api.post('/api/auth/signup', body, false);
            busy(btn, false);

            if (!r.success) {
                if (r.status === 400 || r.status === 409) go(0);
                Forms.serverErrors(form, r, summary);
                if (!Array.isArray(r.data) && /email|username/i.test(r.message || '')) {
                    const name = /email/i.test(r.message) ? 'email' : 'username';
                    const input = form.elements[name]; input.classList.add('is-invalid'); Forms.feedback(input, r.message).hidden = false;
                }
                return;
            }
            form.classList.add('d-none');
            dots.forEach((d) => d.classList.add('active'));
            otp.show(body.email, 'verify_email', (code, b) => verifyEmail(body.email, code, b));
            showToast(r.message, 'success');
        });
    }

    if (page === 'reset') {
        const views = [...document.querySelectorAll('[data-view]')];
        const emailForm = $('#emailForm');
        const passForm = $('#passForm');
        const otp = initOtp($('[data-otp-panel]'));
        let email = '', code = '';

        const go = (n) => views.forEach((el, k) => el.classList.toggle('d-none', k !== n));

        emailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!Validate.group(emailForm)) return;
            email = emailForm.elements.email.value.trim();
            const btn = $('[type=submit]', emailForm);

            busy(btn, true);
            const r = await Api.post('/api/auth/forgot-password', { email }, false);
            busy(btn, false);
            if (!r.success) return showToast(r.message, 'error');

            showToast('If this email exists, a code is on its way.', 'success');
            go(1);
            otp.show(email, 'password_reset', (c) => { code = c; go(2); });
        });

        passForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!Validate.group(passForm)) return;
            const btn = $('[type=submit]', passForm);

            busy(btn, true);
            const r = await Api.post('/api/auth/reset-password', {
                email, otp: code,
                newPassword: passForm.elements.newPassword.value,
                confirmPassword: passForm.elements.confirmPassword.value
            }, false);
            busy(btn, false);

            if (r.success) {
                location.href = '/login?message=' + encodeURIComponent('Password changed. Sign in with your new password.') + '&t=success';
                return;
            }
            showToast(r.message, 'error');
            if (/otp|attempt/i.test(r.message || '')) go(1);
        });
    }
});
