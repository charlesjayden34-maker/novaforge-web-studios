# Campaign console (static)

Small static page to:

- Sign in against your Orvanta API (`POST /api/auth/login`)
- Call `POST /api/campaign/next-email` (admin) for the next eligible outreach draft

Lead discovery (`/api/leads/*`) was removed from the main app; this console no longer uses those endpoints.

## Local run

```bash
npx serve lead-automation-site -l 5180
```

Open `http://localhost:5180` and set **API base URL** to your backend (e.g. `https://orvanta-api.onrender.com`).

## Deploy

If you add a Render static service for this folder, set the API base in the UI after deploy (or bake a default in `app.js`).
