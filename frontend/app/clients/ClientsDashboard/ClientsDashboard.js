'use client'

import './ClientsDashboard.css'

export default function ClientsDashboard() {
  return (
    <div className="clients-dashboard">

      {/* Hidden SVG gradient defs for the ring */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <linearGradient id="cyanGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00e5ff" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
        </defs>
      </svg>

      {/* ================================================================
          SECTION 1 — CLIENT INSIGHTS HEADER
          ================================================================ */}
      <div className="dashboard__header">
        <div className="dashboard__title">
          <h1>Client Insights</h1>
          <p>Real-time neural intelligence for your real estate portfolio.</p>
        </div>
        <div className="live-badge">
          <span className="live-badge__dot" />
          LIVE SYNC ACTIVE
        </div>
      </div>

      {/* ================================================================
          SECTION 1 — TOP 3 METRIC CARDS
          ================================================================ */}
      <div className="top-cards">

        {/* ── Card: Lead Density ── */}
        <div className="card card--lead-density">
          <div className="card__header-row">
            <span className="card__label">Lead Density</span>
            {/* target / crosshair icon */}
            <span className="card__icon--cyan">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83
                         M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
            </span>
          </div>

          {/* Circular ring */}
          <div className="lead-ring">
            <div className="lead-ring__outer">
              <svg className="lead-ring__svg" viewBox="0 0 132 132">
                <circle className="lead-ring__track" cx="66" cy="66" r="56" />
                <circle className="lead-ring__fill"  cx="66" cy="66" r="56" />
              </svg>
              <div className="lead-ring__text">
                <div className="lead-ring__number">142</div>
                <div className="lead-ring__sublabel">HOT LEADS</div>
              </div>
            </div>
          </div>

          {/* Footer stats */}
          <div className="card__footer-row">
            <div>
              <div className="footer-stat__label">Total Pipeline</div>
              <div className="footer-stat__value">2,480</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="footer-stat__label">Conversion</div>
              <div className="footer-stat__value footer-stat__value--positive">+12.4%</div>
            </div>
          </div>
        </div>

        {/* ── Card: AI Calls ── */}
        <div className="card card--ai-calls">
          <div className="card__header-row">
            <span className="card__label">AI Calls</span>
            <span className="today-badge">TODAY</span>
          </div>

          <div className="card__big-number">482</div>

          <div className="progress-bar">
            <div className="progress-bar__track">
              <div className="progress-bar__fill" />
            </div>
          </div>

          <p className="card__desc">
            78% of daily target reached. AI agent &ldquo;Aria&rdquo; is currently
            handling 12 active inquiries.
          </p>

          <div className="card__tags">
            <span className="tag">42 Sold</span>
            <span className="tag">156 Booked</span>
          </div>
        </div>

        {/* ── Card: Efficiency ── */}
        <div className="card card--efficiency">
          <div className="card__header-row">
            <span className="card__label">Efficiency</span>
            {/* lightning bolt icon */}
            <span className="card__icon--cyan">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
          </div>

          <div className="efficiency__number">
            24.8<span>%</span>
          </div>
          <div className="efficiency__label">Global Conversion Index</div>

          <div className="ai-rec-box">
            <div className="ai-rec-box__title">
              <span>↗</span> AI Recommendation
            </div>
            <p className="ai-rec-box__text">
              Increasing follow-up frequency for &lsquo;Interested&rsquo; leads
              could boost conversion by 4.2%.
            </p>
          </div>
        </div>

      </div>

      {/* ================================================================
          SECTION 2 — INTELLIGENCE FUNNEL + UPCOMING ACTIONS
          ================================================================ */}
      <div className="bottom-grid">

        {/* ── Intelligence Funnel ── */}
        <div className="card card--funnel">
          <div className="funnel__header">
            <div className="funnel__title">Intelligence Funnel</div>
            <div className="toggle-group">
              <button className="toggle-group__btn">Monthly</button>
              <button className="toggle-group__btn toggle-group__btn--active">Quarterly</button>
            </div>
          </div>

          <div className="funnel__bars">

            {/* Total Leads */}
            <div className="funnel__row">
              <div className="funnel__track">
                <div className="funnel__bar funnel__bar--total" />
                <span className="funnel__bar-label">Total Leads</span>
                <span className="funnel__bar-value">12,450</span>
              </div>
              <span className="funnel__pct">100%</span>
            </div>

            {/* Contacted */}
            <div className="funnel__row">
              <div className="funnel__track">
                <div className="funnel__bar funnel__bar--contacted" />
                <span className="funnel__bar-label">Contacted</span>
                <span className="funnel__bar-value">8,210</span>
              </div>
              <span className="funnel__pct">66% DR</span>
            </div>

            {/* Qualified */}
            <div className="funnel__row">
              <div className="funnel__track">
                <div className="funnel__bar funnel__bar--qualified" />
                <span className="funnel__bar-label">Qualified</span>
                <span className="funnel__bar-value">3,140</span>
              </div>
              <span className="funnel__pct">25% DR</span>
            </div>

            {/* Closed */}
            <div className="funnel__row">
              <div className="funnel__track">
                <div className="funnel__bar funnel__bar--closed" />
                <span className="funnel__bar-label">Closed</span>
                <span className="funnel__bar-value">942</span>
              </div>
              <span className="funnel__pct">7% NET</span>
            </div>

          </div>
        </div>

        {/* ── Upcoming Actions ── */}
        <div className="card card--upcoming">
          <div className="upcoming__title">Upcoming Actions</div>

          <div className="upcoming__list">

            <div className="action-item">
              <div>
                <div className="action-item__name">Marcus Thompson</div>
                <div className="action-item__desc">
                  Property Tour: Skyloft Penthouse A1.<br />
                  AI pre-vetted financial status.
                </div>
              </div>
              <span className="time-badge time-badge--urgent">IN 19M</span>
            </div>

            <div className="action-item">
              <div>
                <div className="action-item__name">Elena Rodriguez</div>
                <div className="action-item__desc">
                  Closing Documents: Waterfront Villa.<br />
                  Awaiting digital signature.
                </div>
              </div>
              <span className="time-badge time-badge--today">TODAY 2PM</span>
            </div>

            <div className="action-item">
              <div>
                <div className="action-item__name">Sarah Jenkins</div>
                <div className="action-item__desc">
                  Initial Inquiry Follow-up. Prefers<br />
                  WhatsApp communication.
                </div>
              </div>
              <span className="time-badge time-badge--tomorrow">TOMORROW</span>
            </div>

          </div>

          <a href="#" className="upcoming__view-link">View Full Schedule</a>
        </div>

      </div>

      {/* ================================================================
          SECTION 3 — INTELLIGENCE STREAM
          ================================================================ */}
      <div className="card card--stream">
        <div className="stream__title">Intelligence Stream</div>

        <div className="stream__list">

          <div className="stream__item">
            <span className="stream__dot stream__dot--cyan" />
            <div className="stream__body">
              <div className="stream__item-title">AI Call Completed: High Intent Detected</div>
              <div className="stream__item-desc">
                Lead: Jonathan Wu · Agent: Aria · Outcome:{' '}
                <span className="stream__item-desc--highlight">Meeting Scheduled</span>
              </div>
            </div>
            <div className="stream__time">2 MINUTES AGO</div>
          </div>

          <div className="stream__item">
            <span className="stream__dot stream__dot--purple" />
            <div className="stream__body">
              <div className="stream__item-title">Large-Scale Data Ingestion</div>
              <div className="stream__item-desc">
                Refreshed Zillow API data for 42 properties in the Manhattan Sector.
              </div>
            </div>
            <div className="stream__time">14 MINUTES AGO</div>
          </div>

          <div className="stream__item">
            <span className="stream__dot stream__dot--gray" />
            <div className="stream__body">
              <div className="stream__item-title">Email Campaign Sent</div>
              <div className="stream__item-desc">
                &ldquo;Summer Luxury Series&rdquo; reached 1,200 leads. Current open rate: 38%.
              </div>
            </div>
            <div className="stream__time">1 HOUR AGO</div>
          </div>

        </div>
      </div>

    </div>
  )
}
