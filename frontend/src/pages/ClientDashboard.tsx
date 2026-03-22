import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';

type Req = {
  _id: string;
  projectType: string;
  budgetRange: string;
  preferredPaymentMethod?: string;
  status: string;
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  deliveryUrl?: string;
  description: string;
  createdAt?: string;
};

const statusStyle: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  in_progress: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
};

const paymentDetails = {
  contactEmail: 'nathanwhittaker141@gmail.com',
  accountHolder: 'NATHAN WHITTAKER',
  bankName: 'FCIB',
  branch: 'BROAD STREET',
  branchTransit: '09606',
  accountType: 'Savings',
  accountNumber: '1001283593',
  swiftCode: 'FCIBBBBB'
};

export const ClientDashboard = () => {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      await api.post('/api/requests/claim');
      const res = await api.get<{ requests: Req[] }>('/api/requests/me');
      setRequests(res.data.requests || []);
    } catch {
      setErr('Could not load your requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
          {requests.map((r) => (
            <article
              key={r._id}
              className="glass rounded-2xl p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/10"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {r.projectType} · {r.budgetRange}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {r.description}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Preferred payment: {(r.preferredPaymentMethod || 'bank_transfer').replace('_', ' ')}
                  </p>
                  {r.createdAt && (
                    <p className="text-[11px] text-slate-400">
                      Submitted {new Date(r.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${
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
                    <p>
                      Please complete payment and wait for admin confirmation. Delivery access
                      remains locked until payment is marked paid.
                    </p>
                    <div className="rounded-lg border border-slate-200 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-950/30">
                      <p className="font-semibold">National transfer (Barbados)</p>
                      <p>Account holder: {paymentDetails.accountHolder}</p>
                      <p>Bank name: {paymentDetails.bankName}</p>
                      <p>Branch: {paymentDetails.branch}</p>
                      <p>Branch transit: {paymentDetails.branchTransit}</p>
                      <p>Account type: {paymentDetails.accountType}</p>
                      <p>Account number: {paymentDetails.accountNumber}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-950/30">
                      <p className="font-semibold">International transfer</p>
                      <p>Account holder: {paymentDetails.accountHolder}</p>
                      <p>Bank name: {paymentDetails.bankName}</p>
                      <p>SWIFT code: {paymentDetails.swiftCode}</p>
                      <p>Account type: {paymentDetails.accountType}</p>
                      <p>Account number: {paymentDetails.accountNumber}</p>
                    </div>
                    <p>
                      After transfer, email proof of payment to{' '}
                      <a
                        href={`mailto:${paymentDetails.contactEmail}`}
                        className="underline underline-offset-2"
                      >
                        {paymentDetails.contactEmail}
                      </a>
                      .
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                    Payment confirmed.
                  </p>
                )}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Website delivery
                </p>
                {(r.paymentStatus || 'unpaid') === 'paid' && r.deliveryUrl ? (
                  <a
                    href={r.deliveryUrl}
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
          ))}
        </div>
      </div>
    </>
  );
};
