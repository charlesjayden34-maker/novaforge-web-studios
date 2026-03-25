import { FormEvent, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';

type Lead = {
  businessName: string;
  ownerName: string;
  email: string;
  phone?: string;
  location: string;
  hasWebsite: boolean;
  source: string;
  lat: number;
  lon: number;
  mapsUrl: string;
};

type GeneratedEmail = {
  subject: string;
  body: string;
};

type DraftTemplate = {
  subject: string;
  body: string;
  followUpSubject: string;
  followUpBody: string;
};

function toCsvCell(value: string) {
  const escaped = String(value || '').replace(/"/g, '""');
  return `"${escaped}"`;
}

function cleanName(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const lower = normalized.toLowerCase();
  if (['unknown', 'n/a', 'na', 'none', '-', '--', 'not listed publicly'].includes(lower)) return '';
  return normalized;
}

function buildLocalDraftTemplate(lead: Lead, input: {
  yourName: string;
  yourBusiness: string;
  yourWebsite: string;
  callToAction: string;
}): DraftTemplate {
  const owner = cleanName(lead.ownerName);
  const businessName = String(lead.businessName || '').trim() || 'your business';
  const leadLocation = String(lead.location || '').trim();
  const senderName = String(input.yourName || '').trim() || 'Your Name';
  const senderBusiness = String(input.yourBusiness || '').trim() || 'Your Studio';
  const senderWebsite = String(input.yourWebsite || '').trim();
  const cta =
    String(input.callToAction || '').trim() ||
    'If you are open to it, I can share a quick homepage plan tailored to your business.';
  const greeting = owner ? `Hi ${owner},` : 'Hi there,';

  const subject = leadLocation
    ? `${businessName} in ${leadLocation}: quick website idea`
    : `Quick website idea for ${businessName}`;
  const body = [
    greeting,
    '',
    leadLocation
      ? `I found ${businessName} while looking at businesses in ${leadLocation}, and noticed there is no active website listed yet.`
      : `I came across ${businessName} and noticed there is no active website listed yet.`,
    `${senderBusiness} helps businesses launch simple websites that make it easy for customers to find services, hours, and contact details.`,
    '',
    cta,
    '',
    lead.mapsUrl ? `Listing reference: ${lead.mapsUrl}` : '',
    senderWebsite ? `Portfolio: ${senderWebsite}` : '',
    '',
    'Best,',
    senderName
  ]
    .filter(Boolean)
    .join('\n');

  const followUpSubject = `Following up: ${businessName} website idea`;
  const followUpBody = [
    greeting,
    '',
    `Quick follow-up in case my earlier note about a website for ${businessName} got buried.`,
    'I can send a short 1-page suggestion specific to your business and location.',
    '',
    cta,
    '',
    senderWebsite ? `Portfolio: ${senderWebsite}` : '',
    '',
    'Best,',
    senderName
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    body,
    followUpSubject,
    followUpBody
  };
}

export const LeadFinder = () => {
  const [location, setLocation] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [radiusKm, setRadiusKm] = useState(5);
  const [limit, setLimit] = useState(30);

  const [yourName, setYourName] = useState('');
  const [yourBusiness, setYourBusiness] = useState('Orvanta Studio');
  const [yourWebsite, setYourWebsite] = useState('');
  const [callToAction, setCallToAction] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedLocation, setResolvedLocation] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [emailByLead, setEmailByLead] = useState<Record<number, GeneratedEmail>>({});
  const [emailLoadingIndex, setEmailLoadingIndex] = useState<number | null>(null);

  const csvContent = useMemo(() => {
    if (!leads.length) return '';
    const header = [
      'businessName',
      'ownerName',
      'email',
      'phone',
      'optIn',
      'replied',
      'hasWebsite',
      'timezone',
      'location',
      'mapsUrl',
      'subject',
      'emailBody',
      'followUpSubject',
      'followUpBody'
    ].join(',');
    const rows = leads.map((lead, index) => {
      const generated = emailByLead[index];
      const drafted = buildLocalDraftTemplate(lead, {
        yourName,
        yourBusiness,
        yourWebsite,
        callToAction
      });
      return [
        toCsvCell(lead.businessName),
        toCsvCell(lead.ownerName),
        toCsvCell(lead.email),
        toCsvCell(lead.phone || ''),
        toCsvCell('false'),
        toCsvCell('false'),
        toCsvCell(String(lead.hasWebsite)),
        toCsvCell(''),
        toCsvCell(lead.location),
        toCsvCell(lead.mapsUrl),
        toCsvCell(generated?.subject || drafted.subject),
        toCsvCell(generated?.body || drafted.body),
        toCsvCell(drafted.followUpSubject),
        toCsvCell(drafted.followUpBody)
      ].join(',');
    });
    return [header, ...rows].join('\n');
  }, [leads, emailByLead, yourName, yourBusiness, yourWebsite, callToAction]);

  const discoverLeads = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setEmailByLead({});
    try {
      const res = await api.post<{ location: string; count: number; leads: Lead[] }>('/api/leads/discover', {
        location,
        businessType,
        radiusKm,
        limit
      });
      setLeads(res.data.leads || []);
      setResolvedLocation(res.data.location || location);
    } catch (err: any) {
      const msg = String(err?.response?.data?.error || 'Could not discover leads right now.');
      setError(msg);
      setLeads([]);
      setResolvedLocation('');
    } finally {
      setLoading(false);
    }
  };

  const generateEmail = async (lead: Lead, index: number) => {
    setError(null);
    setEmailLoadingIndex(index);
    try {
      const res = await api.post<GeneratedEmail>('/api/leads/generate-email', {
        lead,
        yourName,
        yourBusiness,
        yourWebsite,
        callToAction
      });
      setEmailByLead((prev) => ({ ...prev, [index]: res.data }));
    } catch (err: any) {
      const msg = String(err?.response?.data?.error || 'Could not generate this email.');
      setError(msg);
    } finally {
      setEmailLoadingIndex(null);
    }
  };

  const copyGeneratedEmail = async (index: number) => {
    const generated = emailByLead[index];
    if (!generated) return;
    const text = `Subject: ${generated.subject}\n\n${generated.body}`;
    await navigator.clipboard.writeText(text);
  };

  const downloadCsv = () => {
    if (!csvContent) return;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lead-finder-results.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Helmet>
        <title>Lead Finder · Orvanta Studio</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="space-y-8 animate-fade-in">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Lead finder</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Find public business listings with no website listed, then generate a personalized outreach draft.
          </p>
        </header>

        <form onSubmit={discoverLeads} className="nf-card p-5 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Search location
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="nf-input"
              placeholder="Bridgetown, Barbados"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Business type (optional)
            <input
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="nf-input"
              placeholder="barber, plumbing, bakery"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Radius (km)
            <input
              type="number"
              min={1}
              max={30}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="nf-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Max leads
            <input
              type="number"
              min={1}
              max={120}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="nf-input"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Your name for signatures
            <input
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
              className="nf-input"
              placeholder="Alex"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Your business name
            <input
              value={yourBusiness}
              onChange={(e) => setYourBusiness(e.target.value)}
              className="nf-input"
              placeholder="Orvanta Studio"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Portfolio / website URL
            <input
              value={yourWebsite}
              onChange={(e) => setYourWebsite(e.target.value)}
              className="nf-input"
              placeholder="https://your-site.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Call-to-action sentence (optional)
            <input
              value={callToAction}
              onChange={(e) => setCallToAction(e.target.value)}
              className="nf-input"
              placeholder="Would you like me to share a sample homepage mockup?"
            />
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={loading} className="nf-btn-primary">
              {loading ? 'Searching...' : 'Find leads'}
            </button>
            <button type="button" onClick={downloadCsv} disabled={!leads.length} className="nf-btn-secondary">
              Download CSV
            </button>
            <p className="text-xs text-slate-500">
              CSV exports with personalized subject/body per lead and <code>optIn=false</code> by default.
            </p>
          </div>
        </form>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        {!!leads.length && (
          <section className="space-y-4">
            <p className="text-sm text-slate-500">
              Found {leads.length} leads near {resolvedLocation}.
            </p>
            <div className="grid gap-4">
              {leads.map((lead, index) => {
                const generated = emailByLead[index];
                return (
                  <article key={`${lead.businessName}-${index}`} className="nf-card p-4 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{lead.businessName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Owner: {lead.ownerName || 'Not listed publicly'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Email: {lead.email || 'Not listed publicly'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Phone: {lead.phone || 'Not listed publicly'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Location: {lead.location || `(${lead.lat.toFixed(4)}, ${lead.lon.toFixed(4)})`}
                        </p>
                      </div>
                      <a
                        href={lead.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-600 underline underline-offset-2 dark:text-brand-300"
                      >
                        View listing
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => generateEmail(lead, index)}
                        disabled={emailLoadingIndex === index}
                        className="nf-btn-secondary"
                      >
                        {emailLoadingIndex === index ? 'Generating...' : 'Generate outreach email'}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyGeneratedEmail(index)}
                        disabled={!generated}
                        className="nf-btn-secondary"
                      >
                        Copy email
                      </button>
                    </div>

                    {generated && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          Subject: {generated.subject}
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300 font-sans">
                          {generated.body}
                        </pre>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
};
