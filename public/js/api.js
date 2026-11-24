const Api = (() => {
    let token = null;
    let refreshing = null;

    function refresh() {
        refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => (token = d?.accessToken ?? null))
            .catch(() => (token = null))
            .finally(() => (refreshing = null));
        return refreshing;
    }

    async function call(method, url, body, auth = true, retry = true, raw = false) {
        if (auth && !token) await refresh();
        if (auth && !token) {
            const back = location.pathname + location.search;
            location.href = '/login?redirect=' + encodeURIComponent(back);
            return { success: false };
        }

        let res;
        try {
            res = await fetch(url, {
                method,
                credentials: 'same-origin',
                headers: { 'Content-Type': raw ? body.type : 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
                body: body ? (raw ? body : JSON.stringify(body)) : undefined
            });
        } catch {
            return { success: false, status: 0, message: 'Network error. Check your connection.' };
        }

        if (res.status === 401 && auth && retry) {
            token = null;
            return call(method, url, body, auth, false, raw);
        }

        const data = await res.json().catch(() => ({}));
        if (!data.message && res.status === 429) data.message = 'Too many requests. Try again in a few minutes.';
        return { ...data, success: res.ok && data.success !== false, status: res.status };
    }

    return {
        upload: (url, file) => call('POST', url, file, true, true, true),
        get: (url, auth = true) => call('GET', url, null, auth),
        post: (url, body, auth = true) => call('POST', url, body, auth),
        patch: (url, body) => call('PATCH', url, body),
        put: (url, body) => call('PUT', url, body),
        delete: (url) => call('DELETE', url)
    };
})();
