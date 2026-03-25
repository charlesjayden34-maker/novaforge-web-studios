const express = require('express');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function safeString(value, max = 240) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function boolish(v) {
  return String(v || '')
    .trim()
    .toLowerCase() === 'true';
}

function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((v) => v.trim());
}

function loadLeads(filePath) {
  const abs = path.resolve(process.cwd(), filePath || 'scripts/leads.csv');
  const raw = fs.readFileSync(abs, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    return obj;
  });
}

function loadState(stateFile) {
  const abs = path.resolve(process.cwd(), stateFile || 'scripts/campaign-state.json');
  if (!fs.existsSync(abs)) return { contacts: {} };
  const raw = fs.readFileSync(abs, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.contacts) parsed.contacts = {};
    return parsed;
  } catch {
    return { contacts: {} };
  }
}

function saveState(stateFile, state) {
  const abs = path.resolve(process.cwd(), stateFile || 'scripts/campaign-state.json');
  fs.writeFileSync(abs, JSON.stringify(state, null, 2));
}

function isNoWebsiteFlag(v) {
  const s = String(v || '')
    .trim()
    .toLowerCase();
  return ['false', 'no', '0', 'none', 'n/a', 'na'].includes(s);
}

function normalizeOwnerName(v) {
  const raw = safeString(v, 120);
  const lower = raw.toLowerCase();
  if (!raw) return '';
  if (['unknown', 'n/a', 'na', 'none', '-', '--', 'not listed publicly'].includes(lower)) return '';
  return raw;
}

function extractEmailAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/<([^>]+)>/);
  return String(match ? match[1] : raw).trim().toLowerCase();
}

function isValidEmailBasic(value) {
  const email = extractEmailAddress(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isLikelyRoleAddress(value) {
  const email = extractEmailAddress(value);
  const localPart = email.split('@')[0] || '';
  return /^(info|support|sales|contact|hello|office|admin|team|careers|jobs|hr|billing|accounts?)$/i.test(
    localPart
  );
}

function shouldSend(contactState, nowMs, waitMs, maxSendsPerContact) {
  if (contactState?.replied === true) return false;
  const sendCount = Number(contactState?.sendCount || 0);
  if (sendCount >= maxSendsPerContact) return false;
  if (!contactState?.lastSentAt) return true;
  const last = new Date(contactState.lastSentAt).getTime();
  if (Number.isNaN(last)) return true;
  return nowMs - last >= waitMs;
}

function renderTemplate(template, vars) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_all, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return String(vars[key] || '');
    return '';
  });
}

function inferServiceAngle(lead) {
  const sourceText = [lead.businessType, lead.category, lead.tags, lead.industry, lead.businessName]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');

  if (/(barber|salon|spa|beauty|nail)/.test(sourceText)) return 'appointments, pricing, and service gallery';
  if (/(restaurant|cafe|bakery|food)/.test(sourceText)) return 'menu visibility, opening hours, and bookings';
  if (/(plumb|electri|hvac|repair|contractor|clean)/.test(sourceText))
    return 'fast quote requests and emergency contact visibility';
  if (/(law|legal|consult|agency|studio|account)/.test(sourceText))
    return 'trust-building service pages and qualified inbound leads';
  return 'better search visibility and easier customer contact';
}

function localPartsForTimeZone(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false
  });
  const parts = dtf.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    weekday: map.weekday || '',
    hour: Number(map.hour || 0)
  };
}

function isPopularHourWindow(date, timeZone) {
  try {
    const { weekday, hour } = localPartsForTimeZone(date, timeZone);
    const weekdayUpper = String(weekday).toUpperCase();
    const isWeekday = ['MON', 'TUE', 'WED', 'THU', 'FRI'].includes(weekdayUpper);
    const inMorning = hour >= 9 && hour < 11;
    const inAfternoon = hour >= 13 && hour < 16;
    return isWeekday && (inMorning || inAfternoon);
  } catch {
    return false;
  }
}

function buildDraftForLead(lead, sendCount) {
  const ownerName = normalizeOwnerName(lead.ownerName);
  const businessName = safeString(lead.businessName, 120) || 'your business';
  const location = safeString(lead.location, 160);
  const mapsUrl = safeString(lead.mapsUrl, 240);
  const stage = Math.max(1, Number(sendCount || 1));

  const senderName = safeString(process.env.CAMPAIGN_SENDER_NAME || 'Nathan Whittaker', 80);
  const senderRole = safeString(process.env.CAMPAIGN_SENDER_ROLE || 'Business Partner', 80);
  const senderCompany = safeString(process.env.CAMPAIGN_SENDER_COMPANY || 'Orvanta Studio', 80);
  const senderEmail = safeString(
    process.env.CAMPAIGN_SENDER_EMAIL || process.env.FROM_EMAIL || process.env.SMTP_USER || '',
    120
  );
  const portfolioUrl = safeString(process.env.PUBLIC_SITE_URL || 'https://your-frontend-domain.com', 200);
  const serviceAngle = inferServiceAngle(lead);
  const greeting = ownerName ? `Hi ${ownerName},` : 'Hi there,';

  const vars = {
    ownerName: ownerName || 'there',
    businessName,
    location,
    mapsUrl,
    serviceAngle,
    portfolioUrl,
    senderName,
    senderRole,
    senderCompany,
    senderEmail
  };

  const customSubject =
    stage === 1
      ? renderTemplate(lead.subject, vars)
      : renderTemplate(lead.followUpSubject, vars) || renderTemplate(lead.subject, vars);
  const customBody =
    stage === 1
      ? renderTemplate(lead.emailBody, vars)
      : renderTemplate(lead.followUpBody, vars) || renderTemplate(lead.emailBody, vars);
  if (customSubject && customBody) return { subject: customSubject, text: customBody };

  const subjects = [
    location ? `${businessName} in ${location}: quick website idea` : `Quick website help for ${businessName}`,
    `Following up on ${businessName} website idea`,
    `Last quick check-in for ${businessName}`
  ];
  const intros = [
    location
      ? `I found ${businessName} while looking at businesses in ${location}, and noticed no active website listed yet.`
      : `I came across ${businessName} and noticed no active website listed yet.`,
    `Quick follow-up in case my earlier email about ${businessName} got buried.`,
    `Final quick follow-up from me about helping ${businessName} launch a professional website.`
  ];
  const idx = Math.min(stage - 1, 2);

  return {
    subject: subjects[idx],
    text: [
      greeting,
      '',
      `My name is ${senderName}, ${senderRole} at ${senderCompany}.`,
      '',
      intros[idx],
      `A clean site can help with ${serviceAngle}.`,
      '',
      'If you are open to it, I can share a short 1-page website plan tailored to your business.',
      mapsUrl ? `Listing reference: ${mapsUrl}` : '',
      `Portfolio: ${portfolioUrl}`,
      '',
      'Best regards,',
      senderName,
      `${senderRole}, ${senderCompany}`,
      senderEmail
    ]
      .filter(Boolean)
      .join('\n')
  };
}

async function checkSenderDns(fromAddress) {
  const email = extractEmailAddress(fromAddress);
  const domain = email.split('@')[1] || '';
  if (!domain) return { domain: '', spf: false, dmarc: false, dkim: false };
  const selector = process.env.CAMPAIGN_DKIM_SELECTOR || 'default';

  async function hasTxt(name, testRegex) {
    try {
      const records = await dns.resolveTxt(name);
      const joined = records.map((row) => row.join('')).join(' ').toLowerCase();
      return testRegex.test(joined);
    } catch {
      return false;
    }
  }

  const spf = await hasTxt(domain, /v=spf1/);
  const dmarc = await hasTxt(`_dmarc.${domain}`, /v=dmarc1/);
  const dkim = await hasTxt(`${selector}._domainkey.${domain}`, /v=dkim1|k=rsa|p=/);
  return { domain, spf, dmarc, dkim };
}

router.use(requireAuth);
router.use(requireAdmin);

router.post('/next-email', async (req, res, next) => {
  try {
    const csvFile = safeString(req.body?.file || 'scripts/leads.csv', 200);
    const stateFile = safeString(req.body?.stateFile || 'scripts/campaign-state.json', 200);
    const waitDays = Number(req.body?.waitDays || process.env.CAMPAIGN_WAIT_DAYS || 5);
    const maxSendsPerContact = Number(
      req.body?.maxSendsPerContact || process.env.CAMPAIGN_MAX_SENDS_PER_CONTACT || 2
    );
    const allowRoleAddresses = req.body?.allowRoleAddresses !== undefined
      ? Boolean(req.body?.allowRoleAddresses)
      : boolish(process.env.CAMPAIGN_ALLOW_ROLE_ADDRESSES || 'false');
    const requireOwnerName = req.body?.requireOwnerName !== undefined
      ? Boolean(req.body?.requireOwnerName)
      : boolish(process.env.CAMPAIGN_REQUIRE_OWNER_NAME || 'false');
    const popularHoursOnly = req.body?.popularHoursOnly !== undefined
      ? Boolean(req.body?.popularHoursOnly)
      : boolish(process.env.CAMPAIGN_POPULAR_HOURS_ONLY || 'true');
    const defaultTz = safeString(process.env.CAMPAIGN_DEFAULT_TIMEZONE || 'America/Barbados', 80);

    const leads = loadLeads(csvFile);
    const state = loadState(stateFile);
    const now = new Date();
    const nowMs = now.getTime();
    const waitMs = waitDays * 24 * 60 * 60 * 1000;

    let skipped = {
      noEmail: 0,
      invalidEmail: 0,
      roleAddress: 0,
      noBusiness: 0,
      hasWebsite: 0,
      missingOwner: 0,
      replied: 0,
      capped: 0,
      waitWindow: 0,
      popularWindow: 0,
      notOptedIn: 0
    };

    for (const lead of leads) {
      if (!boolish(lead.optIn)) {
        skipped.notOptedIn += 1;
        continue;
      }
      const email = safeString(lead.email, 160).toLowerCase();
      if (!email) {
        skipped.noEmail += 1;
        continue;
      }
      if (!isValidEmailBasic(email)) {
        skipped.invalidEmail += 1;
        continue;
      }
      if (!allowRoleAddresses && isLikelyRoleAddress(email)) {
        skipped.roleAddress += 1;
        continue;
      }
      if (!safeString(lead.businessName, 120)) {
        skipped.noBusiness += 1;
        continue;
      }
      if (!isNoWebsiteFlag(lead.hasWebsite)) {
        skipped.hasWebsite += 1;
        continue;
      }
      if (requireOwnerName && !normalizeOwnerName(lead.ownerName)) {
        skipped.missingOwner += 1;
        continue;
      }

      state.contacts[email] = state.contacts[email] || {};
      const contactState = state.contacts[email];
      if (contactState.replied) {
        skipped.replied += 1;
        continue;
      }
      if (Number(contactState.sendCount || 0) >= maxSendsPerContact) {
        skipped.capped += 1;
        continue;
      }
      if (!shouldSend(contactState, nowMs, waitMs, maxSendsPerContact)) {
        skipped.waitWindow += 1;
        continue;
      }
      if (popularHoursOnly) {
        const tz = safeString(lead.timezone || defaultTz, 80) || defaultTz;
        if (!isPopularHourWindow(now, tz)) {
          skipped.popularWindow += 1;
          continue;
        }
      }

      const nextSendCount = Number(contactState.sendCount || 0) + 1;
      const draft = buildDraftForLead(lead, nextSendCount);
      const unsubscribeEmail = safeString(
        process.env.CAMPAIGN_UNSUBSCRIBE_EMAIL ||
          process.env.CAMPAIGN_REPLY_TO ||
          process.env.FROM_EMAIL ||
          process.env.SMTP_USER,
        160
      );
      const unsubscribeAddress = extractEmailAddress(unsubscribeEmail);

      return res.json({
        ok: true,
        lead: {
          businessName: safeString(lead.businessName, 120),
          ownerName: normalizeOwnerName(lead.ownerName),
          email,
          location: safeString(lead.location, 180),
          mapsUrl: safeString(lead.mapsUrl, 240),
          timezone: safeString(lead.timezone || defaultTz, 80) || defaultTz
        },
        sendCount: nextSendCount,
        emailDraft: {
          subject: draft.subject,
          text: draft.text,
          headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            ...(unsubscribeAddress
              ? { 'List-Unsubscribe': `<mailto:${unsubscribeAddress}?subject=unsubscribe>` }
              : {})
          }
        },
        controls: {
          waitDays,
          maxSendsPerContact,
          allowRoleAddresses,
          requireOwnerName,
          popularHoursOnly
        },
        skipped
      });
    }

    return res.json({ ok: true, lead: null, emailDraft: null, skipped, message: 'No eligible leads found.' });
  } catch (e) {
    next(e);
  }
});

router.post('/mark-sent', (req, res) => {
  const email = extractEmailAddress(req.body?.email);
  if (!email) return res.status(400).json({ error: 'email is required' });

  const stateFile = safeString(req.body?.stateFile || 'scripts/campaign-state.json', 200);
  const state = loadState(stateFile);
  state.contacts[email] = state.contacts[email] || {};
  state.contacts[email].lastSentAt = new Date().toISOString();
  state.contacts[email].sendCount = Number(state.contacts[email].sendCount || 0) + 1;
  state.contacts[email].lastSubject = safeString(req.body?.subject, 200);
  state.contacts[email].lastMessageId = safeString(req.body?.messageId, 200);
  saveState(stateFile, state);
  return res.json({ ok: true, email, sendCount: state.contacts[email].sendCount });
});

router.post('/mark-replied', (req, res) => {
  const email = extractEmailAddress(req.body?.email);
  if (!email) return res.status(400).json({ error: 'email is required' });

  const stateFile = safeString(req.body?.stateFile || 'scripts/campaign-state.json', 200);
  const state = loadState(stateFile);
  state.contacts[email] = state.contacts[email] || {};
  state.contacts[email].replied = true;
  state.contacts[email].replyAt = new Date().toISOString();
  saveState(stateFile, state);
  return res.json({ ok: true, email });
});

router.get('/deliverability-check', async (req, res, next) => {
  try {
    const fromEmail = safeString(
      req.query?.fromEmail || process.env.FROM_EMAIL || process.env.SMTP_USER || '',
      200
    );
    if (!fromEmail) return res.status(400).json({ error: 'fromEmail is required' });
    const checks = await checkSenderDns(fromEmail);
    return res.json({
      ok: true,
      domain: checks.domain,
      spf: checks.spf,
      dmarc: checks.dmarc,
      dkim: checks.dkim,
      recommendation:
        checks.spf && checks.dmarc && checks.dkim
          ? 'DNS authentication looks healthy for deliverability.'
          : 'Set SPF + DKIM + DMARC on your sending domain to reduce spam-folder risk.'
    });
  } catch (e) {
    next(e);
  }
});

module.exports = { campaignRouter: router };
