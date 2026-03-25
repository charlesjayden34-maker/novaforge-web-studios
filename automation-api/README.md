# Automation Research API

Standalone API for business discovery and automated outreach workflows.

## Features

- admin login (JWT)
- discover businesses without listed websites (OpenStreetMap data)
- collect publicly listed owner/email/phone/location
- generate personalized email drafts
- campaign queue endpoints for next draft / mark sent / mark replied

## Run locally

```bash
cd automation-api
cp .env.example .env
npm install
npm run dev
```

Health:

`http://localhost:4100/api/health`
