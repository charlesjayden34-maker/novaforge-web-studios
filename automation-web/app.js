const API_BASE = 'https://novaforge-api.onrender.com';

const state = {
  leads: [],
  generatedByIndex: {}
};

const els = {
  authStatus: document.getElementById('authStatus'),
  discoverStatus: document.getElementById('discoverStatus'),
  discoverForm: document.getElementById('discoverForm'),
  saveLeadsBtn: document.getElementById('saveLeadsBtn'),
  downloadCsvBtn: document.getElementById('downloadCsvBtn'),
  location: document.getElementById('location'),
  businessType: document.getElementById('businessType'),
  radiusKm: document.getElementById('radiusKm'),
  limit: document.getElementById('limit'),
  leadsTableBody: document.querySelector('#leadsTable tbody'),
  nextDraftBtn: document.getElementById('nextDraftBtn'),
  nextDraftOutput: document.getElementById('nextDraftOutput')
};

function setAuthStatus(msg, isError = false) {
  els.authStatus.textContent = msg;
  els.authStatus.style.color = isError ? '#fda4af' : '#94a3b8';
}

function setDiscoverStatus(msg, isError = false) {
  els.discoverStatus.textContent = msg;
  els.discoverStatus.style.color = isError ? '#fda4af' : '#94a3b8';
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data.error || `Request failed (${res.status})`));
  return data;
}

function toCsvCell(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function csvFromLeads(leads, generatedByIndex) {
  const header = [
    'businessName',
    'ownerName',
    'email',
    'phone',
    'optIn',
    'replied',
    'hasWebsite',
    'location',
    'mapsUrl',
    'subject',
    'emailBody'
  ].join(',');
  const rows = leads.map((lead, index) =>
    [
      toCsvCell(lead.businessName),
      toCsvCell(lead.ownerName),
      toCsvCell(lead.email),
      toCsvCell(lead.phone),
      toCsvCell('true'),
      toCsvCell('false'),
      toCsvCell(String(lead.hasWebsite)),
      toCsvCell(lead.location),
      toCsvCell(lead.mapsUrl),
      toCsvCell(generatedByIndex[index]?.subject || ''),
      toCsvCell(generatedByIndex[index]?.text || '')
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

async function discoverLeads(e) {
  if (e?.preventDefault) e.preventDefault();
  setDiscoverStatus('Searching real businesses...');
  state.generatedByIndex = {};
  try {
    const data = await apiFetch('/api/research/discover', {
      method: 'POST',
      body: JSON.stringify({
        location: els.location.value.trim() || 'Bridgetown, Barbados',
        businessType: els.businessType.value.trim(),
        radiusKm: Number(els.radiusKm.value || 5),
        limit: Number(els.limit.value || 30)
      })
    });
    state.leads = Array.isArray(data.leads) ? data.leads : [];
    renderLeads();
    els.downloadCsvBtn.disabled = state.leads.length === 0;
    els.saveLeadsBtn.disabled = state.leads.length === 0;
    if (state.leads.length) {
      await saveLeads(true);
      setDiscoverStatus(`Found ${state.leads.length} businesses near ${data.location || ''}.`);
    } else {
      setDiscoverStatus('No leads found for this search. Try another location.');
    }
  } catch (err) {
    state.leads = [];
    renderLeads();
    els.downloadCsvBtn.disabled = true;
    els.saveLeadsBtn.disabled = true;
    setDiscoverStatus(err.message, true);
  }
}

async function generateForLead(index) {
  const lead = state.leads[index];
  if (!lead) return;
  try {
    const generated = await apiFetch('/api/research/generate-email', {
      method: 'POST',
      body: JSON.stringify({ lead, sendCount: 1 })
    });
    state.generatedByIndex[index] = generated;
    renderLeads();
  } catch (err) {
    alert(err.message);
  }
}

function copyEmail(index) {
  const generated = state.generatedByIndex[index];
  if (!generated) return;
  navigator.clipboard.writeText(`Subject: ${generated.subject}\n\n${generated.text}`).catch(() => {});
}

async function saveLeads(silent = false) {
  try {
    const leads = state.leads.map((lead) => ({ ...lead, optIn: true, replied: false }));
    const data = await apiFetch('/api/campaign/save-leads', {
      method: 'POST',
      body: JSON.stringify({ leads })
    });
    if (!silent) {
      setDiscoverStatus(`Saved ${data.count || 0} leads to the campaign queue.`);
    }
  } catch (err) {
    if (!silent) {
      setDiscoverStatus(err.message, true);
    }
  }
}

function downloadCsv() {
  const csv = csvFromLeads(state.leads, state.generatedByIndex);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'automation-research-leads.csv';
  a.click();
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
        ${generated ? `<pre class="json">Subject: ${generated.subject}\n\n${generated.text}</pre>` : ''}
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

function init() {
  setAuthStatus('Connected in auto mode (no login required).');
  discoverLeads({ preventDefault() {} });
}

els.discoverForm.addEventListener('submit', discoverLeads);
els.saveLeadsBtn.addEventListener('click', () => saveLeads(false));
els.downloadCsvBtn.addEventListener('click', downloadCsv);
els.nextDraftBtn.addEventListener('click', getNextDraft);

init();
