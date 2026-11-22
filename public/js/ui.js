document.documentElement.dataset.bsTheme = 'dark';

document.addEventListener('DOMContentLoaded', () => {

    document.querySelectorAll('[data-bs-toggle="menu"]').forEach((btn) => {
        const menu = btn.parentElement?.querySelector('.menu');
        if (!menu) return;
        btn.setAttribute('aria-haspopup', 'menu');
        btn.setAttribute('aria-expanded', 'false');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = menu.classList.toggle('open');
            btn.setAttribute('aria-expanded', String(open));
            if (open) menu.querySelector('.menu-item')?.focus();
        });
        menu.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { menu.classList.remove('open'); btn.focus(); }
        });
    });
    document.addEventListener('click', () => {
        document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
    });

    document.querySelectorAll('[data-bs-toggle="drawer"]').forEach((btn) => {
        const target = document.querySelector(btn.dataset.bsTarget || btn.getAttribute('data-bs-target'));
        if (!(target instanceof HTMLDialogElement)) return;
        btn.addEventListener('click', () => target.showModal());
        target.addEventListener('click', (e) => { if (e.target === target) target.close(); });
        target.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => target.close()));
    });

    document.querySelectorAll('dialog [data-close]').forEach((btn) => {
        btn.addEventListener('click', () => btn.closest('dialog')?.close());
    });

    document.querySelectorAll('input[type="password"]').forEach((input) => {
        const bar = input.parentElement?.querySelector('[data-bs-strength]');
        if (!bar) return;
        input.addEventListener('input', () => {
            const v = input.value;
            let score = 0;
            if (v.length >= 8) score += 40;
            if (v.length >= 12) score += 20;
            if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score += 15;
            if (/\d/.test(v)) score += 15;
            if (/[^A-Za-z0-9]/.test(v)) score += 10;
            bar.style.setProperty('--strength', `${Math.min(score, 100)}%`);
            bar.style.setProperty('--strength-color',
                score >= 75 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)');
        });
    });

    document.querySelectorAll('.otp-input').forEach((input) => {
        input.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '').slice(0, 6);
        });
    });
});
