const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_RADIUS_KM = 30;
const MAX_RESULTS = 120;

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function safeString(value, max = 120) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function cleanRegexValue(value) {
  return safeString(value, 60).replace(/[^a-z0-9\s&\-]/gi, '');
}

function firstNonEmpty(values) {
  for (const value of values) {
    const normalized = safeString(value, 160);
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
  if (!businessName) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const ownerName = firstNonEmpty([tags.owner, tags['contact:person'], tags.operator]);
  const email = firstNonEmpty([tags.email, tags['contact:email']]).toLowerCase();
  const phone = firstNonEmpty([
    tags.phone,
    tags['contact:phone'],
    tags['phone:mobile'],
    tags.mobile,
    tags['contact:mobile']
  ]);
  const location = buildAddress(tags);

  return {
    businessName,
    ownerName,
    email,
    phone,
    location,
    hasWebsite: false,
    source: 'openstreetmap',
    lat,
    lon,
    mapsUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'OrvantaLeadFinder/1.0',
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(text || `Upstream request failed (${response.status})`);
    err.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw err;
  }

  return response.json();
}

async function geocodeLocation(location) {
  const query = new URLSearchParams({
    q: location,
    format: 'jsonv2',
    limit: '1'
  });
  const url = `${NOMINATIM_URL}?${query.toString()}`;
  const results = await fetchJson(url);
  if (!Array.isArray(results) || results.length === 0) return null;

  const place = results[0];
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    lat,
    lon,
    displayName: safeString(place.display_name, 200)
  };
}

async function searchBusinessesWithoutWebsite({ lat, lon, radiusKm, limit, businessType }) {
  const radiusMeters = Math.min(Math.round(radiusKm * 1000), MAX_RADIUS_KM * 1000);
  const finalLimit = Math.min(Math.floor(limit), MAX_RESULTS);
  const typeRegex = cleanRegexValue(businessType);
  const tagFilters = typeRegex
    ? [`["shop"~"${typeRegex}",i]`, `["amenity"~"${typeRegex}",i]`, `["office"~"${typeRegex}",i]`]
    : ['["shop"]', '["amenity"]', '["office"]', '["craft"]', '["tourism"]', '["leisure"]'];

  const selectorLines = [];
  for (const tagFilter of tagFilters) {
    selectorLines.push(
      `  node(around:${radiusMeters},${lat},${lon})["name"]${tagFilter}["website"!~"."]["contact:website"!~"."]["url"!~"."];`
    );
    selectorLines.push(
      `  way(around:${radiusMeters},${lat},${lon})["name"]${tagFilter}["website"!~"."]["contact:website"!~"."]["url"!~"."];`
    );
    selectorLines.push(
      `  relation(around:${radiusMeters},${lat},${lon})["name"]${tagFilter}["website"!~"."]["contact:website"!~"."]["url"!~"."];`
    );
  }

  const query = `
[out:json][timeout:25];
(
${selectorLines.join('\n')}
);
out center tags ${finalLimit};
`;

  const payload = new URLSearchParams({ data: query });
  const result = await fetchJson(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString()
  });

  const elements = Array.isArray(result?.elements) ? result.elements : [];
  const unique = new Map();
  for (const element of elements) {
    const lead = getLeadFromElement(element);
    if (!lead) continue;
    const key = `${lead.businessName.toLowerCase()}-${lead.lat.toFixed(4)}-${lead.lon.toFixed(4)}`;
    if (!unique.has(key)) {
      unique.set(key, lead);
    }
  }

  return Array.from(unique.values()).slice(0, finalLimit);
}

function buildOutreachEmail({ lead, yourName, yourBusiness, yourWebsite, callToAction }) {
  const businessName = safeString(lead.businessName, 120) || 'your business';
  const ownerName = safeString(lead.ownerName, 120);
  const greeting = ownerName ? `Hi ${ownerName},` : 'Hi there,';
  const signer = safeString(yourName, 80) || 'Your Name';
  const senderBusiness = safeString(yourBusiness, 80) || 'My web studio';
  const senderWebsite = safeString(yourWebsite, 120);
  const cta = safeString(callToAction, 220) || 'Would you like me to send a few ideas for your homepage?';

  const subject = `${businessName}: quick website idea`;
  const lines = [
    greeting,
    '',
    `I came across ${businessName} and noticed there does not seem to be an active website listed yet.`,
    `${senderBusiness} helps local businesses launch simple, high-converting websites so customers can find services, hours, and contact details quickly.`,
    '',
    cta,
    '',
    senderWebsite ? `Portfolio: ${senderWebsite}` : '',
    `Best,`,
    signer
  ].filter(Boolean);

  return {
    subject,
    body: lines.join('\n')
  };
}

router.use(requireAuth);

router.post('/discover', async (req, res, next) => {
  try {
    const location = safeString(req.body?.location, 120);
    if (!location) return res.status(400).json({ error: 'location is required' });

    const radiusKm = Math.min(toPositiveNumber(req.body?.radiusKm, 5), MAX_RADIUS_KM);
    const limit = Math.min(Math.floor(toPositiveNumber(req.body?.limit, 30)), MAX_RESULTS);
    const businessType = safeString(req.body?.businessType, 60);

    const geocoded = await geocodeLocation(location);
    if (!geocoded) return res.status(404).json({ error: 'Location not found' });

    const leads = await searchBusinessesWithoutWebsite({
      lat: geocoded.lat,
      lon: geocoded.lon,
      radiusKm,
      limit,
      businessType
    });

    return res.json({
      location: geocoded.displayName,
      count: leads.length,
      leads
    });
  } catch (e) {
    next(e);
  }
});

router.post('/generate-email', (req, res) => {
  const lead = req.body?.lead || {};
  const businessName = safeString(lead.businessName, 120);
  if (!businessName) {
    return res.status(400).json({ error: 'lead.businessName is required' });
  }

  const generated = buildOutreachEmail({
    lead,
    yourName: req.body?.yourName,
    yourBusiness: req.body?.yourBusiness,
    yourWebsite: req.body?.yourWebsite,
    callToAction: req.body?.callToAction
  });

  return res.json(generated);
});

module.exports = { leadsRouter: router };
