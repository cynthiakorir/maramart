(function () {
  const API_BASE = 'https://maramart.ethiodeploy.app/api';
  const TOKEN_KEY = 'maramartToken';

  async function request(path, options) {
    const config = options || {};
    const headers = new Headers(config.headers || {});
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.set('Authorization', `Token ${token}`);
    if (config.body && !(config.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, { ...config, headers });
    } catch (error) {
      throw new Error(`Could not connect to the MaraMart API at ${API_BASE}. Check that Django is running and that CORS allows this frontend origin.`);
    }

    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      const detail = data?.error || data?.detail || Object.values(data || {})
        .flat()
        .find((value) => typeof value === 'string');
      throw new Error(detail || `Request failed (${response.status}).`);
    }
    return data;
  }

  function formatPrice(value) {
    const amount = Number(value);
    return `KSh ${Number.isFinite(amount) ? amount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) : '0.00'}`;
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  window.MaraMartAPI = {
    base: API_BASE,
    request,
    formatPrice,
    getToken: () => localStorage.getItem(TOKEN_KEY),
    setToken,
  };
})();
