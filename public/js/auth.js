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

    // login form validation and submission

    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');

    const email = document.getElementById('email');
    const password = document.getElementById('password');

    const errorMessages = {
        email: document.getElementById('email-error'),
        password: document.getElementById('password-error')
    };

    [email, password].forEach((input) => {
        input.addEventListener('input', () => {
            input.classList.remove('invalid');
            input.setAttribute('aria-invalid', 'false');
            errorMessages[input.id].textContent = '';
        });
    });

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
            } else {
                if(data.success === false || response.status === 401){
                    showToast(data.message || 'Invalid credentials. Please try again.', 'error');
                    errorMessages.email.classList.add('text-danger');
                    errorMessages.password.classList.add('text-danger');
                    errorMessages.email.textContent = 'Invalid email or password.';
                    errorMessages.password.textContent = 'Invalid email or password.';
                } else if(data.verified === false){
                    window.location.href = `/verify-otp?message=${encodeURIComponent('Account not verified. Please verify your account.')}&t=error`;
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

    // signup form validation and submission

    const signupForm = document.getElementById('signup-form');
    const signupButton = document.getElementById('signup-button');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullname = document.getElementById('name');
        const email = document.getElementById('email');
        const password = document.getElementById('password');

        const fullnameIsInvalid = !fullname.value.trim();
        const emailIsInvalid = !email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
        const passwordIsInvalid = !password.value || password.value.length < 6;

        fullname.classList.toggle('invalid', fullnameIsInvalid);
        email.classList.toggle('invalid', emailIsInvalid);
        password.classList.toggle('invalid', passwordIsInvalid);

        if (fullnameIsInvalid || emailIsInvalid || passwordIsInvalid) {
            if (fullnameIsInvalid) fullname.focus();
            else if (emailIsInvalid) email.focus();
            else password.focus();

            document.getElementById('fullname-error').textContent = fullnameIsInvalid ? 'Full name is required.' : '';
            document.getElementById('email-error').textContent = emailIsInvalid ? 'Valid email is required.' : '';
            document.getElementById('password-error').textContent = passwordIsInvalid ? 'Password must be at least 6 characters.' : '';
            return;
        }

        try {
            signupButton.disabled = true;
            signupButton.textContent = 'Signing up...';

            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullname: fullname.value, email: email.value, password: password.value })
            });

            const data = await response.json();

            if (data.success) {
                window.location.href = `/verify-otp?message=${encodeURIComponent('Signup successful. Please check your email to verify your account.')}&t=success`;
            } else {
                showToast(data.message || 'An error occurred. Please try again.', 'error');
            }

        } catch (error) {
            console.error('Error:', error);
            showToast('An error occurred. Please try again.', 'error');
        } finally {
            signupButton.disabled = false;
            signupButton.textContent = 'Create account';
        }
    });

})