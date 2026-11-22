const Validate = (() => {
    function check(el) {
        if (el.dataset.match) {
            el.setCustomValidity(el.value === document.querySelector(el.dataset.match)?.value ? '' : 'Mismatch');
        }
        const ok = el.checkValidity();
        el.classList.toggle('is-invalid', !ok);
        return ok;
    }

    function group(container) {
        const fields = [...container.querySelectorAll('input:not([type=hidden]), textarea, select')]
            .filter((el) => !el.closest('.otp'));
        const ok = fields.map(check).every(Boolean);
        container.querySelector('.is-invalid')?.focus();
        return ok;
    }

    document.addEventListener('focusout', (e) => {
        if (e.target.matches?.('.form-control') && e.target.value !== '') check(e.target);
    });
    document.addEventListener('input', (e) => {
        const el = e.target;
        if (el.matches?.('.is-invalid')) check(el);
        if (el.id) document.querySelectorAll(`[data-match="#${el.id}"]`).forEach((m) => m.value && check(m));
    });

    return { group };
})();
