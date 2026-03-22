import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';

type Req = {
  _id: string;
  name: string;
  email: string;
  projectType: string;
  websiteTier: 'starter' | 'growth' | 'premium';
  websitePrice: number;
  preferredPaymentMethod?: string;
  status: string;
  paymentStatus?: 'unpaid' | 'paid' | 'cancelled';
  paymentSubmission?: {
    payerFullName?: string;
    payerBankIdentifier?: string;
    payerBankName?: string;
    transferReference?: string;
    transferDate?: string;
    paymentProofUrl?: string;
  };
  deliveryUrl?: string;
  description: string;
  createdAt?: string;
};

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

const tierName: Record<Req['websiteTier'], string> = {
  starter: 'Starter',
  growth: 'Growth',
  premium: 'Premium'
};

export const AdminDashboard = () => {
  const [requests, setRequests] = useState<Req[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [r, u] = await Promise.all([
        api.get<{ requests: Req[] }>('/api/admin/requests'),
        api.get<{ users: UserRow[] }>('/api/admin/users')
      ]);
      setRequests(r.data.requests || []);
      setDeliveryDrafts(
        Object.fromEntries((r.data.requests || []).map((req) => [req._id, req.deliveryUrl || '']))
      );
      setUsers(u.data.users || []);
    } catch {
      setErr('Could not load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateRequest = async (
    id: string,
    patch: { status?: string; paymentStatus?: string; deliveryUrl?: string }
  ) => {
    try {
      await api.patch(`/api/admin/requests/${id}`, patch);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Update failed.');
    }
  };

  const updateRole = async (id: string, role: string) => {
    try {
      await api.patch(`/api/admin/users/${id}`, { role });
      await load();
    } catch {
      setErr('Role update failed.');
    }
  };

  const cancelRequest = async (id: string) => {
    try {
      await api.post(`/api/admin/requests/${id}/cancel`);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Cancel failed.');
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin · NovaForge Web Studios</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="space-y-10 animate-fade-in">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Admin
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            All client requests and user roles.
          </p>
        </header>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {err && <p className="text-sm text-rose-500">{err}</p>}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Requests</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Pay method</th>
                  <th className="px-4 py-3">Payment proof</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Delivery URL</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {requests.map((r) => (
                  <tr key={r._id} className="bg-white dark:bg-slate-950/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{r.projectType}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {tierName[r.websiteTier]} (${Number(r.websitePrice || 0).toLocaleString()})
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {(r.preferredPaymentMethod || 'bank_transfer').replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      <div>{r.paymentSubmission?.payerFullName || '-'}</div>
                      <div>{r.paymentSubmission?.payerBankName || '-'}</div>
                      <div>{r.paymentSubmission?.payerBankIdentifier || '-'}</div>
                      <div>Ref: {r.paymentSubmission?.transferReference || '-'}</div>
                      {r.paymentSubmission?.paymentProofUrl ? (
                        <a
                          href={r.paymentSubmission.paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 underline underline-offset-2 dark:text-brand-300"
                        >
                          Open proof
                        </a>
                      ) : (
                        <div>-</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={r.paymentStatus || 'unpaid'}
                        onChange={(e) =>
                          updateRequest(r._id, {
                            paymentStatus: e.target.value
                          })
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="unpaid">unpaid</option>
                        <option value="paid">paid</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={r.status}
                        onChange={(e) => updateRequest(r._id, { status: e.target.value })}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="pending">pending</option>
                        <option value="in_progress">in progress</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={deliveryDrafts[r._id] || ''}
                          onChange={(e) =>
                            setDeliveryDrafts((prev) => ({ ...prev, [r._id]: e.target.value }))
                          }
                          placeholder="https://..."
                          className="h-8 w-56 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateRequest(r._id, { deliveryUrl: deliveryDrafts[r._id] || '' })
                          }
                          className="rounded-full bg-brand-500 px-3 py-1 text-[11px] font-semibold text-white"
                        >
                          Save
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => cancelRequest(r._id)}
                        className="rounded-full border border-rose-400 px-3 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-300"
                      >
                        Cancel request
                      </button>
                    </td>
                  </tr>
                  
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Users</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u._id} className="bg-white dark:bg-slate-950/40">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u._id, e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
};
