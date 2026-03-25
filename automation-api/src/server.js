require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((v) => v.trim()) : true
  })
);
app.use(express.json({ limit: '1mb' }));

function safeString(value, max = 160) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function boolish(v) {
  return String(v || '').trim().toLowerCase() === 'true';
}

function parsePositiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 24) throw new Error('JWT_SECRET must be configured');
  return secret;
}

function signAdminToken(email) {
  return jwt.sign({ sub: email, role: 'admin' }, getJwtSecret(), { expiresIn: '7d' });
}

function requireAdmin(req, res, next) {
  try {
    const [type, token] = String(req.headers.authorization || '').split(' ');
    if (type !== 'Bearer' || !token) return res.status(401).json({ error: 'Unauthorized' });
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.admin = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function firstNonEmpty(values) {
  for (const value of values) {
    const normalized = safeString(value, 220);
    if (normalized) return normalized;
  }
  return '';
}

function buildAddress(tags) {
  const line1 = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const line2 = [tags['addr:city'], tags['addr:state'], tags['addr:country']].filter(Boolean).join(', ');
  return firstNonEmpty([line1, line2]);
}

function getLeadFromElement(element) {
  const tags = element.tags || {};
  const lat = Number(element?.lat || element?.center?.lat);
  const lon = Number(element?.lon || element?.center?.lon);
  const businessName = firstNonEmpty([tags.name, tags.brand, tags.operator, tags.official_name]);
  if (!businessName || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    businessName,
    ownerName: firstNonEmpty([tags.owner, tags['contact:person'], tags.operator]),
    email: firstNonEmpty([tags.email, tags['contact:email']]).toLowerCase(),
    phone: firstNonEmpty([
      tags.phone,
      tags['contact:phone'],
      tags['phone:mobile'],
      tags.mobile,
      tags['contact:mobile']
    ]),
    location: buildAddress(tags),
    hasWebsite: false,
    source: 'openstreetmap',
    lat,
    lon,
    mapsUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`,
    optIn: false
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'AutomationResearch/1.0',
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(text || `Request failed (${response.status})`);
    err.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw err;
  }
  return response.json();
}

async function geocodeLocation(location) {
  const query = new URLSearchParams({ q: location, format: 'jsonv2', limit: '1' });
  const result = await fetchJson(`${NOMINATIM_URL}?${query.toString()}`);
  if (!Array.isArray(result) || result.length === 0) return null;
  const first = result[0];
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, displayName: safeString(first.display_name, 220) };
}

async function discoverLeads({ location, businessType, radiusKm, limit }) {
  const geo = await geocodeLocation(location);
  if (!geo) return { location: '', leads: [] };

  const radiusMeters = Math.min(Math.round(radiusKm * 1000), 30000);
  const maxRows = Math.min(Math.max(Math.floor(limit), 1), 120);
  const typeRegex = safeString(businessType, 60).replace(/[^a-z0-9\s&\-]/gi, '');
  const tagFilters = typeRegex
    ? [`["shop"~"${typeRegex}",i]`, `["amenity"~"${typeRegex}",i]`, `["office"~"${typeRegex}",i]`]
    : ['["shop"]', '["amenity"]', '["office"]', '["craft"]', '["tourism"]', '["leisure"]'];

  const selectors = [];
  for (const filter of tagFilters) {
    selectors.push(
      `  node(around:${radiusMeters},${geo.lat},${geo.lon})["name"]${filter}["website"!~"."]["contact:website"!~"."]["url"!~"."];`
    );
    selectors.push(
      `  way(around:${radiusMeters},${geo.lat},${geo.lon})["name"]${filter}["website"!~"."]["contact:website"!~"."]["url"!~"."];`
    );
    selectors.push(
      `  relation(around:${radiusMeters},${geo.lat},${geo.lon})["name"]${filter}["website"!~"."]["contact:website"!~"."]["url"!~"."];`
    );
  }

  const query = `
[out:json][timeout:25];
(
${selectors.join('\n')}
);
out center tags ${maxRows};
`;
  const payload = new URLSearchParams({ data: query });
  const data = await fetchJson(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString()
  });

  const unique = new Map();
  for (const element of Array.isArray(data.elements) ? data.elements : []) {
    const lead = getLeadFromElement(element);
    if (!lead) continue;
    const key = `${lead.businessName.toLowerCase()}-${lead.lat.toFixed(4)}-${lead.lon.toFixed(4)}`;
    if (!unique.has(key)) unique.set(key, lead);
  }
  return { location: geo.displayName, leads: Array.from(unique.values()).slice(0, maxRows) };
}

function buildEmailDraft(lead, sendCount = 1) {
  const owner = safeString(lead.ownerName, 80);
  const businessName = safeString(lead.businessName, 120) || 'your business';
  const location = safeString(lead.location, 160);
  const senderName = safeString(process.env.SENDER_NAME, 80) || 'Your Assistant';
  const senderCompany = safeString(process.env.SENDER_COMPANY, 80) || 'Your Company';
  const senderWebsite = safeString(process.env.SENDER_WEBSITE, 160);

  const stage = Math.max(1, Number(sendCount || 1));
  const subject =
    stage === 1
      ? location
        ? `${businessName} in ${location}: quick website idea`
        : `Quick website idea for ${businessName}`
      : `Following up: ${businessName} website idea`;

  const greeting = owner ? `Hi ${owner},` : 'Hi there,';
  const intro =
    stage === 1
      ? location
        ? `I found ${businessName} while researching businesses in ${location}, and noticed no website listed yet.`
        : `I found ${businessName} and noticed no website listed yet.`
      : `Quick follow-up in case my earlier note about ${businessName} got buried.`;

  const body = [
    greeting,
    '',
    intro,
    `${senderCompany} helps businesses launch clean websites so customers can find services, contact info, and hours fast.`,
    '',
    'If you want, I can share a simple one-page outline tailored to your business.',
    lead.mapsUrl ? `Listing reference: ${lead.mapsUrl}` : '',
    senderWebsite ? `Portfolio: ${senderWebsite}` : '',
    '',
    'Best,',
    senderName
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, text: body };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const email = safeString(req.body?.email, 120).toLowerCase();
  const password = String(req.body?.password || '');
  const adminEmail = safeString(process.env.ADMIN_EMAIL, 120).toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  return res.json({
    token: signAdminToken(email),
    user: { email, role: 'admin', name: 'Automation Admin' }
  });
});

app.post('/api/research/discover', requireAdmin, async (req, res, next) => {
  try {
    const location = safeString(req.body?.location, 120);
    if (!location) return res.status(400).json({ error: 'location is required' });
    const radiusKm = parsePositiveNumber(req.body?.radiusKm, 5);
    const limit = parsePositiveNumber(req.body?.limit, 30);
    const businessType = safeString(req.body?.businessType, 60);
    const result = await discoverLeads({ location, businessType, radiusKm, limit });
    return res.json({ location: result.location, count: result.leads.length, leads: result.leads });
  } catch (e) {
    next(e);
  }
});

app.post('/api/research/generate-email', requireAdmin, (req, res) => {
  const lead = req.body?.lead || {};
  const businessName = safeString(lead.businessName, 120);
  if (!businessName) return res.status(400).json({ error: 'lead.businessName is required' });
  const sendCount = parsePositiveNumber(req.body?.sendCount, 1);
  return res.json(buildEmailDraft(lead, sendCount));
});

app.post('/api/campaign/save-leads', requireAdmin, (req, res) => {
  const leads = Array.isArray(req.body?.leads) ? req.body.leads : [];
  writeJson(LEADS_FILE, { updatedAt: new Date().toISOString(), leads });
  return res.json({ ok: true, count: leads.length });
});

app.post('/api/campaign/next-email', requireAdmin, (req, res) => {
  const data = readJson(LEADS_FILE, { leads: [] });
  const state = readJson(STATE_FILE, { contacts: {} });
  const waitDays = parsePositiveNumber(req.body?.waitDays, 5);
  const waitMs = waitDays * 24 * 60 * 60 * 1000;
  const maxSendsPerContact = parsePositiveNumber(req.body?.maxSendsPerContact, 2);
  const nowMs = Date.now();

  for (const lead of data.leads || []) {
    if (!boolish(lead.optIn)) continue;
    const email = safeString(lead.email, 160).toLowerCase();
    if (!email) continue;
    if (!safeString(lead.businessName, 120)) continue;
    if (!['false', 'no', '0', 'none', 'na', 'n/a'].includes(String(lead.hasWebsite || '').toLowerCase())) {
      continue;
    }
    state.contacts[email] = state.contacts[email] || {};
    const contact = state.contacts[email];
    if (contact.replied) continue;
    const sendCount = Number(contact.sendCount || 0);
    if (sendCount >= maxSendsPerContact) continue;
    if (contact.lastSentAt) {
      const last = new Date(contact.lastSentAt).getTime();
      if (!Number.isNaN(last) && nowMs - last < waitMs) continue;
    }
    const nextSendCount = sendCount + 1;
    return res.json({
      ok: true,
      lead,
      sendCount: nextSendCount,
      emailDraft: buildEmailDraft(lead, nextSendCount)
    });
  }

  return res.json({ ok: true, lead: null, emailDraft: null, message: 'No eligible leads found.' });
});

app.post('/api/campaign/mark-sent', requireAdmin, (req, res) => {
  const email = safeString(req.body?.email, 160).toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required' });
  const state = readJson(STATE_FILE, { contacts: {} });
  state.contacts[email] = state.contacts[email] || {};
  state.contacts[email].lastSentAt = new Date().toISOString();
  state.contacts[email].sendCount = Number(state.contacts[email].sendCount || 0) + 1;
  state.contacts[email].lastSubject = safeString(req.body?.subject, 200);
  writeJson(STATE_FILE, state);
  return res.json({ ok: true, email, sendCount: state.contacts[email].sendCount });
});

app.post('/api/campaign/mark-replied', requireAdmin, (req, res) => {
  const email = safeString(req.body?.email, 160).toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required' });
  const state = readJson(STATE_FILE, { contacts: {} });
  state.contacts[email] = state.contacts[email] || {};
  state.contacts[email].replied = true;
  state.contacts[email].replyAt = new Date().toISOString();
  writeJson(STATE_FILE, state);
  return res.json({ ok: true, email });
});

app.use((err, _req, res, _next) => {
  const status = Number(err?.statusCode || 500);
  if (status >= 500) return res.status(500).json({ error: 'Server error' });
  return res.status(status).json({ error: err?.message || 'Request failed' });
});

const port = Number(process.env.PORT || 4100);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Automation API listening on :${port}`);
});
