/* eslint-disable @next/next/no-img-element */
import { INSTITUTION_TYPES, MIN_BATCH, PROGRAMS, programInfo, TIERS } from '@/lib/colleges';
import type { Lead } from '@/lib/leads';
import { fmtRange } from '@/lib/pricing';
import type { Proposal } from '@/lib/proposals';
import { Md } from './Md';

const CONTACT = 'Brainbric Innovations Pvt. Ltd. · contact@brainbric.com · +91 94886 25854';

const DOMAINS = [
  { name: 'AI & Generative AI', topics: 'AI fundamentals, prompt engineering, AI tools for productivity, building with AI APIs, chatbots, responsible AI', projects: 'College FAQ chatbot, AI study assistant, resume screening tool' },
  { name: 'Full Stack Development', topics: 'HTML, CSS, JavaScript, React, Node.js, databases, Git and GitHub, APIs, deployment, AI-assisted coding', projects: 'Student management system, e-commerce site, job portal' },
  { name: 'Mobile App Development', topics: 'Mobile fundamentals, UI principles, cross-platform development, APIs, database connectivity, app deployment', projects: 'Attendance app, expense tracker, college information app' },
  { name: 'UI/UX Design', topics: 'Design thinking, user research, wireframing, Figma, prototyping, design systems', projects: 'Mobile app design, website redesign, dashboard interface' },
  { name: 'Data Analytics', topics: 'Analysis fundamentals, Excel for analytics, SQL, data cleaning, dashboards, visualisation', projects: 'Student performance dashboard, business analytics dashboard' },
  { name: 'Digital Marketing', topics: 'SEO, social media, content marketing, AI for marketing, campaign analytics, personal branding', projects: 'Campaign design, brand awareness strategy, content plan' },
  { name: 'Entrepreneurship & Startups', topics: 'Problem identification, idea validation, business model canvas, MVP, funding basics, pitch decks', projects: 'Startup business plan, investor pitch presentation' },
];

function Head() {
  return (
    <div className="head">
      <div className="brand">
        <img src="/brainbric-logo.png" alt="" />
        Brainbric Innovations
      </div>
      <span>Industry Readiness Programs 2026–27</span>
    </div>
  );
}

function Foot({ n }: { n: number }) {
  return (
    <div className="foot">
      <span>{CONTACT}</span>
      <span>{n}</span>
    </div>
  );
}

const sameish = (a: string | null | undefined, b: string) => {
  const x = (a ?? '').toLowerCase();
  const y = b.toLowerCase();
  return Boolean(x) && (x.includes(y.split(' ')[0]) || y.includes(x.split(' ')[0]));
};

/** The approved 8-page Industry Readiness proposal, personalised for one college, with a recommended-plan page after the cover. */
export function CollegeDoc({ p, lead, sender }: { p: Proposal; lead: Lead; sender: { name: string; email: string | null } }) {
  const date = new Date(p.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const program = programInfo(lead.program) ?? programInfo('awareness')!;
  const students = Math.max(MIN_BATCH, lead.student_strength ?? MIN_BATCH);
  const tier = lead.tier ? TIERS[lead.tier] : null;
  const outsideCoimbatore = Boolean(lead.district) && !/coimbatore/i.test(lead.district ?? '');
  const note = p.sections.find((s) => s.key === 'note');
  const reco = p.sections.find((s) => s.key === 'recommendation');
  const others = p.sections.filter((s) => !['note', 'recommendation'].includes(s.key));
  const flat = 'flat' in program && program.flat;

  return (
    <div className="pdoc">
      {/* 1. Cover */}
      <section className="page fixed cover">
        <div className="bar" />
        <div className="logo">
          <img src="/brainbric-logo.png" alt="" />
          <div>
            <b>Brainbric Innovations Pvt. Ltd.</b>
            <span>Software · AI · Product Development · Industry Training</span>
          </div>
        </div>
        <h1>
          Industry Readiness Programs <em>2026–27</em>
        </h1>
        <p className="sub">
          Hands-on training, real projects and career readiness for Engineering, Polytechnic and Arts &amp; Science students, delivered by a company
          that builds software every day.
        </p>
        <div className="proof">
          <div>
            <b className="num">160</b>
            <span>students trained across three institutions</span>
          </div>
          <div>
            <b>1 day – 4 weeks</b>
            <span>program formats to fit your academic calendar</span>
          </div>
          <div>
            <b className="num">From ₹150</b>
            <span>per student, all-inclusive pricing</span>
          </div>
        </div>
        <div className="for">
          <div>
            <label>Prepared for</label>
            <b>{lead.company}</b>
            <span>{[lead.department ? `Department of ${lead.department}` : null, lead.district].filter(Boolean).join(' · ')}</span>
          </div>
          <div>
            <label>Attention</label>
            {lead.contact_name ? `${lead.contact_name}${lead.contact_role ? `, ${lead.contact_role}` : ''}` : 'Principal · Placement Officer · Head of Department'}
            <br />
            <span style={{ color: '#9c96a1' }}>{date}</span>
          </div>
        </div>
      </section>

      {/* 2. Recommended plan */}
      <section className="page fixed">
        <Head />
        <div className="kicker">PREPARED FOR {(lead.company ?? '').toUpperCase()}</div>
        <h2>Your recommended plan</h2>
        {note && (
          <div className="lead" style={{ marginBottom: '7mm' }}>
            <Md text={note.body} />
          </div>
        )}
        <div className="box" style={{ borderColor: 'var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6mm' }}>
            <h3 style={{ fontSize: '14pt' }}>{program.label}</h3>
            <span className="pill dark">Recommended</span>
          </div>
          <p className="muted" style={{ marginTop: '1mm' }}>
            {program.duration}
            {lead.domain ? ` · ${lead.domain}` : ''}
            {lead.department ? ` · ${lead.department}` : ''}
          </p>
          <table style={{ marginTop: '4mm' }}>
            <tbody>
              {!flat && program.fee > 0 && (
                <>
                  <tr>
                    <td className="muted" style={{ width: '45%' }}>
                      Fee per student
                    </td>
                    <td className="num">₹{program.fee.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="muted">Students (minimum batch 50)</td>
                    <td className="num">{students.toLocaleString('en-IN')}</td>
                  </tr>
                </>
              )}
              <tr className="hl">
                <td>
                  <b>Estimated total</b>
                </td>
                <td className="num">
                  <b>{program.fee === 0 ? 'Complimentary' : fmtRange(p.price_min, p.price_max, 'INR')}</b>
                </td>
              </tr>
              {lead.best_time && (
                <tr>
                  <td className="muted">Suggested timing</td>
                  <td>{lead.best_time}</td>
                </tr>
              )}
              <tr>
                <td className="muted">Travel, food and stay</td>
                <td>
                  {outsideCoimbatore
                    ? 'Travel covered by Brainbric; the institution provides food and stay for the trainers.'
                    : 'Covered by Brainbric; no extra cost to the institution.'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {(reco || tier) && (
          <div style={{ marginTop: '7mm' }}>
            <h3>Why this program</h3>
            <Md text={reco?.body ?? tier!.pitch} />
          </div>
        )}
        {others.map((s) => (
          <div key={s.key} style={{ marginTop: '6mm' }}>
            <h3>{s.heading}</h3>
            <Md text={s.body} />
          </div>
        ))}
        <div className="box soft" style={{ marginTop: '8mm' }}>
          <b>Start with no risk.</b>{' '}
          <span className="muted">
            A complimentary 90-minute Industry Insight Talk lets your students and faculty see how we teach before you commit. Most of the fee is
            paid only after delivery.
          </span>
        </div>
        <Foot n={2} />
      </section>

      {/* 3. Why + track record */}
      <section className="page fixed">
        <Head />
        <div className="kicker">WHY THIS MATTERS</div>
        <h2>Students graduate with marks. Employers hire for skills.</h2>
        <p className="lead">
          Recruiters now expect freshers to have built something real, use AI tools confidently and present their work. Our programs close that gap
          inside your campus, in your timetable, at a fee that does not burden students or the institution.
        </p>
        <div className="grid3" style={{ marginTop: '7mm' }}>
          <div className="box soft">
            <h3>Practical, not theory</h3>
            <p className="muted">Every format ends in something students built themselves: a project, a portfolio piece or a pitch.</p>
          </div>
          <div className="box soft">
            <h3>AI built in</h3>
            <p className="muted">Students learn to use AI tools the way working developers, analysts and marketers use them today.</p>
          </div>
          <div className="box soft">
            <h3>Run by practitioners</h3>
            <p className="muted">Sessions are led by the people who deliver software, apps and AI projects for Brainbric&apos;s clients.</p>
          </div>
        </div>
        <div className="kicker" style={{ marginTop: '10mm' }}>
          RECENTLY DELIVERED
        </div>
        <h2>Trusted by institutions in the Coimbatore region</h2>
        <table style={{ marginTop: '3mm' }}>
          <thead>
            <tr>
              <th>Institution</th>
              <th>Program</th>
              <th>Students</th>
              <th className="r">Participants</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>Sri Ramakrishna Polytechnic College</b>
              </td>
              <td>One-month industry training program</td>
              <td>Diploma</td>
              <td className="r num">50</td>
            </tr>
            <tr>
              <td>
                <b>Nanjiah Lingammal Polytechnic College</b>
              </td>
              <td>One-day industry workshop</td>
              <td>Diploma</td>
              <td className="r num">60</td>
            </tr>
            <tr>
              <td>
                <b>SNS College of Arts &amp; Science</b>
              </td>
              <td>Industry workshop</td>
              <td>MCA (postgraduate)</td>
              <td className="r num">50</td>
            </tr>
            <tr>
              <td colSpan={3}>
                <b>Total</b>
              </td>
              <td className="r num">
                <b>160</b>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="kicker" style={{ marginTop: '10mm' }}>
          WHO WE ARE
        </div>
        <div className="grid2">
          <p>
            Brainbric Innovations Pvt. Ltd. is a technology company that designs and builds software, mobile apps, AI solutions and digital products
            for businesses in India and abroad. Training is how we share that working knowledge with the next generation of professionals.
          </p>
          <ul className="ticks">
            <li>Software and mobile app development</li>
            <li>AI and automation solutions</li>
            <li>UI/UX design and product development</li>
            <li>Data analytics and digital marketing</li>
          </ul>
        </div>
        <Foot n={3} />
      </section>

      {/* 4. Program ladder */}
      <section className="page fixed">
        <Head />
        <div className="kicker">PROGRAMS</div>
        <h2>Five formats. Start small, go deeper when you are ready.</h2>
        <p className="lead">Each format stands on its own. The row highlighted is the one we recommend for your institution.</p>
        <table style={{ marginTop: '6mm' }}>
          <thead>
            <tr>
              <th style={{ width: '34%' }}>Program</th>
              <th>Duration</th>
              <th className="r">Fee per student</th>
            </tr>
          </thead>
          <tbody>
            {PROGRAMS.filter((x) => !['fdp', 'partnership'].includes(x.slug)).map((x) => (
              <tr key={x.slug} className={x.slug === program.slug ? 'hl' : ''}>
                <td>
                  <b>{x.label}</b> {x.slug === program.slug && <span className="pill dark">Recommended for you</span>}
                </td>
                <td>{x.duration}</td>
                <td className="r num">{x.fee === 0 ? <span className="pill">Complimentary</span> : <b>₹{x.fee.toLocaleString('en-IN')}</b>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid2" style={{ marginTop: '8mm' }}>
          <div className={`box ${program.slug === 'fdp' ? '' : ''}`}>
            <h3>Faculty Development Program {program.slug === 'fdp' && <span className="pill dark">Recommended</span>}</h3>
            <p className="muted">Two days on AI tools for teaching, research and administration, and on current industry practice.</p>
            <p style={{ marginTop: '3mm' }}>
              <span className="price num">₹7,500</span> <span className="muted">per batch of up to 30 faculty</span>
            </p>
          </div>
          <div className="box">
            <h3>Every format includes</h3>
            <ul className="ticks">
              <li>Trainers, learning material and all software (free tools only)</li>
              <li>Certificates for every participant</li>
              <li>An institution report for your records</li>
              <li>Pre- and post-program assessment</li>
            </ul>
          </div>
        </div>
        <Foot n={4} />
      </section>

      {/* 5. Program plans */}
      <section className="page fixed">
        <Head />
        <div className="kicker">WHAT HAPPENS IN EACH PROGRAM</div>
        <h2>Planned to the hour, adapted to your batch</h2>
        <div className="grid2" style={{ marginTop: '5mm', alignItems: 'start' }}>
          <div>
            <h3>Industry Awareness Session · 1 day</h3>
            {[
              ['09:30', 'Where the industry is going: AI, automation and new roles'],
              ['10:45', 'Live demo: how a real app is built with AI tools'],
              ['12:00', 'What recruiters look for in freshers'],
              ['13:30', 'Resume clinic: students rebuild their resume'],
              ['14:45', 'LinkedIn profile upgrade, done live'],
              ['15:45', 'Career paths Q&A and certificates'],
            ].map(([t, d]) => (
              <div key={t} className="day">
                <b>{t}</b>
                <span>{d}</span>
              </div>
            ))}
            <h3 style={{ marginTop: '7mm' }}>Skill Workshop · 2 days</h3>
            <div className="day">
              <b>Day 1</b>
              <span>Domain foundations, tools set-up, guided exercises</span>
            </div>
            <div className="day">
              <b>Day 2</b>
              <span>Build a mini-project in teams, demo and certificates</span>
            </div>
          </div>
          <div>
            <h3>Innovation Bootcamp · 1 week</h3>
            {[
              'Industry readiness and emerging technology overview',
              'Domain learning I',
              'Domain learning II',
              'Practical workshop and skill building',
              'Project development in teams',
              'Project completion with mentoring',
              'Presentations, evaluation, career guidance, certificates',
            ].map((d, i) => (
              <div key={i} className="day">
                <b>Day {i + 1}</b>
                <span>{d}</span>
              </div>
            ))}
            <h3 style={{ marginTop: '7mm' }}>Industry Internship · 4 weeks</h3>
            {['Domain training and tools', 'Requirement study and design of a real-world project', 'Build with weekly mentor reviews', 'Testing, documentation, demo day, internship certificate'].map(
              (d, i) => (
                <div key={i} className="day">
                  <b>Week {i + 1}</b>
                  <span>{d}</span>
                </div>
              ),
            )}
          </div>
        </div>
        <div className="box soft" style={{ marginTop: '7mm' }}>
          <b>Flexible delivery.</b>{' '}
          <span className="muted">
            Programs run on campus, department-wise or institution-wide. Departments can be combined to reach the minimum batch, and the internship
            can run alongside regular classes or during vacation.
          </span>
        </div>
        <Foot n={5} />
      </section>

      {/* 6. Domains */}
      <section className="page fixed">
        <Head />
        <div className="kicker">DOMAINS</div>
        <h2>Seven domains, each ending in a real project</h2>
        <table style={{ marginTop: '4mm' }}>
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Domain</th>
              <th>Key topics</th>
              <th style={{ width: '30%' }}>Project examples</th>
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map((d) => (
              <tr key={d.name} className={sameish(lead.domain, d.name) ? 'hl' : ''}>
                <td>
                  <b>{d.name}</b> {sameish(lead.domain, d.name) && <span className="pill dark">For you</span>}
                </td>
                <td>{d.topics}</td>
                <td>{d.projects}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="box soft" style={{ marginTop: '7mm' }}>
          <b>{lead.department ? `For ${lead.department}` : 'For your departments'}:</b>{' '}
          <span className="muted">
            {lead.domain
              ? `we recommend ${lead.domain}${lead.institution_type ? ` for ${INSTITUTION_TYPES[lead.institution_type] ?? ''} students` : ''}, and can combine it with a second domain for a longer program.`
              : 'we match the domain to each department; tell us which departments join and we will propose the best fit.'}
          </span>
        </div>
        <Foot n={6} />
      </section>

      {/* 7. Value */}
      <section className="page fixed">
        <Head />
        <div className="kicker">WHAT YOUR INSTITUTION RECEIVES</div>
        <h2>More than a session: a record you can use</h2>
        <p className="lead">Within seven days of every program we send an institution report, ready to file for accreditation and reporting.</p>
        <div className="grid2" style={{ marginTop: '6mm' }}>
          <div className="box">
            <h3>Institution report pack</h3>
            <ul className="ticks">
              <li>Program summary, schedule and trainer details</li>
              <li>Attendance list and certificate register</li>
              <li>Pre- and post-assessment results</li>
              <li>Student feedback analysis</li>
              <li>Photographs of sessions and project demos</li>
              <li>List of projects built, with team names</li>
            </ul>
          </div>
          <div className="box">
            <h3>Useful for your documentation</h3>
            <p className="muted">
              The programs and the report can support your records of value-added and certificate courses, industry interaction, skill development and
              internships, as used in NAAC, NBA, NIRF and IIC reporting.
            </p>
            <p className="muted" style={{ marginTop: '2mm', fontSize: '8.5pt' }}>
              Classification for any framework is at the institution&apos;s discretion.
            </p>
          </div>
        </div>
        <div className="grid2" style={{ marginTop: '7mm' }}>
          <div>
            <h3>Benefits to students</h3>
            <ul className="ticks">
              <li>Hands-on skills in current tools and AI</li>
              <li>A real project for their portfolio and resume</li>
              <li>Confidence presenting and working in teams</li>
              <li>Internship and placement readiness</li>
            </ul>
          </div>
          <div>
            <h3>Benefits to the institution</h3>
            <ul className="ticks">
              <li>Stronger placement readiness and outcomes</li>
              <li>Active industry–academia collaboration</li>
              <li>Higher student engagement</li>
              <li>A partner for fests, hackathons and project expos</li>
            </ul>
          </div>
        </div>
        <Foot n={7} />
      </section>

      {/* 8. Investment */}
      <section className="page fixed">
        <Head />
        <div className="kicker">INVESTMENT</div>
        <h2>Simple per-student fees, no hidden costs</h2>
        <table style={{ marginTop: '4mm' }}>
          <thead>
            <tr>
              <th>Program</th>
              <th>Duration</th>
              <th className="r">Fee per student</th>
              <th className="r">For {students.toLocaleString('en-IN')} students</th>
            </tr>
          </thead>
          <tbody>
            {PROGRAMS.filter((x) => x.slug !== 'partnership').map((x) => {
              const isFlat = 'flat' in x && x.flat;
              return (
                <tr key={x.slug} className={x.slug === program.slug ? 'hl' : ''}>
                  <td>{x.slug === program.slug ? <b>{x.label}</b> : x.label}</td>
                  <td>{x.duration}</td>
                  <td className="r num">{x.fee === 0 ? 'Complimentary' : isFlat ? `₹${x.fee.toLocaleString('en-IN')} per batch` : `₹${x.fee.toLocaleString('en-IN')}`}</td>
                  <td className="r num">{x.fee === 0 || isFlat ? '–' : `₹${(x.fee * students).toLocaleString('en-IN')}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="grid3" style={{ marginTop: '4mm', fontSize: '9pt' }}>
          <p>
            <b>Minimum batch</b>
            <br />
            <span className="muted">50 students; departments and years may be combined.</span>
          </p>
          <p>
            <b>Larger batches</b>
            <br />
            <span className="muted">10% off for 150 or more students in one program.</span>
          </p>
          <p>
            <b>Fees include</b>
            <br />
            <span className="muted">Training, material, certificates, assessments and the report.</span>
          </p>
        </div>
        <h3 style={{ marginTop: '7mm' }}>Terms</h3>
        <table>
          <tbody>
            <tr>
              <td className="muted" style={{ width: '32%' }}>
                Payment
              </td>
              <td>30% to confirm dates, 70% after the program is delivered</td>
            </tr>
            <tr>
              <td className="muted">Taxes</td>
              <td>Fees are inclusive of GST</td>
            </tr>
            <tr>
              <td className="muted">Travel</td>
              <td>Trainers&apos; travel is covered by Brainbric</td>
            </tr>
            <tr>
              <td className="muted">Food and stay</td>
              <td>
                {outsideCoimbatore
                  ? `As ${lead.company ?? 'your institution'} is outside Coimbatore district, the institution provides food and accommodation for the trainers during the program`
                  : 'No cost to the institution'}
              </td>
            </tr>
            <tr>
              <td className="muted">From the institution</td>
              <td>A hall or lab, projector and sound, internet, student laptops or lab systems, and one faculty coordinator</td>
            </tr>
            <tr>
              <td className="muted">Validity</td>
              <td>This proposal is valid for 60 days from {date}</td>
            </tr>
          </tbody>
        </table>
        <Foot n={8} />
      </section>

      {/* 9. Close */}
      <section className="page fixed">
        <Head />
        <div className="kicker">WHY BRAINBRIC</div>
        <h2>A training partner that actually builds technology</h2>
        <div className="grid2" style={{ marginTop: '5mm' }}>
          <ul className="ticks">
            <li>Curriculum drawn from live client projects</li>
            <li>AI built into every domain, not an add-on</li>
            <li>Every format ends in something students built</li>
            <li>Proven delivery for diploma, UG and PG students</li>
          </ul>
          <ul className="ticks">
            <li>Fees designed to be affordable for every student</li>
            <li>Pay most of the fee only after delivery</li>
            <li>Documentation ready for accreditation records</li>
            <li>One partner from a 90-minute talk to a 4-week internship</li>
          </ul>
        </div>
        <div className="box" style={{ marginTop: '8mm', borderColor: 'var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6mm' }}>
            <h3 style={{ fontSize: '12.5pt' }}>Annual Campus Partnership</h3>
            <span className="pill dark">Best value</span>
          </div>
          <div className="grid2" style={{ marginTop: '3mm' }}>
            <ul className="ticks">
              <li>15% off every program fee for the year</li>
              <li>A complimentary Insight Talk for every new batch</li>
              <li>A complimentary Faculty Development Program</li>
            </ul>
            <ul className="ticks">
              <li>Priority scheduling around your calendar</li>
              <li>Support for your symposium or hackathon</li>
              <li>One consolidated year-end report</li>
            </ul>
          </div>
        </div>
        <div className="box soft" style={{ marginTop: '6mm', padding: '6mm' }}>
          <div className="kicker">NEXT STEP</div>
          <h2 style={{ fontSize: '15pt' }}>Confirm dates for the {program.label}</h2>
          <p className="muted">Reply with two preferred dates and the expected number of students. We confirm within a day and send the program plan within 48 hours.</p>
        </div>
        <div className="grid2" style={{ marginTop: '6mm', rowGap: '3mm' }}>
          <p>
            <span className="muted">Your contact</span>
            <br />
            <b>{sender.name}</b>
            {sender.email ? (
              <>
                <br />
                {sender.email}
              </>
            ) : null}
          </p>
          <p>
            <span className="muted">Company</span>
            <br />
            <b>Brainbric Innovations Pvt. Ltd.</b>
            <br />
            contact@brainbric.com · +91 94886 25854 · www.brainbric.com
          </p>
        </div>
        <div style={{ marginTop: '10mm', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12mm' }}>
          <div>
            <div className="sign" />
            <p style={{ marginTop: '2mm' }}>
              <b>Authorised Signatory</b>
              <br />
              <span className="muted">Brainbric Innovations Pvt. Ltd.</span>
            </p>
          </div>
          <div>
            <div className="sign" />
            <p style={{ marginTop: '2mm' }}>
              <b>Accepted by</b>
              <br />
              <span className="muted">{lead.company}</span>
            </p>
          </div>
        </div>
        <Foot n={9} />
      </section>
    </div>
  );
}
