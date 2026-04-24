import { Component, h, State } from '@stencil/core';

@Component({ tag: 'rekyc-analytics', styleUrl: 'rekyc-analytics.css', shadow: false })
export class RekycAnalytics {
  @State() period = '7d';
  @State() chartReady = false;
  private canvasTrend: HTMLCanvasElement;
  private canvasDoughnut: HTMLCanvasElement;
  private canvasBar: HTMLCanvasElement;
  private chartsLoaded = false;

  componentDidLoad() { this.loadCharts(); }
  componentDidUpdate() { if (!this.chartsLoaded) this.loadCharts(); }

  async loadCharts() {
    if (typeof window === 'undefined') return;
    if (!(window as any).Chart) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      s.onload = () => { this.chartsLoaded = true; this.chartReady = true; setTimeout(() => this.drawCharts(), 100); };
      document.head.appendChild(s);
    } else { this.chartsLoaded = true; this.chartReady = true; setTimeout(() => this.drawCharts(), 100); }
  }

  drawCharts() {
    const Chart = (window as any).Chart;
    if (!Chart) return;

    // Destroy existing charts
    Chart.helpers && Object.values((Chart as any).instances || {}).forEach((c: any) => { try { c.destroy(); } catch(e) {} });

    // Trend Line Chart
    if (this.canvasTrend) {
      new Chart(this.canvasTrend, {
        type: 'line',
        data: {
          labels: ['Week 1','Week 2','Week 3','Week 4','Week 5','Week 6','Week 7'],
          datasets: [
            { label: 'Completed', data: [45, 62, 58, 74, 89, 102, 118], borderColor: '#0B7A5B', backgroundColor: 'rgba(11,122,91,.08)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#0B7A5B' },
            { label: 'Initiated', data: [120, 134, 142, 156, 168, 172, 185], borderColor: '#074994', backgroundColor: 'rgba(7,73,148,.05)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#074994' },
            { label: 'Rejected', data: [8, 12, 9, 15, 11, 14, 10], borderColor: '#900909', backgroundColor: 'rgba(144,9,9,.05)', tension: 0.4, fill: false, pointRadius: 4, pointBackgroundColor: '#900909', borderDash: [4,3] },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 11, family: 'DM Sans' } } }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 11, family: 'DM Sans' } } }, y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 11, family: 'DM Sans' } } } } }
      });
    }

    // Doughnut - Risk Category
    if (this.canvasDoughnut) {
      new Chart(this.canvasDoughnut, {
        type: 'doughnut',
        data: {
          labels: ['High Risk', 'Medium Risk', 'Low Risk'],
          datasets: [{ data: [50, 188, 228], backgroundColor: ['#900909', '#FFAA00', '#0B7A5B'], borderWidth: 0, hoverOffset: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => ` ${c.label}: ${c.raw}` } } } }
      });
    }

    // Bar - Exceptions by zone
    if (this.canvasBar) {
      new Chart(this.canvasBar, {
        type: 'bar',
        data: {
          labels: ['North', 'South', 'East', 'West', 'Central'],
          datasets: [
            { label: 'Early Reminder', data: [14, 22, 18, 26, 12], backgroundColor: '#ACC2DB', borderRadius: 4 },
            { label: 'Doc Incomplete', data: [8, 14, 11, 16, 9], backgroundColor: '#074994', borderRadius: 4 },
            { label: 'VKYC Missed', data: [5, 9, 7, 11, 6], backgroundColor: '#FFAA00', borderRadius: 4 },
            { label: 'Rejected', data: [2, 4, 3, 5, 2], backgroundColor: '#900909', borderRadius: 4 },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11, family: 'DM Sans' } } } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } }, y: { stacked: true, beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 11 } } } } }
      });
    }
  }

  renderMetricCard(icon: string, label: string, value: string | number, sub: string, color: string, bg: string, trend?: string, up?: boolean) {
    return (
      <div class="metric-card">
        <div class="metric-top">
          <div class="metric-icon" style={{ background: bg, color }}>{icon}</div>
          <div class="metric-body">
            <div class="metric-label">{label}</div>
            <div class="metric-value" style={{ color }}>{value}</div>
            <div class="metric-sub">{sub}</div>
          </div>
          {trend && <div class={up ? 'metric-trend up' : 'metric-trend down'}>{up ? '▲' : '▼'} {trend}</div>}
        </div>
      </div>
    );
  }

  renderExceptionItem(label: string, count: number, color: string) {
    return (
      <div class="exc-item">
        <div class="exc-dot" style={{ background: color }} />
        <span class="exc-label">{label}</span>
        <span class="exc-count" style={{ color }}>{count}</span>
      </div>
    );
  }

  renderAgentRow(name: string, completed: number, pending: number, rate: number) {
    return (
      <tr>
        <td class="ag-name">{name}</td>
        <td class="ag-num">{completed}</td>
        <td class="ag-num">{pending}</td>
        <td>
          <div class="ag-bar-wrap">
            <div class="ag-bar-fill" style={{ width: rate + '%', background: rate >= 80 ? '#0B7A5B' : rate >= 60 ? '#FFAA00' : '#900909' }} />
          </div>
          <span class="ag-rate">{rate}%</span>
        </td>
      </tr>
    );
  }

  renderPipelineRow(status: string, count: number, pct: number, color: string) {
    return (
      <div class="pipe-row">
        <div class="pipe-label">{status}</div>
        <div class="pipe-bar-wrap">
          <div class="pipe-bar-fill" style={{ width: pct + '%', background: color }} />
        </div>
        <div class="pipe-count">{count}</div>
      </div>
    );
  }

  render() {
    return (
      <div class="analytics-wrap">
        {/* Header */}
        <div class="ana-header">
          <div>
            <div class="ana-greeting">Good day! Here is your Dashboard.</div>
            <div class="ana-sub">Re-KYC Analytics • National Bank Ltd. • As of 24 Apr 2026</div>
          </div>
          <div class="ana-controls">
            <div class="period-tabs">
              {['7d','30d','90d','YTD'].map(p =>
                <button class={this.period === p ? 'ptab active' : 'ptab'} onClick={() => { this.period = p; }}>{p}</button>
              )}
            </div>
            <button class="btn-export">⬇ Export</button>
          </div>
        </div>

        <div class="ana-body">
          {/* Row 1 — Metric cards */}
          <div class="metrics-row">
            {this.renderMetricCard('📋', 'Total KYC Due', '1,086', 'Customers requiring re-KYC', '#074994', '#E8F0F8', '12%', true)}
            {this.renderMetricCard('✅', 'Completed', '466', 'Avg 43% completion rate', '#0B7A5B', '#E6F5F0', '8%', true)}
            {this.renderMetricCard('⏳', 'Pending', '480', 'Requires customer action', '#B8860B', '#FFF8E6', '3%', false)}
            {this.renderMetricCard('⚠', 'Exceptions (%)', '6.2%', 'Exception rate from total cases', '#6D28D9', '#F3E8FF', '1.1%', false)}
            {this.renderMetricCard('🚫', 'Risk Customers', '50', 'Flagged based on risk category', '#900909', '#FDE8E8', '4%', true)}
          </div>

          {/* Row 2 — Charts */}
          <div class="charts-row">
            {/* Doughnut — Risk by category */}
            <div class="chart-card narrow">
              <div class="chart-title">KYC Status by Risk Category</div>
              <div class="chart-sub">Customers risk mix — live status</div>
              <div class="donut-wrap">
                <canvas ref={el => this.canvasDoughnut = el as HTMLCanvasElement} />
                <div class="donut-center">
                  <div class="donut-total">466</div>
                  <div class="donut-lbl">Total Risk</div>
                </div>
              </div>
              <div class="donut-legend">
                <div class="dl-item"><span class="dl-dot" style={{ background: '#900909' }} />High Risk<strong>50</strong></div>
                <div class="dl-item"><span class="dl-dot" style={{ background: '#FFAA00' }} />Medium Risk<strong>188</strong></div>
                <div class="dl-item"><span class="dl-dot" style={{ background: '#0B7A5B' }} />Low Risk<strong>228</strong></div>
              </div>
            </div>

            {/* Line — Completion Rate Trend */}
            <div class="chart-card wide">
              <div class="chart-title">Completion Rate Trend</div>
              <div class="chart-sub">KYC completions across last 7 weeks</div>
              <div class="line-chart-wrap">
                <canvas ref={el => this.canvasTrend = el as HTMLCanvasElement} />
              </div>
            </div>

            {/* Exceptions */}
            <div class="chart-card narrow">
              <div class="chart-title">Day-wise Exceptions</div>
              <div class="chart-sub">Exceptions recorded — last 7 days</div>
              <div class="exc-list">
                {this.renderExceptionItem('Early Reminder', 34, '#ACC2DB')}
                {this.renderExceptionItem('Doc Incomplete', 28, '#074994')}
                {this.renderExceptionItem('VKYC Missed', 22, '#FFAA00')}
                {this.renderExceptionItem('Missing Fields', 15, '#6D28D9')}
                {this.renderExceptionItem('Rejected', 8, '#900909')}
              </div>
              <div class="chart-title" style={{ marginTop: '16px' }}>Exception Breakdown</div>
              <div class="bar-chart-wrap" style={{ height: '100px' }}>
                <canvas ref={el => this.canvasBar = el as HTMLCanvasElement} />
              </div>
            </div>
          </div>

          {/* Row 3 — Pipeline + Agent table */}
          <div class="bottom-row">
            {/* Pipeline funnel */}
            <div class="chart-card pipeline-card">
              <div class="chart-title">KYC Pipeline Status</div>
              <div class="chart-sub">Distribution across workflow stages</div>
              <div class="pipeline">
                {this.renderPipelineRow('Link Generated', 185, 100, '#ACC2DB')}
                {this.renderPipelineRow('Initiated', 162, 88, '#3067A6')}
                {this.renderPipelineRow('In Progress', 134, 72, '#074994')}
                {this.renderPipelineRow('Pending Doc Upload', 98, 53, '#FFAA00')}
                {this.renderPipelineRow('Pending VKYC', 72, 39, '#B8860B')}
                {this.renderPipelineRow('Pending Verification', 54, 29, '#6D28D9')}
                {this.renderPipelineRow('Completed', 466, 43, '#0B7A5B')}
                {this.renderPipelineRow('Rejected', 67, 6, '#900909')}
              </div>
            </div>

            {/* Zone summary */}
            <div class="chart-card zone-card">
              <div class="chart-title">Zone-wise Summary</div>
              <div class="chart-sub">KYC performance by geography</div>
              <table class="zone-table">
                <thead><tr><th>Zone</th><th>Total</th><th>Done</th><th>Pending</th><th>Rate</th></tr></thead>
                <tbody>
                  <tr><td>North</td><td>312</td><td>148</td><td>164</td><td><span class="rate-badge rate-mid">47%</span></td></tr>
                  <tr><td>South</td><td>284</td><td>138</td><td>146</td><td><span class="rate-badge rate-high">49%</span></td></tr>
                  <tr><td>East</td><td>198</td><td>82</td><td>116</td><td><span class="rate-badge rate-low">41%</span></td></tr>
                  <tr><td>West</td><td>196</td><td>84</td><td>112</td><td><span class="rate-badge rate-mid">43%</span></td></tr>
                  <tr><td>Central</td><td>96</td><td>14</td><td>82</td><td><span class="rate-badge rate-low">15%</span></td></tr>
                </tbody>
              </table>

              <div class="chart-title" style={{ marginTop: '16px' }}>Agent Performance</div>
              <div class="chart-sub">Top collectors — {this.period}</div>
              <table class="agent-table">
                <thead><tr><th>Agent</th><th>Done</th><th>Pending</th><th>Rate</th></tr></thead>
                <tbody>
                  {this.renderAgentRow('Priya Nair', 42, 8, 84)}
                  {this.renderAgentRow('Anjali Rao', 38, 11, 78)}
                  {this.renderAgentRow('Suresh Iyer', 34, 16, 68)}
                  {this.renderAgentRow('Kiran Desai', 29, 19, 60)}
                  {this.renderAgentRow('Mohit Sharma', 22, 28, 44)}
                </tbody>
              </table>
            </div>

            {/* Recent activity */}
            <div class="chart-card activity-card">
              <div class="chart-title">Recent Activity</div>
              <div class="chart-sub">Last 10 KYC events</div>
              <div class="activity-list">
                {[
                  { name: 'Rajesh K. Sharma', action: 'VKYC Completed', time: '10 min ago', color: '#0B7A5B', icon: '✅' },
                  { name: 'Divya Krishnan', action: 'Document Uploaded', time: '24 min ago', color: '#074994', icon: '📄' },
                  { name: 'Rohit Agarwal', action: 'Link Opened', time: '41 min ago', color: '#3067A6', icon: '🔗' },
                  { name: 'Vikram Singh', action: 'Reminder Sent (WA)', time: '1h ago', color: '#FFAA00', icon: '💬' },
                  { name: 'Sanjay Kapoor', action: 'Document Rejected', time: '2h ago', color: '#900909', icon: '❌' },
                  { name: 'Lakshmi V.', action: 'KYC Completed', time: '3h ago', color: '#0B7A5B', icon: '✅' },
                  { name: 'Sneha Reddy', action: 'PAN Verified', time: '4h ago', color: '#074994', icon: '📋' },
                  { name: 'Arjun Nair', action: 'Link Generated', time: '5h ago', color: '#ACC2DB', icon: '🔐' },
                  { name: 'Meera Joshi', action: 'KYC Completed', time: '6h ago', color: '#0B7A5B', icon: '✅' },
                  { name: 'Priya Mehta', action: 'Aadhaar Verified', time: '7h ago', color: '#6D28D9', icon: '🆔' },
                ].map(a =>
                  <div class="activity-item">
                    <div class="act-icon" style={{ background: a.color + '18', color: a.color }}>{a.icon}</div>
                    <div class="act-body">
                      <div class="act-name">{a.name}</div>
                      <div class="act-action" style={{ color: a.color }}>{a.action}</div>
                    </div>
                    <div class="act-time">{a.time}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
