document.addEventListener('DOMContentLoaded', function () {

    // toggle password visibility
    document.querySelectorAll('.input-icon-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });

})