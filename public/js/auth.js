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

    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';

        const email = document.getElementById('email')
        const password = document.getElementById('password')
        const remember = document.getElementById('remember').checked;
        
        if (!email.value || !password.value) {
            showToast('Please fill in all fields.', 'error');
            return;
        }

        try {

            if( password.value.length < 6 ) {
                password.focus();
                password.classList.add('invalid-feedback');
                showToast('Login functionality is currently disabled for demonstration purposes.', 'info');
                return;
            }

            /*const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                window.location.href = '/dashboard'; 
            } else {
                alert(data.message);
            }*/
           
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });

})