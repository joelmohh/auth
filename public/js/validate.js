const Validate = (() => {
    function check(el) {
        if (el.dataset.match) el.setCustomValidity(el.value === document.querySelector(el.dataset.match)?.value ? '' : 'Passwords do not match.');
        const ok = el.checkValidity();
        el.classList.toggle('is-invalid', !ok);
        el.setAttribute('aria-invalid', String(!ok));
        const feedback = el.closest('.form-field')?.querySelector('.invalid-feedback, .field-error');
        if (feedback) {
            feedback.id ||= `${el.id || el.name}-error`;
            if (!ok) el.setAttribute('aria-describedby', feedback.id);
            feedback.hidden = ok;
        }
        return ok;
    }
    function group(container) {
        const fields = [...container.querySelectorAll('input:not([type=hidden]), textarea, select')].filter(el => !el.disabled && !el.closest('.otp'));
        const ok = fields.map(check).every(Boolean);
        if (!ok) container.querySelector('.is-invalid')?.focus();
        return ok;
    }
    document.addEventListener('focusout', e => { if (e.target.matches?.('.form-control') && e.target.value !== '') check(e.target); });
    document.addEventListener('input', e => {
        const el = e.target;
        if (el.dataset.serverError) { delete el.dataset.serverError; el.setCustomValidity(''); }
        if (el.matches?.('.is-invalid')) check(el);
        if (el.id) document.querySelectorAll(`[data-match="#${el.id}"]`).forEach(m => m.value && check(m));
    });
    return { group, check };
})();
