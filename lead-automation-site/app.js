const storageKeys = {
  apiBase: 'lac_api_base',
  token: 'lac_token',
  user: 'lac_user'
};

const state = {
  leads: [],
  generatedByIndex: {}
};

const els = {
  apiBase: document.getElementById('apiBase'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  authStatus: document.getElementById('authStatus'),
  discoverStatus: document.getElementById('discoverStatus'),
  loginForm: document.getElementById('loginForm'),
  logoutBtn: document.getElementById('logoutBtn'),
  discoverForm: document.getElementById('discoverForm'),
  leadsTableBody: document.querySelector('#leadsTable tbody'),
  downloadCsvBtn: document.getElementById('downloadCsvBtn'),
  location: document.getElementById('location'),
  businessType: document.getElementById('businessType'),
  radiusKm: document.getElementById('radiusKm'),
  limit: document.getElementById('limit'),
  senderName: document.getElementById('senderName'),
  senderBusiness: document.getElementById('senderBusiness'),
  senderWebsite: document.getElementById('senderWebsite'),
  senderCta: document.getElementById('senderCta'),
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

function setDiscoverStatus(msg, isError = false) {
  els.discoverStatus.textContent = msg;
  els.discoverStatus.style.color = isError ? '#fda4af' : '#94a3b8';
}

function safeCell(value) {
  return String(value || '').replace(/"/g, '""');
}

function toCsv(rows) {
  return rows.map((cols) => cols.map((c) => `"${safeCell(c)}"`).join(',')).join('\n');
}

function senderProfile() {
  return {
    yourName: els.senderName.value.trim(),
    yourBusiness: els.senderBusiness.value.trim(),
    yourWebsite: els.senderWebsite.value.trim(),
    callToAction: els.senderCta.value.trim()
  };
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

async function discoverLeads(e) {
  e.preventDefault();
  setDiscoverStatus('Searching...');
  state.generatedByIndex = {};
  try {
    const payload = {
      location: els.location.value.trim(),
      businessType: els.businessType.value.trim(),
      radiusKm: Number(els.radiusKm.value || 5),
      limit: Number(els.limit.value || 30)
    };
    const data = await apiFetch('/api/leads/discover', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.leads = Array.isArray(data.leads) ? data.leads : [];
    renderLeads();
    els.downloadCsvBtn.disabled = state.leads.length === 0;
    setDiscoverStatus(`Found ${state.leads.length} leads near ${data.location || payload.location}.`);
  } catch (err) {
    state.leads = [];
    renderLeads();
    els.downloadCsvBtn.disabled = true;
    setDiscoverStatus(err.message, true);
  }
}

async function generateForLead(index) {
  const lead = state.leads[index];
  if (!lead) return;
  const btn = document.querySelector(`button[data-generate="${index}"]`);
  if (btn) btn.disabled = true;
  try {
    const generated = await apiFetch('/api/leads/generate-email', {
      method: 'POST',
      body: JSON.stringify({
        lead,
        ...senderProfile()
      })
    });
    state.generatedByIndex[index] = generated;
    renderLeads();
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function copyEmail(index) {
  const generated = state.generatedByIndex[index];
  if (!generated) return;
  const text = `Subject: ${generated.subject}\n\n${generated.body}`;
  navigator.clipboard.writeText(text).catch(() => {});
}

function renderLeads() {
  els.leadsTableBody.innerHTML = '';
  state.leads.forEach((lead, index) => {
    const generated = state.generatedByIndex[index];
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${lead.businessName || ''}</td>
      <td>${lead.ownerName || 'Not listed'}</td>
      <td>${lead.email || 'Not listed'}</td>
      <td>${lead.phone || 'Not listed'}</td>
      <td>${lead.location || ''}</td>
      <td>
        <div class="row">
          <button type="button" data-generate="${index}" class="secondary">Generate</button>
          <button type="button" data-copy="${index}" class="secondary" ${generated ? '' : 'disabled'}>Copy</button>
          <a href="${lead.mapsUrl || '#'}" target="_blank" rel="noreferrer">Listing</a>
        </div>
        ${
          generated
            ? `<pre class="json">Subject: ${generated.subject}\n\n${generated.body}</pre>`
            : ''
        }
      </td>
    `;
    els.leadsTableBody.appendChild(row);
  });

  document.querySelectorAll('button[data-generate]').forEach((btn) => {
    btn.addEventListener('click', () => generateForLead(Number(btn.dataset.generate)));
  });
  document.querySelectorAll('button[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => copyEmail(Number(btn.dataset.copy)));
  });
}

function downloadCsv() {
  if (!state.leads.length) return;
  const rows = [
    [
      'businessName',
      'ownerName',
      'email',
      'phone',
      'optIn',
      'replied',
      'hasWebsite',
      'timezone',
      'location',
      'mapsUrl',
      'subject',
      'emailBody',
      'followUpSubject',
      'followUpBody'
    ]
  ];

  state.leads.forEach((lead, index) => {
    const generated = state.generatedByIndex[index] || {};
    const businessName = lead.businessName || 'your business';
    const ownerName = lead.ownerName || '';
    const senderName = els.senderName.value.trim() || 'Your Name';
    const cta =
      els.senderCta.value.trim() ||
      'If you are open to it, I can share a quick homepage plan tailored to your business.';
    const followUpSubject = `Following up: ${businessName} website idea`;
    const followUpBody = [
      ownerName ? `Hi ${ownerName},` : 'Hi there,',
      '',
      `Quick follow-up in case my earlier note about ${businessName} got buried.`,
      cta,
      '',
      'Best,',
      senderName
    ].join('\n');

    rows.push([
      lead.businessName || '',
      lead.ownerName || '',
      lead.email || '',
      lead.phone || '',
      'false',
      'false',
      String(lead.hasWebsite ?? false),
      '',
      lead.location || '',
      lead.mapsUrl || '',
      generated.subject || '',
      generated.body || '',
      followUpSubject,
      followUpBody
    ]);
  });

  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lead-automation-export.csv';
  link.click();
  URL.revokeObjectURL(url);
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
els.discoverForm.addEventListener('submit', discoverLeads);
els.downloadCsvBtn.addEventListener('click', downloadCsv);
els.nextDraftBtn.addEventListener('click', getNextDraft);

initFromStorage();
