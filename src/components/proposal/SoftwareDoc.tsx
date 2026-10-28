/* eslint-disable @next/next/no-img-element */
import type { Lead } from '@/lib/leads';
import { fmtRange } from '@/lib/pricing';
import type { Proposal } from '@/lib/proposals';
import { Md } from './Md';

const CONTACT = 'Brainbric Innovations Pvt. Ltd. · contact@brainbric.com · +91 94886 25854';

function Head() {
  return (
    <div className="head">
      <div className="brand">
        <img src="/brainbric-logo.png" alt="" />
        Brainbric Innovations
      </div>
      <span>Proposal</span>
    </div>
  );
}

/** A client proposal: dark cover, then the editable sections flowing over as many A4 pages as they need. */
export function SoftwareDoc({ p, lead, sender }: { p: Proposal; lead: Lead; sender: { name: string; email: string | null } }) {
  const date = new Date(p.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const get = (k: string) => p.sections.find((s) => s.key === k);
  const order = ['understanding', 'solution', 'scope', 'technology', 'timeline'];
  const main = order.map(get).filter(Boolean) as Proposal['sections'];
  const extra = p.sections.filter((s) => !order.includes(s.key) && !['terms', 'next'].includes(s.key));
  const terms = get('terms');
  const next = get('next');
  const monthly = p.monthly_min != null || p.monthly_max != null;

  return (
    <div className="pdoc">
      <section className="page fixed cover">
        <div className="bar" />
        <div className="logo">
          <img src="/brainbric-logo.png" alt="" />
          <div>
            <b>Brainbric Innovations Pvt. Ltd.</b>
            <span>Software · AI · Product Development</span>
          </div>
        </div>
        <h1>
          Proposal: <em>{p.title}</em>
        </h1>
        <p className="sub">What we will build for you, how we will do it, how long it takes and what it costs.</p>
        <div className="proof">
          <div>
            <b>{fmtRange(p.price_min, p.price_max, p.currency)}</b>
            <span>indicative investment{monthly ? ', plus monthly plan' : ''}</span>
          </div>
          <div>
            <b>Fixed quote</b>
            <span>after a short scoping call</span>
          </div>
          <div>
            <b>Pay in stages</b>
            <span>milestone payments, no lump sum</span>
          </div>
        </div>
        <div className="for">
          <div>
            <label>Prepared for</label>
            <b>{lead.company ?? 'Your company'}</b>
            {lead.contact_name && (
              <span>
                {lead.contact_name}
                {lead.contact_role ? `, ${lead.contact_role}` : ''}
              </span>
            )}
          </div>
          <div>
            <label>Prepared by</label>
            {sender.name}
            <br />
            {date}
          </div>
        </div>
      </section>

      <section className="page flow">
        <Head />
        {main.map((s) => (
          <div key={s.key} className="section">
            <div className="kicker">{s.heading.toUpperCase()}</div>
            <Md text={s.body} />
          </div>
        ))}
        {extra.map((s) => (
          <div key={s.key} className="section">
            <div className="kicker">{s.heading.toUpperCase()}</div>
            <Md text={s.body} />
          </div>
        ))}

        <div className="section">
          <div className="kicker">INVESTMENT</div>
          <div className="box" style={{ borderColor: 'var(--ink)' }}>
            <div className="grid2" style={{ alignItems: 'baseline' }}>
              <div>
                <div className="muted" style={{ fontSize: '8.5pt' }}>
                  {monthly ? 'One-time setup' : 'Indicative project investment'}
                </div>
                <div className="price num">{fmtRange(p.price_min, p.price_max, p.currency)}</div>
              </div>
              {monthly && (
                <div>
                  <div className="muted" style={{ fontSize: '8.5pt' }}>
                    Monthly plan
                  </div>
                  <div className="price num">
                    {fmtRange(p.monthly_min, p.monthly_max, p.currency)} <span style={{ fontSize: '10pt', fontWeight: 600, color: 'var(--muted)' }}>/ month</span>
                  </div>
                </div>
              )}
            </div>
            {terms && (
              <div style={{ marginTop: '4mm' }}>
                <Md text={terms.body} />
              </div>
            )}
          </div>
        </div>

        <div className="section">
          <div className="kicker">WHY BRAINBRIC</div>
          <div className="grid2">
            <ul className="ticks">
              <li>A product team that builds software every day</li>
              <li>AI built in where it saves you time</li>
              <li>Weekly demos: you see progress, not promises</li>
            </ul>
            <ul className="ticks">
              <li>Transparent, staged pricing with no hidden costs</li>
              <li>Your code, your data, full ownership</li>
              <li>Support after launch, not just delivery</li>
            </ul>
          </div>
        </div>

        {next && (
          <div className="section">
            <div className="kicker">{next.heading.toUpperCase()}</div>
            <Md text={next.body} />
          </div>
        )}

        <div className="section grid2" style={{ marginTop: '6mm' }}>
          <div>
            <div className="sign" />
            <p style={{ marginTop: '2mm' }}>
              <b>{sender.name}</b>
              <br />
              <span className="muted">
                Brainbric Innovations Pvt. Ltd.
                {sender.email ? ` · ${sender.email}` : ''}
              </span>
            </p>
          </div>
          <div>
            <div className="sign" />
            <p style={{ marginTop: '2mm' }}>
              <b>Accepted by</b>
              <br />
              <span className="muted">{lead.company ?? 'Client'}</span>
            </p>
          </div>
        </div>
        <div className="foot">
          <span>{CONTACT}</span>
          <span>www.brainbric.com</span>
        </div>
      </section>
    </div>
  );
}
