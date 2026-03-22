# NovaForge — Backend

Express + Mongoose + JWT + Nodemailer + Stripe.

## Commands

```bash
npm install
npm run dev
npm run seed-admin
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
