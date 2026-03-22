import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition ${
    isActive ? 'text-brand-500 dark:text-brand-400' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
  }`;

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [dark, setDark] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('nf_theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nf_theme');
      if (saved === 'light') setDark(false);
    } catch {
      /* ignore */
    }
  }, []);

  const onLogout = () => {
    logout();
    nav('/');
    setMenuOpen(false);
  };

  const contactEmail = 'nathanwhittaker141@gmail.com';
  const contactName = 'Ante';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="container-max flex items-center justify-between py-4 gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0" onClick={() => setMenuOpen(false)}>
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-brand-500 to-sky-400 shadow-lg shadow-brand-500/40" />
            <div>
              <p className="text-sm font-semibold tracking-wide uppercase text-slate-800 dark:text-slate-200">
                NovaForge
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Web Studios</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/" className={navLinkClasses}>
              Home
            </NavLink>
            <NavLink to="/request" className={navLinkClasses}>
              Request a Website
            </NavLink>
            {user && (
              <NavLink to="/dashboard" className={navLinkClasses}>
                Dashboard
              </NavLink>
            )}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navLinkClasses}>
                Admin
              </NavLink>
            )}
            {!user ? (
              <>
                <NavLink to="/login" className={navLinkClasses}>
                  Log in
                </NavLink>
                <Link
                  to="/register"
                  className="rounded-full bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white shadow-md shadow-brand-500/30 hover:bg-brand-400"
                >
                  Register
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={onLogout}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Log out
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDark((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
              aria-label="Toggle dark mode"
            >
              {dark ? '☾' : '☀︎'}
            </button>
            <button
              type="button"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
              aria-expanded={menuOpen}
              aria-label="Menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="text-lg leading-none">{menuOpen ? '×' : '≡'}</span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950 animate-fade-in">
            <div className="flex flex-col gap-3">
              <NavLink to="/" className={navLinkClasses} onClick={() => setMenuOpen(false)}>
                Home
              </NavLink>
              <NavLink to="/request" className={navLinkClasses} onClick={() => setMenuOpen(false)}>
                Request a Website
              </NavLink>
              {user && (
                <NavLink to="/dashboard" className={navLinkClasses} onClick={() => setMenuOpen(false)}>
                  Dashboard
                </NavLink>
              )}
              {user?.role === 'admin' && (
                <NavLink to="/admin" className={navLinkClasses} onClick={() => setMenuOpen(false)}>
                  Admin
                </NavLink>
              )}
              {!user ? (
                <>
                  <NavLink to="/login" className={navLinkClasses} onClick={() => setMenuOpen(false)}>
                    Log in
                  </NavLink>
                  <Link
                    to="/register"
                    className="rounded-full bg-brand-500 px-4 py-2 text-center text-sm font-semibold text-white"
                    onClick={() => setMenuOpen(false)}
                  >
                    Register
                  </Link>
                </>
              ) : (
                <button type="button" onClick={onLogout} className="text-left text-sm font-medium">
                  Log out
                </button>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="container-max py-10 min-h-[60vh]">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-8 mt-auto dark:border-slate-800 dark:bg-slate-950">
        <div className="container-max flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-500">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <p>© {new Date().getFullYear()} NovaForge Web Studios. All rights reserved.</p>
            <p>
              Contact {contactName}:{' '}
              <a
                className="underline underline-offset-4 hover:text-slate-700 dark:hover:text-slate-300"
                href={`mailto:${contactEmail}`}
              >
                {contactEmail}
              </a>
            </p>
          </div>
          <p>React · Tailwind · Node · MongoDB · Stripe</p>
        </div>
      </footer>
    </div>
  );
};
