import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const stats = [
  { label: 'Projects delivered', value: '120+' },
  { label: 'Average turnaround', value: '3 weeks' },
  { label: 'Client satisfaction', value: '4.9/5' }
];

const services = [
  {
    title: 'Custom Websites',
    desc: 'Pixel-perfect, responsive sites tailored to your brand and audience.',
    pills: ['Next.js / React', 'Tailwind CSS', 'SEO-ready']
  },
  {
    title: 'Web Apps & Dashboards',
    desc: 'Interactive apps, client portals, and internal tools that actually get used.',
    pills: ['SPA / SSR', 'APIs', 'Analytics']
  },
  {
    title: 'Conversion Optimization',
    desc: 'Landing pages that turn visitors into leads with data-driven UX.',
    pills: ['A/B testing', 'Funnels', 'Copy guidance']
  }
];

const portfolio = [
  {
    name: 'Aurora Collective',
    type: 'Creative Agency Site',
    result: '52% lift in leads',
    accent: 'from-brand-500/40'
  },
  {
    name: 'Nimbus SaaS',
    type: 'SaaS Marketing + App',
    result: '37% higher trial signups',
    accent: 'from-sky-500/40'
  },
  {
    name: 'Harbor & Co.',
    type: 'Boutique E‑commerce',
    result: '2.1x increase in revenue',
    accent: 'from-emerald-500/40'
  }
];

const testimonials = [
  {
    quote:
      'NovaForge took our vague idea and shipped a polished, fast site that our team is proud to share.',
    name: 'Lena Ortiz',
    role: 'Founder, Aurora Collective'
  },
  {
    quote:
      'The new dashboard slashed our support tickets. Our customers finally understand their data.',
    name: 'Daniel Kim',
    role: 'Product Lead, Nimbus SaaS'
  }
];

export const Landing = () => {
  return (
    <>
      <Helmet>
        <title>NovaForge Web Studios · Freelance Web Development</title>
        <meta
          name="description"
          content="NovaForge Web Studios builds fast, responsive websites and web apps for freelancers and teams. Request a project, track status, and pay securely."
        />
        <meta property="og:title" content="NovaForge Web Studios" />
        <meta
          property="og:description"
          content="Modern, conversion-ready websites and dashboards — React, Tailwind, and full-stack delivery."
        />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="/" />
      </Helmet>
      <div className="space-y-16 animate-fade-in">
        <section className="pt-4 grid gap-10 lg:grid-cols-[1.4fr,1fr] items-center">
          <div className="space-y-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Booking new projects for Q2
            </p>
            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                NovaForge Web Studios crafts{' '}
                <span className="bg-gradient-to-tr from-brand-500 to-sky-400 bg-clip-text text-transparent">
                  modern, conversion‑ready websites
                </span>{' '}
                for teams that care about the details.
              </h1>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-xl">
                From single‑page funnels to full client portals, we design and build fast,
                responsive experiences that look premium on every screen.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/request"
                className="inline-flex items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/40 transition hover:bg-brand-400 hover:scale-[1.02] active:scale-[0.99]"
              >
                Request a Website
              </Link>
              <a
                href="#portfolio"
                className="text-sm text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
              >
                View recent work
              </a>
            </div>
            <dl className="grid grid-cols-3 gap-4 max-w-md pt-4 border-t border-slate-200 dark:border-slate-800">
              {stats.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </dt>
                  <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div className="glass rounded-3xl p-5 md:p-6 shadow-xl shadow-brand-500/10 dark:shadow-brand-500/20">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                Typical NovaForge deliverable
              </p>
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 space-y-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-slate-700 dark:text-slate-300">Live build</span>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800">
                    React + Tailwind
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="h-8 rounded-xl bg-gradient-to-r from-brand-500/40 via-sky-500/30 to-transparent" />
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="h-2 rounded-full bg-slate-200/80 dark:bg-slate-800/80 w-4/5" />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="h-16 rounded-xl bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800" />
                  <div className="h-16 rounded-xl bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800" />
                  <div className="h-16 rounded-xl bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6" id="services">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Services
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Everything you need to launch confidently and convert traffic.
              </p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {services.map((service) => (
              <article
                key={service.title}
                className="glass rounded-2xl p-5 flex flex-col gap-3 shadow-md dark:shadow-slate-950/80 transition duration-300 hover:-translate-y-0.5"
              >
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{service.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">{service.desc}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {service.pills.map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6" id="portfolio">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Selected work
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                A snapshot of launches where design and performance met business goals.
              </p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {portfolio.map((item) => (
              <article
                key={item.name}
                className="glass rounded-2xl p-5 flex flex-col gap-3 shadow-md dark:shadow-slate-950/80 transition duration-300 hover:-translate-y-0.5"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.type}</p>
                </div>
                <div
                  className={`mt-1 h-16 rounded-xl bg-gradient-to-r ${item.accent} to-transparent border border-slate-200 dark:border-slate-800`}
                />
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mt-1">{item.result}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Clients</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Partners who trusted NovaForge with their first impression online.
              </p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="glass rounded-2xl p-5 flex flex-col gap-3 shadow-md dark:shadow-slate-950/80"
              >
                <p className="text-sm text-slate-800 dark:text-slate-100">“{t.quote}”</p>
                <figcaption className="text-xs text-slate-500 dark:text-slate-400">
                  {t.name} · {t.role}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </>
  );
};
