"use client";
import { useState } from "react";
import "./LeadsManage.css";

const leads = [
  {
    id: 1,
    initials: "EV",
    avatarClass: "leadsManageAvatarPurple",
    name: "Elena Vance",
    company: "Vance Global Systems",
    score: 92,
    scoreClass: "leadsManageScoreCyan",
    barClass: "leadsManageBarCyan",
    barWidth: "92%",
    budget: "$120,000",
    source: "LinkedIn",
    status: "URGENT BUYER",
    statusClass: "leadsManageUrgent",
  },
  {
    id: 2,
    initials: "MT",
    avatarClass: "leadsManageAvatarBlue",
    name: "Marcus Thorne",
    company: "Thorne Interactive",
    score: 64,
    scoreClass: "leadsManageScorePurple",
    barClass: "leadsManageBarPurple",
    barWidth: "64%",
    budget: "$45,000",
    source: "Inbound",
    status: "INVESTOR",
    statusClass: "leadsManageInvestor",
  },
  {
    id: 3,
    initials: "SR",
    avatarClass: "leadsManageAvatarPink",
    name: "Sienna Rossi",
    company: "Studio Rossi",
    score: 88,
    scoreClass: "leadsManageScoreCyan",
    barClass: "leadsManageBarCyan",
    barWidth: "88%",
    budget: "$210,000",
    source: "Referral",
    status: "HIGH GROWTH",
    statusClass: "leadsManageHighGrowth",
  },
  {
    id: 4,
    initials: "DC",
    avatarClass: "leadsManageAvatarGreen",
    name: "David Chen",
    company: "Chen & Partners",
    score: 42,
    scoreClass: "leadsManageScoreMuted",
    barClass: "leadsManageBarMuted",
    barWidth: "42%",
    budget: "$75,000",
    source: "Event",
    status: "WARM LEAD",
    statusClass: "leadsManageWarmLead",
  },
];

const filters = ["All Leads", "Hot", "Warm"];

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState("All Leads");
  const [activeRow, setActiveRow] = useState(1);

  return (
    <div className="leadsManageRoot">

      {/* ── Header ── */}
      <div className="leadsManageHeader">
        <div>
          <div className="leadsManageHTitle">Lead Intelligence</div>
          <div className="leadsManageHSub">Real-time intent tracking and AI curation engine.</div>
        </div>
        <div className="leadsManageFilters">
          {filters.map((f) => (
            <button
              key={f}
              className={`leadsManageFbtn ${activeFilter === f ? "leadsManageFbtnActive" : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
          <button className="leadsManageFbtnIcon">⚙ Source</button>
          <button className="leadsManageFbtnIcon">💳 Budget</button>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="leadsManageMain">

        {/* ── Left Column ── */}
        <div className="leadsManageLeft">

          {/* Lead Table */}
          <div className="leadsManageCard">
            <div className="leadsManageTblHeader">
              <span>Lead Details</span>
              <span>Buying Intent</span>
              <span>Budget</span>
              <span>Source</span>
              <span>AI Status</span>
            </div>

            {leads.map((lead) => (
              <div
                key={lead.id}
                className={`leadsManageRow ${activeRow === lead.id ? "leadsManageRowActive" : ""}`}
                onClick={() => setActiveRow(lead.id)}
              >
                <div className="leadsManageColLead">
                  <div className={`leadsManageAvatar ${lead.avatarClass}`}>{lead.initials}</div>
                  <div>
                    <div className="leadsManageLeadName">{lead.name}</div>
                    <div className="leadsManageLeadCo">{lead.company}</div>
                  </div>
                </div>

                <div className="leadsManageColIntent">
                  <div className="leadsManageIbar">
                    <div
                      className={`leadsManageIfill ${lead.barClass}`}
                      style={{ width: lead.barWidth }}
                    />
                  </div>
                  <span className={`leadsManageIscore ${lead.scoreClass}`}>{lead.score}</span>
                </div>

                <div className="leadsManageColBudget">
                  <span className="leadsManageBudget">{lead.budget}</span>
                </div>

                <div className="leadsManageColSource">
                  <span className="leadsManageSrcBadge">{lead.source}</span>
                </div>

                <div className="leadsManageColAistat">
                  <span className={`leadsManageStatBadge ${lead.statusClass}`}>{lead.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Row */}
          <div className="leadsManageBottomRow">

            {/* Predictive Revenue */}
            <div className="leadsManageRevCard">
              <div className="leadsManageRevHeader">
                <span className="leadsManageRevTitle">Predictive Revenue</span>
                <span className="leadsManageRevTrend">↗</span>
              </div>
              <div className="leadsManageRevAmount">$842k</div>
              <div className="leadsManageRevChange">+14.2% from previous AI cycle</div>
              <div className="leadsManageChart">
                <div className="leadsManageBarW"><div className="leadsManageBar" style={{ height: "40%" }} /></div>
                <div className="leadsManageBarW"><div className="leadsManageBar" style={{ height: "55%" }} /></div>
                <div className="leadsManageBarW"><div className="leadsManageBar" style={{ height: "35%" }} /></div>
                <div className="leadsManageBarW"><div className="leadsManageBar" style={{ height: "65%" }} /></div>
                <div className="leadsManageBarW"><div className="leadsManageBar leadsManageBarViolet" style={{ height: "45%" }} /></div>
                <div className="leadsManageBarW"><div className="leadsManageBar leadsManageBarTeal leadsManageBarGlow" style={{ height: "80%" }} /></div>
              </div>
            </div>

            {/* AI Efficiency */}
            <div className="leadsManageAiCard">
              <div className="leadsManageAiHeader">
                <span className="leadsManageAiTitle">AI Efficiency</span>
              </div>
              <div className="leadsManageAiSub">Lead processing &amp; scoring</div>
              <div className="leadsManageGaugeWrap">
                <svg width="130" height="130" viewBox="0 0 130 130">
                  <circle cx="65" cy="65" r="52" fill="none" stroke="#2a2a3a" strokeWidth="10" />
                  <circle
                    cx="65" cy="65" r="52" fill="none"
                    stroke="url(#gg)" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray="326.73" strokeDashoffset="81.68"
                    transform="rotate(-90 65 65)"
                    style={{ filter: "drop-shadow(0 0 8px #00e5cc80)" }}
                  />
                  <defs>
                    <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00e5cc" />
                      <stop offset="100%" stopColor="#00bfa8" />
                    </linearGradient>
                  </defs>
                  <text
                    x="65" y="68"
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#f0f0f5" fontSize="26" fontWeight="800"
                    fontFamily="DM Sans, sans-serif"
                  >
                    75%
                  </text>
                </svg>
              </div>
              <div className="leadsManageOptlabel">OPTIMISED FLUX</div>
            </div>

          </div>
        </div>

        {/* ── Right Column: Profile ── */}
        <div className="leadsManageCardPad">
          <div className="leadsManageProfileHeader">
            <div className="leadsManageAvWrap">
              <div className="leadsManageAvBig">EV</div>
              <div className="leadsManageOnline" />
            </div>
            <button className="leadsManageMoreBtn">···</button>
          </div>

          <div className="leadsManagePname">Elena Vance</div>
          <div className="leadsManageProle">Chief Product Officer</div>

          <div className="leadsManageScoreCard">
            <div className="leadsManageScLabel">
              <span>BUYING INTENT SCORE</span>
              <span>⚡</span>
            </div>
            <div className="leadsManageScRow">
              <span className="leadsManageScVal">92</span>
              <span className="leadsManageScMax">/100</span>
            </div>
            <div className="leadsManageScTags">
              <span className="leadsManageTagG">Positive Sentiment</span>
              <span className="leadsManageTagP">Technical Value</span>
            </div>
          </div>

          <div className="leadsManageSumLabel">🤖 LAST AI CALL SUMMARY</div>
          <div className="leadsManageSumBox">
            <div className="leadsManageSumText">
              "Prospect expressed significant frustration with current legacy infrastructure
              latency. Highlighted a hard deadline for Q3 implementation. Sentiment shifted
              to high-affinity when discussing our proprietary curation engine."
            </div>
            <div className="leadsManageSumFooter">
              <div className="leadsManageRecRow">
                <div className="leadsManageRecDot" />
                <span className="leadsManageRecLabel">1m 32s recorded</span>
              </div>
              <button className="leadsManageTranscriptBtn">VIEW TRANSCRIPT</button>
            </div>
          </div>

          <div className="leadsManageActionRow">
            <button className="leadsManageCallBtn">📞 Initiate Call</button>
            <button className="leadsManageSchedBtn">📅 Schedule</button>
          </div>
        </div>

      </div>
    </div>
  );
}