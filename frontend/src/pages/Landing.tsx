import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { siteConfig, websiteTiers } from '../config/site';

const services = [
  {
    title: 'Business Websites',
    desc: 'Clean, modern websites built to make your business look trustworthy and easy to contact.',
    pills: ['Mobile-first', 'SEO foundations', 'Lead forms']
  },
  {
    title: 'Client Portals',
    desc: 'Private dashboards for your customers to track projects, files, status, and updates.',
    pills: ['Secure login', 'Status tracking', 'Custom workflows']
  },
  {
    title: 'Website Redesigns',
    desc: 'Turn outdated websites into high-conversion experiences that feel premium and current.',
    pills: ['UX cleanup', 'Performance', 'Conversion focus']
  }
];

const portfolio = [
  {
    name: 'Restaurant Brand Refresh',
    type: 'Website + menu ordering pages',
    result: 'More direct reservations in first month',
    accent: 'from-brand-500/40'
  },
  {
    name: 'Local Service Company',
    type: 'Lead generation site',
    result: 'Lower cost per lead from organic search',
    accent: 'from-sky-500/40'
  },
  {
    name: 'Consulting Studio',
    type: 'Premium positioning redesign',
    result: 'Stronger close rate on inbound calls',
    accent: 'from-emerald-500/40'
  }
];

const testimonials = [
  {
    quote: 'We finally have a website that matches the quality of our service.',
    name: 'Small Business Owner',
    role: 'Barbados'
  },
  {
    quote: 'The process was clear, communication was fast, and results felt very professional.',
    name: 'Service Provider',
    role: 'Caribbean region'
  }
];

export const Landing = () => {
  return (
    <>
      <Helmet>
        <title>Orvanta Studio · Freelance Web Development</title>
        <meta
          name="description"
          content="Orvanta Studio builds modern websites and client portals for businesses that want to grow online with confidence."
        />
        <meta property="og:title" content={siteConfig.brand.name} />
        <meta
          property="og:description"
          content="Modern business websites, fixed package pricing, and full project tracking."
        />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="/" />
      </Helmet>
      <div className="animate-fade-in space-y-16">
        <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.2fr,1fr]">
          <div className="space-y-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Taking new website projects
            </p>
            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {siteConfig.brand.name} builds{' '}
                <span className="bg-gradient-to-tr from-brand-500 to-sky-400 bg-clip-text text-transparent">
                  premium websites that help businesses get more clients
                </span>{' '}
                and look established online.
              </h1>
              <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
                Choose a fixed package, submit your request, and track progress in your dashboard.
                No confusing pricing range, no partial-payment back and forth.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/request" className="nf-btn-primary hover:scale-[1.02] active:scale-[0.99]">
                Request a Website
              </Link>
              <a href="#pricing" className="nf-btn-secondary">
                View packages
              </a>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Professional websites for growing businesses worldwide.
            </p>
          </div>
          <div className="nf-card p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Why clients choose us
            </p>
            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                Fixed pricing packages
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                Mobile-first premium design
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                Clear project tracking dashboard
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                Payment-first protection before delivery
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6" id="pricing">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Fixed website packages
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Pick the level that matches your business. Better scope means higher price.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {websiteTiers.map((tier) => (
              <article key={tier.id} className="nf-card flex flex-col gap-3 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                  {tier.name}
                </p>
                <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">${tier.price}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{tier.summary}</p>
                <Link to="/request" className="nf-btn-primary mt-2">
                  Choose {tier.name}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6" id="services">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Services
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Everything you need to launch confidently and convert traffic.
              </p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {services.map((service) => (
              <article key={service.title} className="nf-card flex flex-col gap-3 p-5">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{service.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{service.desc}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {service.pills.map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800"
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
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Selected work
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                A snapshot of launches where design and performance met business goals.
              </p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {portfolio.map((item) => (
              <article key={item.name} className="nf-card flex flex-col gap-3 p-5">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.type}</p>
                </div>
                <div
                  className={`mt-1 h-16 rounded-xl bg-gradient-to-r ${item.accent} to-transparent border border-slate-200 dark:border-slate-800`}
                />
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium mt-1">{item.result}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Clients</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Partners who trusted Orvanta with their first impression online.
              </p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {testimonials.map((t) => (
              <figure key={t.name} className="nf-card flex flex-col gap-3 p-5">
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
