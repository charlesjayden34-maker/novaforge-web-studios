# Orvanta — Backend

Express + Mongoose + JWT + Nodemailer + Stripe.

## Commands

```bash
npm install
npm run dev
npm run seed-admin
npm run campaign:send -- --file scripts/leads.csv
```

## Environment

See `.env.example`. Required: `MONGODB_URI`, `JWT_SECRET`. For email: SMTP vars + `ADMIN_NOTIFY_EMAIL`. For Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

## API (summary)

- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
- `POST /api/requests` (public; optional Bearer links `userId` when email matches)
- `POST /api/requests/claim` · `GET /api/requests/me`
- `POST /api/payments/create-intent`
- `POST /api/stripe/webhook` (raw body)
- `GET/PATCH /api/admin/*` (admin JWT)
- `POST /api/leads/discover` · `POST /api/leads/generate-email` (auth)
- `POST /api/campaign/next-email` · `POST /api/campaign/mark-sent` · `POST /api/campaign/mark-replied` (admin auth)
- `GET /api/campaign/deliverability-check` (admin auth)

## Outreach Automation

`scripts/sendCampaign.js` sends outreach emails from a CSV lead file using SMTP.

Safety defaults:

- dry-run only (no emails sent) unless `--send`
- sends only rows where `optIn=true`
- sends only leads that are businesses and explicitly marked `hasWebsite=false`
- rate-limited sending (default 3000ms delay)
- follow-up waiting period (default 5 days)
- daily send cap (default 30/day)
- stops automatically when `replied=true` (CSV) or marked in state
- optional IMAP sync auto-marks contacts as replied when inbound mail is detected
- optional popular-hours sending window filter (weekdays 9-11am and 1-4pm in lead timezone)
- role-address suppression by default (`info@`, `support@`, etc.) to reduce spam risk
- per-send random delay jitter + max sends per contact guard
- DNS auth check logging for SPF/DMARC/DKIM before live sends

CSV format (`scripts/leads.csv`):

```csv
businessName,ownerName,email,optIn,replied,hasWebsite,timezone
Sample Barbershop,John Doe,owner@example.com,true,false,false,America/Barbados
```

Optional personalization/template columns:

```csv
location,mapsUrl,subject,emailBody,followUpSubject,followUpBody
```

Template placeholders supported in `subject/emailBody`:

- `{{ownerName}}`, `{{businessName}}`, `{{location}}`, `{{mapsUrl}}`
- `{{serviceAngle}}`, `{{portfolioUrl}}`
- `{{senderName}}`, `{{senderRole}}`, `{{senderCompany}}`, `{{senderEmail}}`

Run examples:

```bash
# Preview only
npm run campaign:send -- --file scripts/leads.csv

# Send first 50 eligible leads (only if wait period passed)
npm run campaign:send -- --file scripts/leads.csv --send --max 50 --delay-ms 3000 --wait-days 5

# Send with daily cap override
npm run campaign:send -- --file scripts/leads.csv --send --daily-limit 30

# Mark a lead as replied (stops future follow-ups)
npm run campaign:send -- --mark-replied owner@example.com

# Send with IMAP reply scan lookback override (default 30 days)
npm run campaign:send -- --file scripts/leads.csv --send --imap-lookback-days 45

# Disable popular-hours filter for this run
npm run campaign:send -- --file scripts/leads.csv --send --popular-hours-only false

# Conservative sender options
npm run campaign:send -- --file scripts/leads.csv --send --max-sends-per-contact 2 --delay-ms 4000 --delay-jitter-ms 2000

# Include role inboxes if intentionally desired
npm run campaign:send -- --file scripts/leads.csv --send --allow-role-addresses true
```

State file:

- `scripts/campaign-state.json` keeps `lastSentAt`, `sendCount`, and `replied` per email.
- `scripts/campaign-report-latest.json` is a full live recipient list/status snapshot for each run.
- `scripts/campaign-send-log.csv` appends every successful send.

IMAP auto-reply detection:

- set `IMAP_*` vars in `.env` to enable
- script scans mailbox and marks matching lead emails as replied
- replied contacts are excluded from future follow-ups automatically

Popular-hours filter:

- enabled by default (`CAMPAIGN_POPULAR_HOURS_ONLY=true`)
- uses each lead `timezone` column if present, otherwise `CAMPAIGN_DEFAULT_TIMEZONE`
- window: weekdays 09:00-11:00 and 13:00-16:00 local time

### Integrating with another chat/sender

If another service (like your website chat assistant) sends emails:

1. Call `POST /api/campaign/next-email` to get the next eligible lead + personalized draft.
2. Send using your external provider (Mailgun/Resend/SES/etc.).
3. Call `POST /api/campaign/mark-sent` after successful provider response.
4. Call `POST /api/campaign/mark-replied` when a reply is detected.

This keeps follow-up timing, send counts, and stop-on-reply logic centralized while your other system handles actual delivery.
