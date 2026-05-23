"use client";

import React, { useState, useEffect } from "react";

// ── Icons ────────────────────────────────────────────────────
const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
  </svg>
);

const PlayIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const DotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const BotIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.8">
    <rect x="3" y="8" width="18" height="13" rx="3" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    <circle cx="9" cy="14" r="1.2" fill="#06b6d4" />
    <circle cx="15" cy="14" r="1.2" fill="#06b6d4" />
    <line x1="9" y1="17.5" x2="15" y2="17.5" stroke="#06b6d4" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const SentimentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const ShuffleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);

const KeyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const PersonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// ── Static Data ───────────────────────────────────────────────
const CHAT_MESSAGES = [
  {
    role: "ai",
    text: '"I completely understand. Our Editorial Intelligence engine is specifically designed to handle exactly that kind of data volume. Would you like to see a demo of the clustering feature?"',
  },
  {
    role: "user",
    text: '"That sounds interesting. How does it integrate with our existing CRM workflow though? We use Salesforce."',
  },
  {
    role: "ai",
    text: '"Great question. We have a native Salesforce connector that syncs all lead intelligence in real-time. In fact, I can push our current conversation notes to your dashboard immediately after this call."',
  },
];

const CALL_LOGS = [
  { name: "Jonathan Vance", time: "Today, 2:45 PM", tag: "Converted", tagColor: "#22c55e", duration: "12:14" },
  { name: "Sarah Mitchell", time: "Today, 11:20 AM", tag: "Follow-up Required", tagColor: "#f59e0b", duration: "05:42" },
];

const MINI_BARS = [30, 45, 38, 55, 42, 68, 58, 75, 62, 80];

// ── Keyframe injection ────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap');

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @keyframes wave {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(0.3); }
  }

  .wave-bar { animation: wave 1.2s ease-in-out infinite; }
  .wave-bar:nth-child(1)  { animation-delay: 0s; }
  .wave-bar:nth-child(2)  { animation-delay: 0.1s; }
  .wave-bar:nth-child(3)  { animation-delay: 0.2s; }
  .wave-bar:nth-child(4)  { animation-delay: 0.3s; }
  .wave-bar:nth-child(5)  { animation-delay: 0.4s; }
  .wave-bar:nth-child(6)  { animation-delay: 0.5s; }
  .wave-bar:nth-child(7)  { animation-delay: 0.4s; }
  .wave-bar:nth-child(8)  { animation-delay: 0.3s; }
  .wave-bar:nth-child(9)  { animation-delay: 0.2s; }
  .wave-bar:nth-child(10) { animation-delay: 0.1s; }

  .online-dot { animation: pulse 2s infinite; }

`;

// ── Main Component ────────────────────────────────────────────
export default function AiCallCenterPage() {
  const [duration, setDuration] = useState(252);

  useEffect(() => {
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatDuration = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* Page */}
      <div style={{
        minHeight: "100vh",
        background: "#0d0f14",
        color: "#e2e8f0",
        padding: "28px 32px",
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.02em" }}>
              AI Call Center
            </h1>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4, letterSpacing: "0.03em" }}>
              Neural processing active. 14 ongoing sessions.
            </p>
          </div>

          <button style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
            border: "none", borderRadius: 50, padding: "12px 24px",
            color: "#fff",
            fontSize: "0.9rem", fontWeight: 500,
            cursor: "pointer",
          }}>
            <PhoneIcon /> START AI CALL
          </button>
        </div>

        {/* ── Main Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>

          {/* ── Left Column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Agent Card */}
            <div style={{
              background: "#151820", border: "1px solid #1e2330",
              borderRadius: 16, padding: "20px 24px 24px", position: "relative", overflow: "hidden",
            }}>
              {/* top shimmer line */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 1,
                background: "linear-gradient(90deg, transparent, #06b6d440, transparent)",
              }} />

              {/* Agent top row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, background: "#1e2330", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1.5px solid #06b6d430", position: "relative",
                  }}>
                    <BotIcon />
                    <span className="online-dot" style={{
                      position: "absolute", bottom: 2, right: 2,
                      width: 10, height: 10, background: "#22c55e",
                      borderRadius: "50%", border: "2px solid #151820",
                    }} />
                  </div>
                  <div>
                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.02em" }}>
                      Editorial AI Agent v4.2
                    </p>
                    <p style={{ fontSize: "0.65rem", color: "#06b6d4", letterSpacing: "0.1em", marginTop: 3 }}>
                      STATUS: CONNECTED / LIVE
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.6rem", color: "#475569", letterSpacing: "0.12em", display: "block", marginBottom: 4 }}>
                    DURATION
                  </span>
                  <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "#f1f5f9", letterSpacing: "0.05em" }}>
                    {formatDuration(duration)}
                  </span>
                </div>
              </div>

              {/* Waveform */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, gap: 4, marginBottom: 24 }}>
                {[32, 52, 84, 108, 92, 120, 100, 78, 54, 28].map((h, i) => (
                  <div key={i} className="wave-bar" style={{
                    width: 4, height: h, borderRadius: 2,
                    background: "#06b6d4", opacity: 0.85,
                  }} />
                ))}
              </div>

              {/* Chat messages */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {CHAT_MESSAGES.map((msg, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <span style={{
                      fontSize: "0.6rem",
                      letterSpacing: "0.1em", paddingTop: 10, minWidth: 30, flexShrink: 0,
                      color: msg.role === "ai" ? "#06b6d4" : "#64748b",
                    }}>
                      {msg.role === "ai" ? "AI" : "USER"}
                    </span>
                    <div style={{
                      flex: 1, background: "#1a1f2e", border: "1px solid #1e2330",
                      borderLeft: msg.role === "ai" ? "2px solid #06b6d4" : "2px solid #334155",
                      borderRadius: 10, padding: "10px 14px",
                      fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.6,
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Call Logs */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.03em" }}>
                  Recent Call Logs
                </span>
                <button style={{
                  fontSize: "0.65rem",
                  color: "#06b6d4", letterSpacing: "0.08em",
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                }}>
                  VIEW ALL RECORDS
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {CALL_LOGS.map((log, i) => (
                  <div key={i} style={{
                    background: "#151820", border: "1px solid #1e2330",
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <button style={{
                      width: 36, height: 36, background: "#1a1f2e",
                      border: "1px solid #1e2330", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "#64748b", flexShrink: 0,
                    }}>
                      <PlayIcon />
                    </button>

                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#e2e8f0", marginBottom: 3 }}>
                        {log.name}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "#475569" }}>
                        <span>{log.time}</span>
                        <span>•</span>
                        <span style={{ color: log.tagColor, fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.05em" }}>
                          {log.tag}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "0.58rem", color: "#475569", letterSpacing: "0.1em", display: "block" }}>
                          DURATION
                        </span>
                        <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#cbd5e1" }}>
                          {log.duration}
                        </span>
                      </div>
                      <button style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 4, display: "flex" }}>
                        <DotsIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Live Sentiment */}
            <div style={{
              background: "#151820", border: "1px solid #1e2330",
              borderRadius: 16, padding: "18px 20px 20px", position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 1,
                background: "linear-gradient(90deg, #06b6d430, transparent)",
              }} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: "0.62rem", letterSpacing: "0.14em", color: "#06b6d4" }}>
                  LIVE SENTIMENT
                </span>
                <SentimentIcon />
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: "3.2rem", fontWeight: 700, color: "#06b6d4", lineHeight: 1 }}>
                  94
                </span>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "#06b6d4" }}>
                  % Positive
                </span>
              </div>

              <p style={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.6, marginBottom: 16 }}>
                The lead is showing high interest in integration capabilities and speed. Intent score has increased by 14 points since start.
              </p>

              {/* Mini bar chart */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
                {MINI_BARS.map((h, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${h}%`, borderRadius: "4px 4px 0 0",
                    background: i >= 7 ? "#06b6d4" : "#1e2a38",
                  }} />
                ))}
              </div>
            </div>

            {/* AI Live Suggestions */}
            <div>
              <p style={{ fontSize: "0.62rem", letterSpacing: "0.14em", color: "#64748b", marginBottom: 12 }}>
                AI LIVE SUGGESTIONS
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                {/* Strategy Shift */}
                <div style={{ background: "#1a1535", border: "1px solid #3b2d6e50", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <ShuffleIcon />
                    <span style={{ fontSize: "0.6rem", letterSpacing: "0.12em", fontWeight: 600, color: "#a78bfa" }}>
                      STRATEGY SHIFT
                    </span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.55 }}>
                    Suggest the &quot;Enterprise Pilot&quot; program. User mentioned budget constraints twice.
                  </p>
                </div>

                {/* Keyword Alert */}
                <div style={{ background: "#151d1a", border: "1px solid #06b6d420", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <KeyIcon />
                    <span style={{ fontSize: "0.6rem", letterSpacing: "0.12em", fontWeight: 600, color: "#06b6d4" }}>
                      KEYWORD ALERT
                    </span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.55 }}>
                    Mentioned &quot;Competitive Edge&quot;. AI agent is pivoting to market-share data points.
                  </p>
                </div>

              </div>
            </div>

            {/* Lead Intelligence */}
            <div style={{ background: "#151820", border: "1px solid #1e2330", borderRadius: 16, padding: "18px 20px 20px" }}>
              <p style={{ fontSize: "0.62rem", letterSpacing: "0.14em", color: "#64748b", marginBottom: 14 }}>
                LEAD INTELLIGENCE
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: "linear-gradient(135deg, #1e2a38, #2d3748)",
                  border: "1.5px solid #2d3748", display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <PersonIcon />
                </div>
                <div>
                  <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#e2e8f0", marginBottom: 3 }}>Marcus Thorne</p>
                  <p style={{ fontSize: "0.72rem", color: "#64748b" }}>CTO at Digital Horizon</p>
                </div>
              </div>

              {/* Lead Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[{ label: "LEAD SCORE", value: "A+" }, { label: "PROBABILITY", value: "82%" }].map((stat, i) => (
                  <div key={i} style={{ background: "#1a1f2e", border: "1px solid #1e2330", borderRadius: 10, padding: "10px 12px" }}>
                    <span style={{ fontSize: "0.58rem", color: "#475569", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
                      {stat.label}
                    </span>
                    <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#06b6d4", lineHeight: 1 }}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Decision Authority */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Decision Authority</span>
                <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", color: "#06b6d4" }}>
                  HIGH
                </span>
              </div>
              <div style={{ height: 4, background: "#1e2330", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "75%", background: "linear-gradient(90deg, #06b6d4, #22c55e)", borderRadius: 2 }} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}