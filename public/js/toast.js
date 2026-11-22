const TOAST_TYPES = { info: 'theme-info', success: 'theme-success', error: 'theme-danger', warning: 'theme-warning' };

function getToastContainer() {
    let c = document.querySelector('.toast-container');
    if (!c) {
        c = document.createElement('div');
        c.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(c);
    }
    return c;
}

function showToast(message, type = 'info', duration = 4000) {
    const t = document.createElement('div');
    t.className = `toast show ${TOAST_TYPES[type] || TOAST_TYPES.info}`;
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.tabIndex = 0;
    t.textContent = message || 'Something went wrong.';
    const close = () => t.remove();
    t.addEventListener('click', close);
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') close(); });
    getToastContainer().appendChild(t);
    setTimeout(close, duration);
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    if (params.has('message')) {
        showToast(params.get('message'), params.get('t') || 'info');
        history.replaceState({}, document.title, location.pathname);
    }
});
