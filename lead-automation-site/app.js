const storageKeys = {
  apiBase: 'lac_api_base',
  token: 'lac_token',
  user: 'lac_user'
};

const els = {
  apiBase: document.getElementById('apiBase'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  authStatus: document.getElementById('authStatus'),
  loginForm: document.getElementById('loginForm'),
  logoutBtn: document.getElementById('logoutBtn'),
  nextDraftBtn: document.getElementById('nextDraftBtn'),
  nextDraftOutput: document.getElementById('nextDraftOutput')
};

function normalizeBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getToken() {
  return localStorage.getItem(storageKeys.token) || '';
}

function getApiBase() {
  return normalizeBase(els.apiBase.value || localStorage.getItem(storageKeys.apiBase) || '');
}

function setAuthStatus(msg, isError = false) {
  els.authStatus.textContent = msg;
  els.authStatus.style.color = isError ? '#fda4af' : '#94a3b8';
}

async function apiFetch(path, options = {}) {
  const base = getApiBase();
  if (!base) throw new Error('Set API base URL first.');
  const token = getToken();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data.error || `Request failed (${res.status})`));
  }
  return data;
}

async function login(e) {
  e.preventDefault();
  const base = getApiBase();
  localStorage.setItem(storageKeys.apiBase, base);

  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: els.email.value.trim(),
        password: els.password.value
      }),
      headers: {}
    });
    localStorage.setItem(storageKeys.token, data.token);
    localStorage.setItem(storageKeys.user, JSON.stringify(data.user || {}));
    setAuthStatus(`Signed in as ${data.user?.email || 'user'}`);
  } catch (err) {
    setAuthStatus(err.message, true);
  }
}

function logout() {
  localStorage.removeItem(storageKeys.token);
  localStorage.removeItem(storageKeys.user);
  setAuthStatus('Logged out.');
}

async function getNextDraft() {
  els.nextDraftOutput.textContent = 'Loading...';
  try {
    const data = await apiFetch('/api/campaign/next-email', {
      method: 'POST',
      body: JSON.stringify({})
    });
    els.nextDraftOutput.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    els.nextDraftOutput.textContent = err.message;
  }
}

function initFromStorage() {
  els.apiBase.value = localStorage.getItem(storageKeys.apiBase) || 'https://orvanta-api.onrender.com';
  const userRaw = localStorage.getItem(storageKeys.user);
  if (getToken() && userRaw) {
    try {
      const user = JSON.parse(userRaw);
      setAuthStatus(`Signed in as ${user?.email || 'user'}`);
    } catch {
      setAuthStatus('Ready.');
    }
  } else {
    setAuthStatus('Not signed in.');
  }
}

els.loginForm.addEventListener('submit', login);
els.logoutBtn.addEventListener('click', logout);
els.nextDraftBtn.addEventListener('click', getNextDraft);

initFromStorage();
