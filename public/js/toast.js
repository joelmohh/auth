function getToastContainer() {
    let toastContainer = document.querySelector('.toast-container');

    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    return toastContainer;
}

function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = getToastContainer();
    const toast = document.createElement('div');
    const allowedTypes = ['info', 'success', 'error', 'warning'];

    toast.className = `toast ${allowedTypes.includes(type) ? type : 'info'}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;

    toastContainer.appendChild(toast);

    const timeout = window.setTimeout(() => closeToast(toast), duration);
    const dismiss = () => {
        window.clearTimeout(timeout);
        closeToast(toast);
    };

    toast.addEventListener('click', dismiss);
    toast.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') dismiss();
    });
}

function closeToast(toast) {
    if (toast && toast.isConnected) toast.remove();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.search.includes('message=')) {
        const params = new URLSearchParams(window.location.search);
        const message = params.get('message');
        const type = params.get('t') || 'info';
        showToast(message, type);

        // Remove the query parameters from the URL without reloading the page
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
})