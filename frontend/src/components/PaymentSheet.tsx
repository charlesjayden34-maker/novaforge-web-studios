import { FormEvent, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripe } from '../lib/stripeClient';

function Inner({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr(null);
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`
      }
    });
    setBusy(false);
    if (error) {
      setErr(error.message || 'Payment failed');
      return;
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {err && <p className="text-xs text-rose-500 dark:text-rose-400">{err}</p>}
      <button
        type="submit"
        disabled={!stripe || busy}
        className="inline-flex w-full items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/40 transition hover:bg-brand-400 disabled:opacity-60"
      >
        {busy ? 'Processing…' : 'Pay now'}
      </button>
    </form>
  );
}

export function PaymentSheet({
  clientSecret,
  onClose,
  onPaid
}: {
  clientSecret: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const stripeAsync = getStripe();
  if (!stripeAsync) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Stripe is not configured (missing publishable key).
      </p>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-50 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold">Complete payment</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-900"
          >
            Close
          </button>
        </div>
        <Elements
          stripe={stripeAsync}
          options={{
            clientSecret,
            appearance: { theme: 'night' }
          }}
        >
          <Inner
            onDone={() => {
              onPaid();
              onClose();
            }}
          />
        </Elements>
      </div>
    </div>
  );
}
