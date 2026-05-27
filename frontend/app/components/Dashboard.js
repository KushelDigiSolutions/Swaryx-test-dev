import Image from "next/image";
import "./dashboard.css";

export default function Dashboard() {
  return (
    <div className="ai-adminDashboard-main">
      <div className="ai-adminDashboard-container">

        {/* TOP */}
        <div className="ai-adminDashboard-top">

          {/* PERFORMANCE CARD */}
          <div className="ai-adminDashboard-performance">
            <p className="tag">NETWORK INTELLIGENCE</p>

            <h1>
              System performance at <span>99.8%</span> peak efficiency.
            </h1>

            <div className="meta">
              <div>
                <p>GLOBAL STATUS</p>
                <span className="dot"></span> OPERATIONAL
              </div>

              <div>
                <p>LATENCY</p>
                14ms
              </div>

              <button>View Server Map</button>
            </div>
          </div>

          {/* SUBSCRIPTION */}
          <div className="ai-adminDashboard-card subscription">
            <div className="sub-header">
              <h3>Active Subscriptions</h3>
              <span className="icon">✦</span>
            </div>

            <div className="row">
              <p>Enterprise Tier</p>
              <span>142</span>
            </div>
            <div className="progress">
              <div className="progress-bar blue"></div>
            </div>

            <div className="row">
              <p>Growth Tier</p>
              <span>894</span>
            </div>
            <div className="progress">
              <div className="progress-bar purple"></div>
            </div>

            <p className="growth">↗ +12% from last month</p>
          </div>
        </div>

        {/* STATS */}
        <div className="ai-adminDashboard-stats">

          {/* CARD 1 */}
          <div className="stat-card">
            <div className="stat-top">
              <div className="icon-box cyan">
                <Image src="https://res.cloudinary.com/dd9tagtiw/image/upload/v1777536140/Icon_enlpdi.png" alt="icon"
                  className="cyan-icon"
                  width={15}
                  height={15} />
              </div>
              <span className="badge green">+8.4%</span>
            </div>
            <p>Total Clients</p>
            <h2>12,482</h2>
          </div>

          {/* CARD 2 */}
          <div className="stat-card">
            <div className="stat-top">
              <div className="icon-box purple">
                <img src="https://res.cloudinary.com/dd9tagtiw/image/upload/v1777536140/Icon_1_zz1z1h.png" alt="icon" />
              </div>
              <span className="badge dark">MRR</span>
            </div>
            <p>Monthly Revenue</p>
            <h2>$1.24M</h2>
          </div>

          {/* CARD 3 */}
          <div className="stat-card">
            <div className="stat-top">
              <div className="icon-box yellow">
                <img src="https://res.cloudinary.com/dd9tagtiw/image/upload/v1777536140/Icon_2_gznpcp.png" alt="icon" />
              </div>
              <span className="badge yellow">HOT</span>
            </div>
            <p>Total AI Calls</p>
            <h2>842.1k</h2>
          </div>

          {/* CARD 4 */}
          <div className="stat-card">
            <div className="stat-top">
              <div className="icon-box cyan">
                <img src="https://res.cloudinary.com/dd9tagtiw/image/upload/v1777536140/Icon_3_xsbung.png" alt="icon" />
              </div>
              <span className="badge live">● LIVE</span>
            </div>
            <p>Health Index</p>
            <h2 className="highlight">OPTIMAL</h2>
          </div>

          {/* BOTTOM SECTION */}

        </div>
        <div className="ai-adminDashboard-bottom">

          {/* REVENUE CHART */}
          <div className="revenue-card">
            <div className="rev-header">
              <div>
                <h3>Revenue Growth</h3>
                <p>Annualized performance overview</p>
              </div>

              <div className="toggle">
                <span className="active">Monthly</span>
                <span>Yearly</span>
              </div>
            </div>

            {/* BAR CHART */}
            <div className="chart">
              {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT"].map((m, i) => (
                <div key={i} className="bar-wrap">
                  <div
                    className={`bar ${i === 5 ? "purple" : ""}`}
                    style={{ height: `${240 + i * 5}px` }}
                  ></div>
                  <span>{m}</span>
                </div>
              ))}
            </div>
          </div>

          {/* REAL TIME */}
          <div className="realtime-card">
            <h3>Real-time Intelligence</h3>

            <div className="activity">

              {/* ITEM 1 */}
              <div className="activity-item cyan">
                <div className="left-line"></div>

                <img src="https://res.cloudinary.com/dd9tagtiw/image/upload/v1777545630/299805d1b59fa2d6cb3aad8562b7b5f12b4bc926_ka3bjy.jpg" />

                <div className="content">
                  <h4>Elite Realty Gr...</h4>
                  <p>Active Call: Lead Qualification</p>
                </div>

                <span className="status-dot"></span>
              </div>

              {/* ITEM 2 */}
              <div className="activity-item purple">
                <div className="left-line"></div>

                <img src="https://res.cloudinary.com/dd9tagtiw/image/upload/v1777545630/299805d1b59fa2d6cb3aad8562b7b5f12b4bc926_ka3bjy.jpg" />

                <div className="content">
                  <h4>Coastal Living ...</h4>
                  <p>Call Complete: Data Synced</p>
                </div>

                <span className="status-check">✓</span>
              </div>

              {/* ITEM 3 */}
              <div className="activity-item">
                <img src="https://res.cloudinary.com/dd9tagtiw/image/upload/v1777545630/299805d1b59fa2d6cb3aad8562b7b5f12b4bc926_ka3bjy.jpg" />

                <div className="content">
                  <h4>Modern Lofts L...</h4>
                  <p>Scheduled: 2:00 PM</p>
                </div>

                <span className="status-time">⏱</span>
              </div>

            </div>

            <button className="view-btn">
              View All Activity <span>→</span>
            </button>
          </div>

          {/* NODE MONITORING */}

        </div>
        <div className="node-card">

          <div className="node-header">
            <h3>Node Monitoring</h3>
            <span className="node-status">● ALL SYSTEMS NORMAL</span>
          </div>

          <div className="node-list">

            <div className="node-item">
              <p>US-EAST-1</p>
              <h4>9ms</h4>
            </div>

            <div className="node-item">
              <p>US-WEST-2</p>
              <h4>14ms</h4>
            </div>

            <div className="node-item">
              <p>EU-CENTRAL-1</p>
              <h4>32ms</h4>
            </div>

            <div className="node-item">
              <p>AP-SOUTHEAST-1</p>
              <h4>84ms</h4>
            </div>

            <div className="node-item">
              <p>SA-EAST-1</p>
              <h4>52ms</h4>
            </div>

            <div className="node-item">
              <p>ME-SOUTH-1</p>
              <h4>41ms</h4>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}