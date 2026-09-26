document.addEventListener('DOMContentLoaded', function () {

    // toggle password visibility
    document.querySelectorAll('.input-icon-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });
    // auto-advance / backspace between OTP boxes
    const digits = document.querySelectorAll('.otp-digit');
    digits.forEach((input, i) => {
        input.addEventListener('input', () => {
            input.value = input.value.replace(/[^0-9]/g, '');
            if (input.value && i < digits.length - 1) digits[i + 1].focus();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && i > 0) digits[i - 1].focus();
        });
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, digits.length);
            pasted.split('').forEach((char, idx) => { if (digits[idx]) digits[idx].value = char; });
            digits[Math.min(pasted.length, digits.length - 1)].focus();
        });
    });

    // OTP verification and resend
    const verifyOtpForm = document.getElementById('verify-otp-form');

    if (verifyOtpForm) {
        const verifyButton = document.getElementById('verify-otp-button');
        const otpError = document.getElementById('otp-error');
        const resendLink = document.getElementById('resend-otp-link');
        const otpTimer = document.getElementById('otp-timer');
        const email = new URLSearchParams(window.location.search).get('email');
        const destination = document.querySelector('.otp-destination');
        let countdownId;

        const maskEmail = (address) => {
            const [name, domain] = address.split('@');
            if (!name || !domain) return address;
            return `${name.slice(0, 1)}***@${domain}`;
        };

        if (email && destination) destination.textContent = maskEmail(email);

        const showOtpError = (message) => {
            otpError.textContent = message;
            otpError.classList.toggle('is-visible', Boolean(message));
            digits.forEach((input) => input.classList.toggle('invalid', Boolean(message)));
        };

        const startCountdown = (seconds) => {
            clearInterval(countdownId);
            resendLink.classList.add('disabled');
            resendLink.setAttribute('aria-disabled', 'true');

            const updateTimer = () => {
                if (seconds <= 0) {
                    clearInterval(countdownId);
                    resendLink.classList.remove('disabled');
                    resendLink.removeAttribute('aria-disabled');
                    otpTimer.textContent = '· available now';
                    return;
                }

                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = String(seconds % 60).padStart(2, '0');
                otpTimer.textContent = `· available in ${minutes}:${remainingSeconds}`;
                seconds -= 1;
            };

            updateTimer();
            countdownId = window.setInterval(updateTimer, 1000);
        };

        digits.forEach((input) => {
            input.addEventListener('input', () => showOtpError(''));
        });

        verifyOtpForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const otp = Array.from(digits).map((input) => input.value).join('');

            if (!email) {
                showOtpError('Email not found. Please start the signup process again.');
                return;
            }

            if (otp.length !== digits.length) {
                showOtpError('Enter the 6-digit verification code.');
                const emptyInput = Array.from(digits).find((input) => !input.value);
                if (emptyInput) emptyInput.focus();
                return;
            }

            try {
                verifyButton.disabled = true;
                verifyButton.textContent = 'Verifying...';

                const response = await fetch('/api/auth/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    showOtpError(data.message || 'The verification code is invalid.');
                    return;
                }

                window.location.href = '/dashboard';
            } catch (error) {
                console.error('OTP verification error:', error);
                showOtpError('Unable to verify the code. Please try again.');
            } finally {
                verifyButton.disabled = false;
                verifyButton.textContent = 'Verify code';
            }
        });

        resendLink.addEventListener('click', async (event) => {
            event.preventDefault();
            if (resendLink.classList.contains('disabled')) return;

            if (!email) {
                showOtpError('Email not found. Please start the signup process again.');
                return;
            }

            try {
                resendLink.classList.add('disabled');
                const response = await fetch('/api/auth/resend-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    resendLink.classList.remove('disabled');
                    showOtpError(data.message || 'Unable to resend the code.');
                    return;
                }

                showOtpError('');
                showToast(data.message || 'A new code was sent.', 'success');
                startCountdown(30);
            } catch (error) {
                resendLink.classList.remove('disabled');
                console.error('OTP resend error:', error);
                showOtpError('Unable to resend the code. Please try again.');
            }
        });
    }

    // login form validation and submission

    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');

    const email = document.getElementById('email');
    const password = document.getElementById('password');

    const errorMessages = {
        email: document.getElementById('email-error'),
        password: document.getElementById('password-error')
    };

    if (loginForm) {
        [email, password].forEach((input) => {
            input.addEventListener('input', () => {
                input.classList.remove('invalid');
                input.setAttribute('aria-invalid', 'false');
                errorMessages[input.id].textContent = '';
            });
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const remember = document.getElementById('remember').checked;

            const emailIsInvalid = !email.value.trim();
            const passwordIsInvalid = !password.value || password.value.length < 6;

            email.classList.toggle('invalid', emailIsInvalid);
            password.classList.toggle('invalid', passwordIsInvalid);
            email.setAttribute('aria-invalid', emailIsInvalid);
            password.setAttribute('aria-invalid', passwordIsInvalid);

            if (emailIsInvalid || passwordIsInvalid) {
                if (emailIsInvalid) email.focus();
                else password.focus();
                errorMessages.email.classList.add('text-danger');
                errorMessages.password.classList.add('text-danger');
                errorMessages.email.textContent = emailIsInvalid ? 'Email is required.' : '';
                errorMessages.password.textContent = passwordIsInvalid ? 'Password must be at least 6 characters.' : '';
                return;
            }

            try {
                loginButton.disabled = true;
                loginButton.textContent = 'Logging in...';

                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email.value, password: password.value, remember })
                });

                const data = await response.json();

                if (data.success) {
                    window.location.href = data.redirectURL || '/dashboard';
                } else if (data.verified === false) {
                    window.location.href = `/verify-otp?email=${encodeURIComponent(email.value)}&message=${encodeURIComponent('Account not verified. Please verify your account.')}&t=error`;
                } else {
                    if (data.success === false || response.status === 401) {
                        showToast(data.message || 'Invalid credentials. Please try again.', 'error');
                        errorMessages.email.classList.add('text-danger');
                        errorMessages.password.classList.add('text-danger');
                        errorMessages.email.textContent = 'Invalid email or password.';
                        errorMessages.password.textContent = 'Invalid email or password.';
                    } else {
                        showToast(data.message || 'An error occurred. Please try again.', 'error');
                    }
                }

            } catch (error) {
                console.error('Error:', error);
                showToast('An error occurred. Please try again.', 'error');
            } finally {
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
        });
    }

    // signup form validation and submission

    const signupForm = document.getElementById('signup-form');
    const signupButton = document.getElementById('signup-button');
    const signupNext = document.getElementById('signup-next');

    if (signupForm) {
        const username = document.getElementById('username');
        const signupEmail = document.getElementById('email');
        const signupPassword = document.getElementById('password');
        const confirmPassword = document.getElementById('confirm-password');
        const terms = document.getElementById('terms');
        const stepOne = signupForm.querySelector('[data-step="1"]');
        const stepTwo = signupForm.querySelector('[data-step="2"]');
        const stepDots = signupForm.parentElement.querySelectorAll('[data-step-dot]');
        const stepCaption = signupForm.parentElement.querySelector('[data-step-caption]');

        const setError = (input, errorId, message) => {
            const error = document.getElementById(errorId);
            input.classList.toggle('invalid', Boolean(message));
            input.setAttribute('aria-invalid', String(Boolean(message)));
            if (error) error.textContent = message;
        };

        const showStep = (step) => {
            const isFirstStep = step === 1;
            stepOne.hidden = !isFirstStep;
            stepTwo.hidden = isFirstStep;
            stepDots.forEach((dot) => dot.classList.toggle('active', dot.dataset.stepDot === String(step)));
            stepCaption.textContent = isFirstStep
                ? 'Step 1 of 2 · required info'
                : 'Step 2 of 2 · optional info';
        };

        const validateRequiredFields = () => {
            const emailIsInvalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.value.trim());
            const usernameIsInvalid = !/^[a-zA-Z0-9_]{3,30}$/.test(username.value.trim());
            const passwordIsInvalid = signupPassword.value.length < 6;
            const confirmPasswordIsInvalid = confirmPassword.value !== signupPassword.value;

            setError(username, 'username-error', usernameIsInvalid ? 'Use 3 to 30 letters, numbers or underscores.' : '');
            setError(signupEmail, 'email-error', emailIsInvalid ? 'Enter a valid email.' : '');
            setError(signupPassword, 'password-error', passwordIsInvalid ? 'Password must be at least 6 characters.' : '');
            setError(confirmPassword, 'confirm-password-error', confirmPasswordIsInvalid ? 'Passwords do not match.' : '');

            if (usernameIsInvalid) username.focus();
            else if (emailIsInvalid) signupEmail.focus();
            else if (passwordIsInvalid) signupPassword.focus();
            else if (confirmPasswordIsInvalid) confirmPassword.focus();

            return !(usernameIsInvalid || emailIsInvalid || passwordIsInvalid || confirmPasswordIsInvalid);
        };

        [username, signupEmail, signupPassword, confirmPassword].forEach((input) => {
            input.addEventListener('input', () => {
                input.classList.remove('invalid');
                input.setAttribute('aria-invalid', 'false');
                const error = document.getElementById(`${input.id}-error`);
                if (error) error.textContent = '';
            });
        });

        signupNext.addEventListener('click', () => {
            if (validateRequiredFields()) showStep(2);
        });

        document.getElementById('signup-back').addEventListener('click', () => showStep(1));

        signupForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!validateRequiredFields()) {
                showStep(1);
                return;
            }

            if (!terms.checked) {
                document.getElementById('terms-error').textContent = 'You must accept the terms.';
                terms.focus();
                return;
            }

            try {
                signupButton.disabled = true;
                signupButton.textContent = 'Creating account...';

                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: username.value.trim(),
                        email: signupEmail.value.trim(),
                        password: signupPassword.value,
                        fullName: document.getElementById('fullName').value.trim(),
                        phone: document.getElementById('phone').value.trim(),
                        address: document.getElementById('address').value.trim(),
                        birthday: document.getElementById('birthday').value || null,
                        bio: document.getElementById('bio').value.trim()
                    })
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    showToast(data.message || 'Unable to create account.', 'error');
                    return;
                }

                window.location.href = `/verify-otp?email=${encodeURIComponent(data.email)}&message=${encodeURIComponent(data.message)}&t=success`;
            } catch (error) {
                console.error('Signup error:', error);
                showToast('An error occurred. Please try again.', 'error');
            } finally {
                signupButton.disabled = false;
                signupButton.textContent = 'Create account';
            }
        });
    }

})