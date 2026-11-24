const Forms = (() => {
    function feedback(input, message) {
        let el = input.closest('.form-field')?.querySelector('.invalid-feedback, .field-error');
        if (!el) { el = document.createElement('div'); el.className = 'field-error'; input.after(el); }
        if (message) el.textContent = message;
        el.id ||= `${input.id || input.name}-error`;
        input.setAttribute('aria-describedby', el.id);
        el.hidden = !input.classList.contains('is-invalid');
        return el;
    }
    function summary(container, message, errors = []) {
        if (!container) return;
        container.replaceChildren();
        container.hidden = !message;
        if (!message) return;
        const title = document.createElement('p'); title.className = 'mb-0'; title.textContent = message; container.append(title);
        if (errors.length) {
            const ul = document.createElement('ul');
            errors.forEach(({ input, text }) => {
                const li = document.createElement('li'); const a = document.createElement('a'); a.href = `#${input.id}`; a.textContent = text;
                a.addEventListener('click', event => { event.preventDefault(); input.focus(); }); li.append(a); ul.append(li);
            });
            container.append(ul);
        }
        container.focus();
    }
    function invalid(form, container) {
        const errors = [...form.querySelectorAll('.is-invalid')].map(input => ({input, text: `${form.querySelector(`label[for="${input.id}"]`)?.textContent.trim() || 'Field'}: ${input.closest('.form-field')?.querySelector('.invalid-feedback, .field-error')?.textContent || input.validationMessage}`}));
        summary(container, 'Check the highlighted fields.', errors);
    }
    function serverErrors(form, response, container) {
        const errors = [];
        if (Array.isArray(response.data)) response.data.forEach(item => {
            const input = [...form.querySelectorAll('input,textarea,select')].find(el => el.name === item.path || el.dataset.apiField === item.path);
            if (!input) return;
            const message = item.msg || 'Check this value.';
            input.setCustomValidity(message); input.dataset.serverError = 'true'; input.classList.add('is-invalid'); feedback(input,message).hidden = false;
            errors.push({ input, text: message });
        });
        summary(container, response.message || 'Could not save. Try again.', errors);
    }
    function imageUrl(input) {
        const value = input.value.trim();
        let ok = !value;
        try { ok ||= new URL(value).protocol === 'https:'; } catch {}
        input.setCustomValidity(ok ? '' : 'Use an HTTPS image URL.');
        feedback(input, 'Use an HTTPS image URL.');
        return ok;
    }
    function phone(input, hint) {
        const validate = (format = false) => {
            const value = input.value.trim();
            const parsed = value.startsWith('+') ? window.libphonenumber?.parsePhoneNumberFromString(value) : null;
            const ok = !value || Boolean(parsed?.isValid());
            input.setCustomValidity(ok ? '' : 'Enter a valid phone number including + and its country code.');
            feedback(input, 'Enter a valid number including the country code, for example +1 403 555 0123.');
            if (hint) {
                let country = parsed?.country;
                if (country) { try {country = new Intl.DisplayNames(['en'], {type:'region'}).of(country);} catch {} }
                hint.textContent = parsed?.isValid() ? `${country || 'Shared calling code'} · ${parsed.formatInternational()}` : 'Include + and the country calling code.';
            }
            if (format && parsed?.isValid()) {
                const national = parsed.formatNational();
                input.value = `+${parsed.countryCallingCode} ${national.replace(/^0(?=\d)/, '')}`;
            }
            return ok;
        };
        input.addEventListener('input', () => validate());
        input.addEventListener('blur', () => validate(true));
        validate(true);
        return { valid: () => validate(), number: () => window.libphonenumber?.parsePhoneNumberFromString(input.value)?.number || undefined };
    }
    return {feedback,summary,invalid,serverErrors,imageUrl,phone};
})();
