require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const WORLD_CACHE_FILE = path.join(DATA_DIR, 'world-cache.json');
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/cgi/interpreter'
];
const WORLD_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const WORLD_CITIES = [
  { label: 'New York, USA', lat: 40.7128, lon: -74.006 },
  { label: 'London, UK', lat: 51.5072, lon: -0.1276 },
  { label: 'Toronto, Canada', lat: 43.6532, lon: -79.3832 },
  { label: 'Sao Paulo, Brazil', lat: -23.5505, lon: -46.6333 },
  { label: 'Lagos, Nigeria', lat: 6.5244, lon: 3.3792 },
  { label: 'Dubai, UAE', lat: 25.2048, lon: 55.2708 },
  { label: 'Mumbai, India', lat: 19.076, lon: 72.8777 },
  { label: 'Sydney, Australia', lat: -33.8688, lon: 151.2093 },
  { label: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { label: 'Johannesburg, South Africa', lat: -26.2041, lon: 28.0473 },
  { label: 'Mexico City, Mexico', lat: 19.4326, lon: -99.1332 },
  { label: 'Paris, France', lat: 48.8566, lon: 2.3522 }
];

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((v) => v.trim()) : true
  })
);
app.use(express.json({ limit: '1mb' }));

function safeString(value, max = 200) {
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function looksLikePhone(value) {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  return raw.length >= 7;
}

function firstContactMethod(lead) {
  if (isLikelyEmail(lead.email)) return { type: 'email', value: lead.email };
  if (looksLikePhone(lead.phone)) return { type: 'phone', value: lead.phone };
  if (safeString(lead.whatsapp, 80)) return { type: 'whatsapp', value: lead.whatsapp };
  if (safeString(lead.instagram, 120)) return { type: 'instagram', value: lead.instagram };
  if (safeString(lead.facebook, 120)) return { type: 'facebook', value: lead.facebook };
  return { type: 'listing', value: lead.mapsUrl || '' };
}

function isContactableLead(lead) {
  return (
    isLikelyEmail(lead.email) ||
    looksLikePhone(lead.phone) ||
    !!safeString(lead.whatsapp, 80) ||
    !!safeString(lead.instagram, 120) ||
    !!safeString(lead.facebook, 120)
  );
}

function buildAddress(tags) {
  const line1 = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const line2 = [tags['addr:city'], tags['addr:state'], tags['addr:country']].filter(Boolean).join(', ');
  return firstNonEmpty([line1, line2]);
}

function getLeadFromElement(element, fallbackLocationLabel) {
  const tags = element.tags || {};
  const lat = Number(element?.lat || element?.center?.lat);
  const lon = Number(element?.lon || element?.center?.lon);
  const businessName = firstNonEmpty([tags.name, tags.brand, tags.operator, tags.official_name]);
  if (!businessName || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const location = buildAddress(tags) || fallbackLocationLabel;
  const instagram = firstNonEmpty([tags['contact:instagram'], tags.instagram]);
  const facebook = firstNonEmpty([tags['contact:facebook'], tags.facebook]);
  const whatsapp = firstNonEmpty([tags['contact:whatsapp'], tags.whatsapp]);
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
    whatsapp,
    instagram,
    facebook,
    location,
    sourceRegion: fallbackLocationLabel,
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
    err.statusCode = response.status === 429 ? 429 : response.status >= 400 && response.status < 500 ? 400 : 502;
    throw err;
  }
  return response.json();
}

async function fetchOverpassWithFallback(payloadBody) {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      return await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payloadBody,
        signal: AbortSignal.timeout(9000)
      });
    } catch (err) {
      lastError = err;
      if (Number(err?.statusCode) === 429) continue;
    }
  }
  throw lastError || new Error('All overpass endpoints failed');
}

async function discoverAroundCoordinates({ lat, lon, locationLabel, businessType, radiusKm, limit }) {
  const radiusMeters = Math.min(Math.round(radiusKm * 1000), 30000);
  const maxRows = Math.min(Math.max(Math.floor(limit), 1), 80);
  const typeRegex = safeString(businessType, 60).replace(/[^a-z0-9\s&\-]/gi, '');
  const tagFilters = typeRegex
    ? [`["shop"~"${typeRegex}",i]`, `["amenity"~"${typeRegex}",i]`, `["office"~"${typeRegex}",i]`]
    : ['["shop"]', '["amenity"]', '["office"]', '["craft"]', '["tourism"]', '["leisure"]'];

  const selectors = [];
  for (const filter of tagFilters) {
    selectors.push(
      `  node(around:${radiusMeters},${lat},${lon})["name"]${filter}["website"!~"."]["contact:website"!~"."]["url"!~"."];`
    );
    selectors.push(
      `  way(around:${radiusMeters},${lat},${lon})["name"]${filter}["website"!~"."]["contact:website"!~"."]["url"!~"."];`
    );
    selectors.push(
      `  relation(around:${radiusMeters},${lat},${lon})["name"]${filter}["website"!~"."]["contact:website"!~"."]["url"!~"."];`
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
  const data = await fetchOverpassWithFallback(payload.toString());

  const unique = new Map();
  for (const element of Array.isArray(data.elements) ? data.elements : []) {
    const lead = getLeadFromElement(element, locationLabel);
    if (!lead) continue;
    const key = `${lead.businessName.toLowerCase()}-${lead.lat.toFixed(4)}-${lead.lon.toFixed(4)}`;
    if (!unique.has(key)) unique.set(key, lead);
  }
  return Array.from(unique.values()).filter((lead) => isContactableLead(lead)).slice(0, maxRows);
}

function loadWorldCache() {
  const cache = readJson(WORLD_CACHE_FILE, null);
  if (!cache || !Array.isArray(cache.leads)) return null;
  return cache;
}

function cacheFresh(cache) {
  if (!cache?.updatedAt) return false;
  const ts = new Date(cache.updatedAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < WORLD_CACHE_TTL_MS;
}

async function discoverWorldwide({ businessType, limit }) {
  const cached = loadWorldCache();
  if (cached && cacheFresh(cached)) {
    return {
      leads: (cached.leads || []).filter((lead) => isLikelyEmail(lead.email)).slice(0, limit),
      source: 'cache_fresh',
      scannedRegions: cached.scannedRegions || []
    };
  }

  const combined = [];
  const seen = new Set();
  const scannedRegions = [];
  const startedAt = Date.now();
  const maxScanMs = 25000;

  for (const city of WORLD_CITIES) {
    if (Date.now() - startedAt > maxScanMs) break;
    if (combined.length >= limit) break;
    try {
      const leads = await discoverAroundCoordinates({
        lat: city.lat,
        lon: city.lon,
        locationLabel: city.label,
        businessType,
        radiusKm: 8,
        limit: 25
      });
      scannedRegions.push(city.label);
      for (const lead of leads) {
        const key = `${lead.businessName.toLowerCase()}-${lead.lat.toFixed(4)}-${lead.lon.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        combined.push(lead);
        if (combined.length >= limit) break;
      }
      await sleep(500);
    } catch (err) {
      if (Number(err?.statusCode) === 429) {
        if (cached?.leads?.length) {
          return {
            leads: (cached.leads || []).filter((lead) => isLikelyEmail(lead.email)).slice(0, limit),
            source: 'cache_stale_fallback',
            scannedRegions: cached.scannedRegions || [],
            warning: 'Using cached results due to temporary upstream rate limits.'
          };
        }
        return {
          leads: [],
          source: 'rate_limited',
          scannedRegions,
          warning: 'Upstream provider rate-limited requests. Please retry shortly.'
        };
      }
    }
  }

  if (combined.length) {
    writeJson(WORLD_CACHE_FILE, {
      updatedAt: new Date().toISOString(),
      scannedRegions,
      leads: combined
    });
  } else if (cached?.leads?.length) {
    return {
      leads: (cached.leads || []).filter((lead) => isContactableLead(lead)).slice(0, limit),
      source: 'cache_stale_fallback',
      scannedRegions: cached.scannedRegions || [],
      warning: 'Using cached results while live scan warms up.'
    };
  }

  return { leads: combined.slice(0, limit), source: 'live_scan', scannedRegions };
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

app.post('/api/research/discover', async (req, res, next) => {
  try {
    const limit = parsePositiveNumber(req.body?.limit, 40);
    const businessType = safeString(req.body?.businessType, 60);
    const result = await discoverWorldwide({ businessType, limit });
    return res.json({
      locationMode: 'worldwide',
      scannedRegions: result.scannedRegions,
      source: result.source,
      warning: result.warning || '',
      count: result.leads.length,
      leads: result.leads.map((lead) => ({
        ...lead,
        preferredContact: firstContactMethod(lead)
      }))
    });
  } catch (e) {
    next(e);
  }
});

app.post('/api/research/generate-email', (req, res) => {
  const lead = req.body?.lead || {};
  const businessName = safeString(lead.businessName, 120);
  if (!businessName) return res.status(400).json({ error: 'lead.businessName is required' });
  const sendCount = parsePositiveNumber(req.body?.sendCount, 1);
  return res.json(buildEmailDraft(lead, sendCount));
});

app.post('/api/campaign/save-leads', (req, res) => {
  const leads = Array.isArray(req.body?.leads) ? req.body.leads : [];
  writeJson(LEADS_FILE, { updatedAt: new Date().toISOString(), leads });
  return res.json({ ok: true, count: leads.length });
});

app.post('/api/campaign/next-email', (req, res) => {
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

app.post('/api/campaign/mark-sent', (req, res) => {
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

app.post('/api/campaign/mark-replied', (req, res) => {
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
