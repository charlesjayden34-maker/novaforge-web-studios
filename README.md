# Orvanta Studio

Full-stack demo: **React + Tailwind** frontend, **Express + MongoDB** backend, **JWT** auth, **Nodemailer** notifications, **Stripe** payments.

## Structure

- `frontend/` — Vite + React + TypeScript + Tailwind
- `backend/` — Express API, Mongoose models, Stripe webhook

## Prerequisites

- Node.js + npm
- MongoDB (local URI or Atlas)

## Backend

```bash
cd backend
cp .env.example .env
# Set MONGODB_URI, JWT_SECRET, SMTP_*, STRIPE_*, ADMIN_NOTIFY_EMAIL
npm install
npm run dev
```

Create the first admin (optional):

```bash
# In backend/.env set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
npm run seed-admin
```

Stripe CLI (local webhook forwarding):

```bash
stripe listen --forward-to localhost:4000/api/stripe/webhook
```

## Frontend

```bash
cd frontend
cp .env.example .env
# Set VITE_STRIPE_PUBLISHABLE_KEY
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:4000` (see `vite.config.mts`).

## URLs

- App: `http://localhost:5173`
- API health: `http://localhost:4000/api/health`

## Temporary Public URL (quick share)

If your local app is running, you can expose it publicly:

```bash
npx localtunnel --port 5174
```

This gives a temporary URL like `https://something.loca.lt`.

## Production Deployment (Render Blueprint)

This repo includes `render.yaml` with both services:

- `orvanta-api` (Node backend from `backend/`)
- `orvanta-web` (static frontend from `frontend/`)

Deploy flow:

1. Push project to GitHub.
2. In Render, choose **New +** → **Blueprint** and select this repo.
3. Set required env vars:
   - Backend: `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, and optional `SMTP_*`, `STRIPE_*`.
   - Frontend: `VITE_API_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`.
4. Set `CORS_ORIGIN` to your frontend domain (for example `https://yourdomain.com`).
5. Set `VITE_API_URL` to your backend domain (for example `https://api.yourdomain.com`).

For Stripe in production, configure a webhook endpoint:

- `https://<your-api-domain>/api/stripe/webhook`
