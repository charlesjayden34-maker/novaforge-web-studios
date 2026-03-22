import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';

export const ResetPassword = () => {
  const [params] = useSearchParams();
  const tokenFromUrl = useMemo(() => params.get('token') || '', [params]);
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!token || !password) {
      setError('Reset token and new password are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      setMessage('Password updated. You can now log in with your new password.');
      setPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Set new password · NovaForge Web Studios</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-md mx-auto space-y-6 animate-fade-in">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Paste your reset token (or use the one prefilled from your link) and set a new
            password.
          </p>
        </header>

        <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="token">
              Reset token
            </label>
            <input
              id="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {showPassword ? 'Hide password' : 'Show password'}
            </button>
          </div>

          {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
          {message && <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/40 transition hover:bg-brand-400 disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Save new password'}
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Return to{' '}
            <Link className="text-slate-800 underline-offset-4 hover:underline dark:text-slate-200" to="/login">
              login
            </Link>
          </p>
        </form>
      </div>
    </>
  );
};

