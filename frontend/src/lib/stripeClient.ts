import { loadStripe, type Stripe } from '@stripe/stripe-js';

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

let _stripe: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> | null {
  if (!key) return null;
  if (!_stripe) _stripe = loadStripe(key);
  return _stripe;
}
