/**
 * Bulk outreach sender (SMTP + CSV + follow-up state).
 *
 * Rules implemented:
 * - Send only opted-in contacts
 * - Re-send only after wait period (default 5 days)
 * - Stop sending once a reply is marked
 *
 * Usage:
 *   node scripts/sendCampaign.js --file scripts/leads.csv
 *   node scripts/sendCampaign.js --file scripts/leads.csv --send --wait-days 5 --delay-ms 3000 --max 50
 *   node scripts/sendCampaign.js --mark-replied owner@example.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function boolish(v) {
  return String(v || '')
    .trim()
    .toLowerCase() === 'true';
}

function isNoWebsiteFlag(v) {
  const s = String(v || '')
    .trim()
    .toLowerCase();
  return ['false', 'no', '0', 'none', 'n/a', 'na'].includes(s);
}

function asCleanText(v, fallback = '') {
  const cleaned = String(v || '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function normalizeOwnerName(v) {
  const raw = asCleanText(v);
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (['unknown', 'n/a', 'na', 'none', '-', '--', 'not listed publicly'].includes(lower)) {
    return '';
  }
  return raw;
}

function normalizeLocation(v) {
  return asCleanText(v);
}

function inferServiceAngle(lead) {
  const sourceText = [
    lead.businessType,
    lead.category,
    lead.tags,
    lead.industry,
    lead.businessName
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');

  if (/(barber|salon|spa|beauty|nail)/.test(sourceText)) {
    return 'appointments, pricing, and service gallery';
  }
  if (/(restaurant|cafe|bakery|food)/.test(sourceText)) {
    return 'menu visibility, opening hours, and direct bookings';
  }
  if (/(plumb|electri|hvac|repair|contractor|clean)/.test(sourceText)) {
    return 'fast quote requests and emergency contact visibility';
  }
  if (/(law|legal|consult|agency|studio|account)/.test(sourceText)) {
    return 'trust-building service pages and qualified inbound leads';
  }
  return 'better search visibility and easier customer contact';
}

function renderTemplate(template, vars) {
  const raw = String(template || '');
  if (!raw.trim()) return '';
  return raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_all, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return String(vars[key] || '');
    return '';
  });
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

function loadLeads(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
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
  const abs = path.isAbsolute(stateFile) ? stateFile : path.join(process.cwd(), stateFile);
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
  const abs = path.isAbsolute(stateFile) ? stateFile : path.join(process.cwd(), stateFile);
  fs.writeFileSync(abs, JSON.stringify(state, null, 2));
}

function toIsoSafe(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function appendSendLog(logFile, rows) {
  if (!rows.length) return;
  const abs = path.isAbsolute(logFile) ? logFile : path.join(process.cwd(), logFile);
  const exists = fs.existsSync(abs);
  const header = 'sentAt,email,businessName,ownerName,subject,sendCount\n';
  const lines = rows
    .map((r) =>
      [
        r.sentAt,
        r.email,
        r.businessName || '',
        r.ownerName || '',
        `"${String(r.subject || '').replace(/"/g, '""')}"`,
        String(r.sendCount || 0)
      ].join(',')
    )
    .join('\n');
  fs.writeFileSync(abs, `${exists ? '' : header}${lines}\n`, { flag: 'a' });
}

function writeLatestReport(reportFile, report) {
  const abs = path.isAbsolute(reportFile) ? reportFile : path.join(process.cwd(), reportFile);
  fs.writeFileSync(abs, JSON.stringify(report, null, 2));
}

function makeTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '465');
  const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error(
      'SMTP_HOST/SMTP_PORT/SMTP_SECURE/SMTP_USER/SMTP_PASS are required in backend/.env'
    );
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

function hasImapConfig() {
  return Boolean(
    process.env.IMAP_HOST &&
      process.env.IMAP_PORT &&
      process.env.IMAP_USER &&
      process.env.IMAP_PASS
  );
}

async function syncRepliesViaImap(state, leads, lookbackDays) {
  if (!hasImapConfig()) {
    return { enabled: false, scanned: 0, matched: 0 };
  }

  const leadEmails = new Set(
    leads
      .map((l) => String(l.email || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    secure: String(process.env.IMAP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS
    }
  });

  const mailbox = process.env.IMAP_MAILBOX || 'INBOX';
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  let scanned = 0;
  let matched = 0;
  await client.connect();
  const lock = await client.getMailboxLock(mailbox);
  try {
    for await (const msg of client.fetch({ since }, { envelope: true })) {
      scanned += 1;
      const from = msg.envelope?.from || [];
      for (const sender of from) {
        const email = String(sender.address || '').trim().toLowerCase();
        if (!email) continue;
        if (!leadEmails.has(email)) continue;
        state.contacts[email] = state.contacts[email] || {};
        if (!state.contacts[email].replied) {
          state.contacts[email].replied = true;
          state.contacts[email].replyAt = new Date().toISOString();
          state.contacts[email].replySource = 'imap';
          matched += 1;
        }
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return { enabled: true, scanned, matched };
}

function buildEmailBody(lead, sendCount) {
  const owner = normalizeOwnerName(lead.ownerName);
  const biz = asCleanText(lead.businessName, 'your business');
  const location = normalizeLocation(lead.location);
  const mapsUrl = asCleanText(lead.mapsUrl);
  const serviceAngle = inferServiceAngle(lead);
  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://your-frontend-domain.com';
  const senderName = process.env.CAMPAIGN_SENDER_NAME || 'Nathan Whittaker';
  const senderRole = process.env.CAMPAIGN_SENDER_ROLE || 'Business Partner';
  const senderCompany = process.env.CAMPAIGN_SENDER_COMPANY || 'Orvanta Studio';
  const senderEmail =
    process.env.CAMPAIGN_SENDER_EMAIL || process.env.FROM_EMAIL || process.env.SMTP_USER || '';
  const defaultCta =
    process.env.CAMPAIGN_DEFAULT_CTA ||
    'If you are open to it, I can share a quick 1-page website plan tailored to your business.';
  const stage = Math.max(1, Number(sendCount || 1));
  const vars = {
    ownerName: owner || 'there',
    businessName: biz,
    location,
    mapsUrl,
    serviceAngle,
    portfolioUrl: siteUrl,
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
  if (customSubject && customBody) {
    return { subject: customSubject, text: customBody };
  }

  const subjects = [
    location ? `${biz} in ${location}: quick website idea` : `Quick website help for ${biz}`,
    `Following up on ${biz} website idea`,
    `Last quick check-in for ${biz}`
  ];

  const opener = owner ? `Hi ${owner},` : 'Hi there,';
  const intros = [
    location
      ? `I found ${biz} while researching businesses in ${location} and noticed there is no active website listed yet.`
      : `I came across ${biz} and noticed there is no active website listed yet.`,
    `Just following up in case my earlier note about ${biz} got buried in your inbox.`,
    `Final quick follow-up from me about helping ${biz} launch a professional website.`
  ];

  const idx = Math.min(stage - 1, 2);
  return {
    subject: subjects[idx],
    text: [
      opener,
      '',
      `My name is ${senderName}, ${senderRole} at ${senderCompany}.`,
      '',
      intros[idx],
      `A clean site can help with ${serviceAngle}.`,
      '- get found on Google',
      '- build trust with new customers',
      '- capture calls/messages 24/7',
      '',
      'We build affordable websites for small businesses and handle design, mobile optimization, and contact setup.',
      '',
      mapsUrl ? `Listing reference: ${mapsUrl}` : '',
      `Portfolio: ${siteUrl}`,
      '',
      defaultCta,
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

function shouldSend(contactState, nowMs, waitMs, maxSendsPerContact) {
  if (contactState?.replied === true) return false;
  const sendCount = Number(contactState?.sendCount || 0);
  if (sendCount >= maxSendsPerContact) return false;
  if (!contactState?.lastSentAt) return true;
  const last = new Date(contactState.lastSentAt).getTime();
  if (Number.isNaN(last)) return true;
  return nowMs - last >= waitMs;
}

async function main() {
  const args = parseArgs(process.argv);
  const csvFile = args.file || 'scripts/leads.csv';
  const stateFile = args.state || 'scripts/campaign-state.json';
  const reportFile = args['report-file'] || 'scripts/campaign-report-latest.json';
  const logFile = args['log-file'] || 'scripts/campaign-send-log.csv';
  const doSend = Boolean(args.send);
  const delayMs = Number(args['delay-ms'] || 3000);
  const delayJitterMs = Number(args['delay-jitter-ms'] || process.env.CAMPAIGN_DELAY_JITTER_MS || 1200);
  const max = Number(args.max || 1000);
  const waitDays = Number(args['wait-days'] || process.env.CAMPAIGN_WAIT_DAYS || 5);
  const dailyLimit = Number(args['daily-limit'] || process.env.CAMPAIGN_DAILY_LIMIT || 30);
  const maxSendsPerContact = Number(
    args['max-sends-per-contact'] || process.env.CAMPAIGN_MAX_SENDS_PER_CONTACT || 2
  );
  const allowRoleAddresses = args['allow-role-addresses']
    ? boolish(args['allow-role-addresses'])
    : boolish(process.env.CAMPAIGN_ALLOW_ROLE_ADDRESSES || 'false');
  const requireOwnerName = args['require-owner-name']
    ? boolish(args['require-owner-name'])
    : boolish(process.env.CAMPAIGN_REQUIRE_OWNER_NAME || 'false');
  const popularHoursOnly = args['popular-hours-only']
    ? boolish(args['popular-hours-only'])
    : boolish(process.env.CAMPAIGN_POPULAR_HOURS_ONLY || 'true');
  const defaultTz = process.env.CAMPAIGN_DEFAULT_TIMEZONE || 'America/Barbados';
  const imapLookbackDays = Number(
    args['imap-lookback-days'] || process.env.IMAP_LOOKBACK_DAYS || 30
  );
  const waitMs = waitDays * 24 * 60 * 60 * 1000;
  const now = new Date();
  const nowMs = now.getTime();

  const state = loadState(stateFile);
  state.daily = state.daily || {};
  const todayKey = new Date().toISOString().slice(0, 10);
  const sentToday = Number(state.daily[todayKey] || 0);
  const remainingToday = Math.max(0, dailyLimit - sentToday);

  if (args['mark-replied']) {
    const email = String(args['mark-replied']).trim().toLowerCase();
    if (!email) throw new Error('Provide --mark-replied <email>');
    state.contacts[email] = state.contacts[email] || {};
    state.contacts[email].replied = true;
    state.contacts[email].replyAt = new Date().toISOString();
    saveState(stateFile, state);
    // eslint-disable-next-line no-console
    console.log(`Marked replied: ${email}`);
    return;
  }

  const leads = loadLeads(csvFile);
  if (!leads.length) {
    // eslint-disable-next-line no-console
    console.log('No leads found.');
    return;
  }

  // Sync replied flags from CSV (optional column: replied=true).
  leads.forEach((lead) => {
    const email = String(lead.email || '').trim().toLowerCase();
    if (!email) return;
    if (boolish(lead.replied)) {
      state.contacts[email] = state.contacts[email] || {};
      state.contacts[email].replied = true;
      if (!state.contacts[email].replyAt) state.contacts[email].replyAt = new Date().toISOString();
    }
  });

  const syncInfo = await syncRepliesViaImap(state, leads, imapLookbackDays);
  if (syncInfo.enabled) {
    // eslint-disable-next-line no-console
    console.log(
      `IMAP sync complete. scanned=${syncInfo.scanned} matchedReplies=${syncInfo.matched}`
    );
  } else {
    // eslint-disable-next-line no-console
    console.log('IMAP sync skipped (set IMAP_* env vars to enable automatic reply detection).');
  }

  const from = process.env.FROM_EMAIL || process.env.SMTP_USER || '';
  const replyTo = process.env.CAMPAIGN_REPLY_TO || from;
  const unsubscribeAddress = process.env.CAMPAIGN_UNSUBSCRIBE_EMAIL || extractEmailAddress(replyTo);
  if (doSend && !from) throw new Error('FROM_EMAIL (or SMTP_USER) must be set');
  const transport = doSend ? makeTransport() : null;

  if (doSend) {
    const dnsCheck = await checkSenderDns(from);
    // eslint-disable-next-line no-console
    console.log(
      `Sender domain checks (${dnsCheck.domain || 'unknown'}): SPF=${dnsCheck.spf ? 'ok' : 'missing'} DMARC=${
        dnsCheck.dmarc ? 'ok' : 'missing'
      } DKIM=${dnsCheck.dkim ? 'ok' : 'missing'}`
    );
    if (!dnsCheck.spf || !dnsCheck.dmarc || !dnsCheck.dkim) {
      // eslint-disable-next-line no-console
      console.log(
        'Warning: missing SPF/DMARC/DKIM can push emails to spam. Configure DNS authentication before large sends.'
      );
    }
  }

  const allOptedIn = leads.filter((l) => boolish(l.optIn));
  const targetLeads = allOptedIn.filter((l) => {
    const businessName = String(l.businessName || '').trim();
    const hasBusiness = businessName.length > 0;
    const noWebsite = isNoWebsiteFlag(l.hasWebsite);
    return hasBusiness && noWebsite;
  });

  const eligible = targetLeads
    .filter((l) => {
      const email = String(l.email || '').trim().toLowerCase();
      if (!email) return false;
      if (!isValidEmailBasic(email)) return false;
      if (!allowRoleAddresses && isLikelyRoleAddress(email)) return false;
      if (requireOwnerName && !normalizeOwnerName(l.ownerName)) return false;
      const contactState = state.contacts[email] || {};
      if (!shouldSend(contactState, nowMs, waitMs, maxSendsPerContact)) return false;

      if (!popularHoursOnly) return true;
      const leadTz = String(l.timezone || defaultTz).trim() || defaultTz;
      return isPopularHourWindow(new Date(nowMs), leadTz);
    })
    .slice(0, Math.max(0, Math.min(max, remainingToday)));

  const fullList = allOptedIn.map((lead) => {
    const email = String(lead.email || '').trim().toLowerCase();
    const contactState = state.contacts[email] || {};
    const replied = Boolean(contactState.replied);
    const lastSentAt = toIsoSafe(contactState.lastSentAt);
    const sendCount = Number(contactState.sendCount || 0);
    const nextEligibleAt = lastSentAt
      ? new Date(new Date(lastSentAt).getTime() + waitMs).toISOString()
      : now.toISOString();
    const inWindow = (() => {
      if (!popularHoursOnly) return true;
      const tz = String(lead.timezone || defaultTz).trim() || defaultTz;
      return isPopularHourWindow(now, tz);
    })();
    const dueByWait = !lastSentAt || new Date(lastSentAt).getTime() + waitMs <= nowMs;
    const validEmail = isValidEmailBasic(email);
    const isRoleAddress = isLikelyRoleAddress(email);
    const ownerMissing = !normalizeOwnerName(lead.ownerName);
    const maxSendsReached = sendCount >= maxSendsPerContact;
    const hasBusiness = String(lead.businessName || '').trim().length > 0;
    const noWebsite = isNoWebsiteFlag(lead.hasWebsite);
    const status = !validEmail
      ? 'skip_invalid_email'
      : !hasBusiness
        ? 'skip_not_business'
        : !noWebsite
          ? 'skip_has_website'
          : !allowRoleAddresses && isRoleAddress
            ? 'skip_role_address'
            : requireOwnerName && ownerMissing
              ? 'skip_missing_owner_name'
              : replied
                ? 'replied_stop'
                : maxSendsReached
                  ? 'max_sends_reached'
                  : dueByWait
                    ? inWindow
                      ? 'eligible_now'
                      : 'waiting_popular_hours'
                    : 'waiting_5_day_period';
    return {
      businessName: lead.businessName || '',
      ownerName: lead.ownerName || '',
      email,
      hasWebsite: String(lead.hasWebsite || ''),
      timezone: lead.timezone || defaultTz,
      sendCount,
      replied,
      lastSentAt,
      nextEligibleAt,
      status
    };
  });

  // eslint-disable-next-line no-console
  console.log(
    `Loaded ${leads.length} rows. Target leads (business + no website): ${targetLeads.length}. Eligible now: ${eligible.length}. waitDays=${waitDays}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `Popular-hours filter: ${popularHoursOnly ? 'ON' : 'OFF'} (default timezone=${defaultTz})`
  );
  // eslint-disable-next-line no-console
  console.log(
    `Deliverability filters: roleAddresses=${allowRoleAddresses ? 'allowed' : 'blocked'} requireOwnerName=${
      requireOwnerName ? 'yes' : 'no'
    } maxSendsPerContact=${maxSendsPerContact}`
  );
  // eslint-disable-next-line no-console
  console.log(`Daily cap: ${dailyLimit}. sentToday=${sentToday}. remainingToday=${remainingToday}`);
  // eslint-disable-next-line no-console
  console.log(doSend ? 'SEND mode enabled.' : 'DRY RUN mode (no emails sent). Use --send to send.');

  const sentRows = [];
  for (let i = 0; i < eligible.length; i += 1) {
    const lead = eligible[i];
    const email = String(lead.email || '').trim().toLowerCase();
    if (!email) continue;
    state.contacts[email] = state.contacts[email] || {};
    const sendCount = Number(state.contacts[email].sendCount || 0) + 1;

    const { subject, text } = buildEmailBody(lead, sendCount);

    // eslint-disable-next-line no-console
    console.log(`[${i + 1}/${eligible.length}] ${lead.businessName || 'Unknown business'} <${email}>`);
    // eslint-disable-next-line no-console
    console.log(`  Subject: ${subject}`);

    if (doSend) {
      const listUnsubscribeHeader = unsubscribeAddress
        ? `<mailto:${unsubscribeAddress}?subject=unsubscribe>`
        : undefined;
      await transport.sendMail({
        to: email,
        from,
        replyTo,
        subject,
        text,
        headers: {
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
          ...(listUnsubscribeHeader
            ? {
                'List-Unsubscribe': listUnsubscribeHeader
              }
            : {})
        }
      });
      state.contacts[email].lastSentAt = new Date().toISOString();
      state.contacts[email].sendCount = sendCount;
      state.contacts[email].lastSubject = subject;
      state.daily[todayKey] = Number(state.daily[todayKey] || 0) + 1;
      sentRows.push({
        sentAt: state.contacts[email].lastSentAt,
        email,
        businessName: lead.businessName || '',
        ownerName: lead.ownerName || '',
        subject,
        sendCount
      });
      saveState(stateFile, state);
      // eslint-disable-next-line no-console
      console.log('  Sent');
      if (i < eligible.length - 1 && delayMs > 0) {
        const jitter = delayJitterMs > 0 ? Math.floor(Math.random() * delayJitterMs) : 0;
        await sleep(delayMs + jitter);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('  Dry run only');
    }
  }

  if (!doSend) {
    saveState(stateFile, state);
  }

  appendSendLog(logFile, sentRows);
  writeLatestReport(reportFile, {
    generatedAt: now.toISOString(),
    mode: doSend ? 'send' : 'dry-run',
    waitDays,
    dailyLimit,
    sentToday,
    remainingToday,
    popularHoursOnly,
    defaultTimezone: defaultTz,
    totals: {
      leads: leads.length,
      optedIn: allOptedIn.length,
      targetLeads: targetLeads.length,
      eligibleNow: eligible.length,
      sentThisRun: sentRows.length,
      repliedStops: fullList.filter((x) => x.status === 'replied_stop').length,
      skippedHasWebsite: fullList.filter((x) => x.status === 'skip_has_website').length,
      skippedNotBusiness: fullList.filter((x) => x.status === 'skip_not_business').length
    },
    fullList
  });
  // eslint-disable-next-line no-console
  console.log(`Report written: ${reportFile}`);
  if (sentRows.length) {
    // eslint-disable-next-line no-console
    console.log(`Send log updated: ${logFile}`);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e.message || e);
  process.exit(1);
});

