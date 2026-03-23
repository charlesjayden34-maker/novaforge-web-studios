import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';
import { siteConfig } from '../config/site';

type Req = {
  _id: string;
  projectType: string;
  websiteTier: 'starter' | 'growth' | 'premium';
  websitePrice: number;
  preferredPaymentMethod?: string;
  status: string;
  paymentStatus?: 'unpaid' | 'paid' | 'cancelled';
  payments?: Array<{
    provider?: 'stripe' | 'paypal';
    status?: string;
  }>;
  deliveryUrl?: string;
  description: string;
  createdAt?: string;
};

const statusStyle: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  in_progress: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
};

const tierName: Record<Req['websiteTier'], string> = {
  starter: 'Starter',
  growth: 'Growth',
  premium: 'Premium'
};

const allowedPaypalHosts = new Set([
  'www.paypal.com',
  'paypal.com',
  'www.sandbox.paypal.com',
  'sandbox.paypal.com'
]);

function toSafeHttpUrl(value?: string) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function isAllowedPaypalApproveUrl(value?: string) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && allowedPaypalHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export const ClientDashboard = () => {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      await api.post('/api/requests/claim');
      const res = await api.get<{ requests: Req[] }>('/api/requests/me');
      const activeRequests = (res.data.requests || []).filter(
        (request) =>
          (request.paymentStatus || 'unpaid') !== 'cancelled' && String(request.status) !== 'cancelled'
      );
      setRequests(activeRequests);
    } catch {
      setErr('Could not load your requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPaypalSuccess = params.get('paypal') === 'success';
    const orderId = params.get('token');
    if (!isPaypalSuccess || !orderId) return;

    const capture = async () => {
      try {
        await api.post('/api/paypal/capture-order', { orderId });
        window.history.replaceState({}, '', '/dashboard');
        await load();
      } catch {
        setErr('PayPal payment could not be confirmed yet. Please try again.');
      }
    };
    capture();
  }, [load]);

  const payWithPaypal = async (requestId: string) => {
    setErr(null);
    setPayingId(requestId);
    try {
      const res = await api.post<{ approveUrl: string }>('/api/paypal/create-order', { requestId });
      if (!isAllowedPaypalApproveUrl(res.data?.approveUrl)) {
        throw new Error('Invalid PayPal redirect URL');
      }
      window.location.assign(res.data.approveUrl);
    } catch {
      setErr('Could not start PayPal checkout. Please try again.');
      setPayingId(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>Client dashboard · NovaForge Web Studios</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="space-y-8 animate-fade-in">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Your projects
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Your project unlocks only after payment is marked as paid by admin.
          </p>
        </header>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {err && <p className="text-sm text-rose-500">{err}</p>}

        {!loading && requests.length === 0 && !err && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No requests yet. Submit one from the request page.
          </p>
        )}

        <div className="grid gap-4">
          {requests.map((r) => {
            const safeDeliveryUrl = toSafeHttpUrl(r.deliveryUrl);
            return (
            <article
              key={r._id}
              className="nf-card p-5 transition duration-300 hover:-translate-y-0.5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {r.projectType} · {tierName[r.websiteTier]} (${Number(r.websitePrice || 0).toLocaleString()})
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {r.description}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Preferred payment: {(r.preferredPaymentMethod || 'bank_transfer').replace('_', ' ')}
                  </p>
                  {r.createdAt && (
                    <p className="text-xs text-slate-400">
                      Submitted {new Date(r.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                    statusStyle[r.status] || 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                  }`}
                >
                  {r.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  Payment status: {r.paymentStatus || 'unpaid'}
                </p>
                {(r.paymentStatus || 'unpaid') !== 'paid' ? (
                  <div className="mt-2 space-y-2 text-slate-600 dark:text-slate-300">
                    {r.preferredPaymentMethod === 'paypal' &&
                      r.payments?.some(
                        (payment) =>
                          payment.provider === 'paypal' && String(payment.status).includes('complete')
                      ) && (
                        <p className="text-sky-700 dark:text-sky-300">
                          PayPal payment detected. Waiting for admin approval.
                        </p>
                      )}
                    {(r.paymentStatus || 'unpaid') === 'cancelled' || r.status === 'cancelled' ? (
                      <p className="text-rose-600 dark:text-rose-300">
                        This request was cancelled by admin. Contact support to reopen.
                      </p>
                    ) : r.preferredPaymentMethod === 'paypal' ? (
                      <>
                        <p>
                          Complete payment with PayPal. After successful checkout, payment status will update
                          and delivery will unlock.
                        </p>
                        <button
                          type="button"
                          onClick={() => payWithPaypal(r._id)}
                          disabled={payingId === r._id}
                          className="nf-btn-primary"
                        >
                          {payingId === r._id ? 'Redirecting...' : 'Pay with PayPal'}
                        </button>
                      </>
                    ) : (
                      <>
                        <p>
                          Please complete payment and wait for admin confirmation. Delivery access
                          remains locked until payment is marked paid.
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-950/30">
                          <p className="font-semibold">National transfer (Barbados)</p>
                          <p>Account holder: {siteConfig.bank.accountHolder}</p>
                          <p>Bank name: {siteConfig.bank.bankName}</p>
                          <p>Branch: {siteConfig.bank.branch}</p>
                          <p>Branch transit: {siteConfig.bank.branchTransit}</p>
                          <p>Account type: {siteConfig.bank.accountType}</p>
                          <p>Account number: {siteConfig.bank.accountNumber}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-950/30">
                          <p className="font-semibold">International transfer</p>
                          <p>Account holder: {siteConfig.bank.accountHolder}</p>
                          <p>Bank name: {siteConfig.bank.bankName}</p>
                          <p>SWIFT code: {siteConfig.bank.swiftCode}</p>
                          <p>Account type: {siteConfig.bank.accountType}</p>
                          <p>Account number: {siteConfig.bank.accountNumber}</p>
                        </div>
                        <p>
                          After transfer, email proof of payment to{' '}
                          <a
                            href={`mailto:${siteConfig.contact.email}`}
                            className="underline underline-offset-2"
                          >
                            {siteConfig.contact.email}
                          </a>
                          .
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                    Payment confirmed.
                  </p>
                )}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Website delivery
                </p>
                {(r.paymentStatus || 'unpaid') === 'paid' && safeDeliveryUrl ? (
                  <a
                    href={safeDeliveryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-brand-600 underline underline-offset-4 dark:text-brand-300"
                  >
                    Open your website
                  </a>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Locked until payment is marked paid by admin.
                  </p>
                )}
              </div>
            </article>
            );
          })}
        </div>
      </div>
    </>
  );
};
