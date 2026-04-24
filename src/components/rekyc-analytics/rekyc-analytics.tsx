import { Component, h, State } from '@stencil/core';

// ── Interfaces ──
interface CaseRecord { id: string; customer: string; status: string; tat: number; risk: string; }
interface AgentData { name: string; total: number; completed: number; pending: number; rejected: number; avgTat: number; cases: CaseRecord[]; }
interface RMData { total: number; completed: number; pending: number; rejected: number; avgTat: number; agents: AgentData[]; }
interface ZoneData { total: number; completed: number; pending: number; rejected: number; rms: Record<string, RMData>; }

// ── Consistent data model ──
const ZONES: Record<string, ZoneData> = {
  West: {
    total: 196, completed: 97, pending: 84, rejected: 15,
    rms: {
      'Kiran Desai': {
        total: 112, completed: 58, pending: 44, rejected: 10, avgTat: 3.6,
        agents: [
          { name: 'Priya Nair',   total: 58, completed: 38, pending: 16, rejected: 4, avgTat: 3.2,
            cases: [
              { id:'KYC-7891', customer:'Priya Mehta',   status:'Completed', tat: 2.1, risk:'Low' },
              { id:'KYC-2290', customer:'Meera Joshi',   status:'Completed', tat: 3.8, risk:'Low' },
              { id:'KYC-4528', customer:'Rajesh Sharma', status:'Pending VKYC', tat: 6.0, risk:'Medium' },
              { id:'KYC-8834', customer:'Arjun Nair',    status:'Link Generated', tat: 1.2, risk:'Low' },
            ]
          },
          { name: 'Mohit Sharma', total: 54, completed: 20, pending: 28, rejected: 6, avgTat: 4.1,
            cases: [
              { id:'KYC-9901', customer:'Sanjay Kapoor',  status:'Rejected',  tat: 8.2, risk:'High' },
              { id:'KYC-6678', customer:'Vikram Singh',   status:'Initiated',  tat: 4.5, risk:'Medium' },
              { id:'KYC-5512', customer:'Sneha Reddy',    status:'Pending Doc Upload', tat: 5.1, risk:'Low' },
            ]
          },
        ]
      },
      'Anjali Rao': {
        total: 84, completed: 39, pending: 40, rejected: 5, avgTat: 4.1,
        agents: [
          { name: 'Suresh Iyer',  total: 44, completed: 26, pending: 16, rejected: 2, avgTat: 3.8,
            cases: [
              { id:'KYC-3345', customer:'Amit Patel',    status:'Completed', tat: 3.2, risk:'Low' },
              { id:'KYC-4421', customer:'Lakshmi V.',    status:'Completed', tat: 2.8, risk:'Low' },
            ]
          },
          { name: 'Kavita Joshi', total: 40, completed: 13, pending: 24, rejected: 3, avgTat: 4.5,
            cases: [
              { id:'KYC-1190', customer:'Divya Krishnan', status:'Pending Verification', tat: 9.1, risk:'Medium' },
            ]
          },
        ]
      },
    }
  },
  North: {
    total: 312, completed: 140, pending: 148, rejected: 24,
    rms: {
      'Rohit Mehra': {
        total: 168, completed: 74, pending: 82, rejected: 12, avgTat: 4.3,
        agents: [
          { name: 'Arun Kumar', total: 86, completed: 42, pending: 38, rejected: 6, avgTat: 3.5,
            cases: [{ id:'KYC-A101', customer:'Pankaj Sood', status:'Completed', tat: 3.1, risk:'Low' }] },
          { name: 'Neha Singh', total: 82, completed: 32, pending: 44, rejected: 6, avgTat: 5.2,
            cases: [{ id:'KYC-A102', customer:'Geeta Sharma', status:'In Progress', tat: 5.8, risk:'Medium' }] },
        ]
      },
      'Sunita Bose': {
        total: 144, completed: 66, pending: 66, rejected: 12, avgTat: 3.3,
        agents: [
          { name: 'Rahul Das',   total: 78, completed: 40, pending: 32, rejected: 6, avgTat: 2.8,
            cases: [{ id:'KYC-A103', customer:'Ramesh Gupta', status:'Completed', tat: 2.4, risk:'Low' }] },
          { name: 'Pooja Verma', total: 66, completed: 26, pending: 34, rejected: 6, avgTat: 3.9,
            cases: [{ id:'KYC-A104', customer:'Sunita Rani', status:'Pending VKYC', tat: 4.2, risk:'Medium' }] },
        ]
      },
    }
  },
  South: {
    total: 284, completed: 136, pending: 128, rejected: 20,
    rms: {
      'Venkat Rao': {
        total: 158, completed: 76, pending: 72, rejected: 10, avgTat: 3.2,
        agents: [
          { name: 'Anand Raj',    total: 82, completed: 46, pending: 32, rejected: 4, avgTat: 2.4,
            cases: [{ id:'KYC-S101', customer:'Ravi Kumar', status:'Completed', tat: 2.1, risk:'Low' }] },
          { name: 'Meena Pillai', total: 76, completed: 30, pending: 40, rejected: 6, avgTat: 4.2,
            cases: [{ id:'KYC-S102', customer:'Nair Raj', status:'In Progress', tat: 4.8, risk:'High' }] },
        ]
      },
      'Divya Menon': {
        total: 126, completed: 60, pending: 56, rejected: 10, avgTat: 4.4,
        agents: [
          { name: 'Srinivas R.',  total: 66, completed: 34, pending: 26, rejected: 6, avgTat: 3.1,
            cases: [{ id:'KYC-S103', customer:'Suresh Menon', status:'Completed', tat: 3.0, risk:'Low' }] },
          { name: 'Lakshmi T.',   total: 60, completed: 26, pending: 30, rejected: 4, avgTat: 5.8,
            cases: [{ id:'KYC-S104', customer:'Vimala R.', status:'Pending Doc Upload', tat: 7.2, risk:'High' }] },
        ]
      },
    }
  },
  East: {
    total: 198, completed: 83, pending: 102, rejected: 13,
    rms: {
      'Aditya Sen': {
        total: 108, completed: 46, pending: 54, rejected: 8, avgTat: 4.7,
        agents: [
          { name: 'Ravi Gupta',  total: 56, completed: 26, pending: 26, rejected: 4, avgTat: 4.4,
            cases: [{ id:'KYC-E101', customer:'Bikash Das', status:'In Progress', tat: 5.1, risk:'Medium' }] },
          { name: 'Sunita Saha', total: 52, completed: 20, pending: 28, rejected: 4, avgTat: 5.1,
            cases: [{ id:'KYC-E102', customer:'Anita Roy', status:'Pending VKYC', tat: 6.2, risk:'High' }] },
        ]
      },
      'Priya Ghosh': {
        total: 90, completed: 37, pending: 48, rejected: 5, avgTat: 4.9,
        agents: [
          { name: 'Tarun Roy',   total: 48, completed: 22, pending: 22, rejected: 4, avgTat: 3.7,
            cases: [{ id:'KYC-E103', customer:'Subrata Sen', status:'Completed', tat: 3.5, risk:'Low' }] },
          { name: 'Nisha Bera',  total: 42, completed: 15, pending: 26, rejected: 1, avgTat: 6.2,
            cases: [{ id:'KYC-E104', customer:'Mita Ghosh', status:'Initiated', tat: 5.8, risk:'Medium' }] },
        ]
      },
    }
  },
  Central: {
    total: 96, completed: 10, pending: 78, rejected: 8,
    rms: {
      'Mahesh Gupta': {
        total: 96, completed: 10, pending: 78, rejected: 8, avgTat: 7.6,
        agents: [
          { name: 'Raju Sharma',  total: 50, completed: 6,  pending: 40, rejected: 4, avgTat: 7.2,
            cases: [{ id:'KYC-C101', customer:'Ramkumar S.', status:'Initiated', tat: 8.1, risk:'High' }] },
          { name: 'Kamala Devi',  total: 46, completed: 4,  pending: 38, rejected: 4, avgTat: 8.1,
            cases: [{ id:'KYC-C102', customer:'Savita R.', status:'Link Generated', tat: 6.4, risk:'Medium' }] },
        ]
      },
    }
  },
};

// Totals: 196+312+284+198+96 = 1086 ✓
// Completed: 97+140+136+83+10 = 466 ✓

type ViewLevel = 'zone' | 'rm' | 'agent';

@Component({ tag: 'rekyc-analytics', styleUrl: 'rekyc-analytics.css', shadow: false })
export class RekycAnalytics {
  @State() period = '30d';
  @State() viewLevel: ViewLevel = 'zone';
  @State() selectedZone: string | null = null;
  @State() selectedRM: string | null = null;
  @State() selectedAgent: string | null = null;
  private canvasTrend: HTMLCanvasElement;
  private canvasDoughnut: HTMLCanvasElement;
  private chartsLoaded = false;

  componentDidLoad() { this.initCharts(); }
  componentDidUpdate() { setTimeout(() => this.drawCharts(), 100); }

  async initCharts() {
    if ((window as any).Chart) { this.chartsLoaded = true; this.drawCharts(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload = () => { this.chartsLoaded = true; setTimeout(() => this.drawCharts(), 100); };
    document.head.appendChild(s);
  }

  drawCharts() {
    const Chart = (window as any).Chart;
    if (!Chart) return;
    // Destroy all
    Object.values((Chart as any).instances || {}).forEach((c: any) => { try { c.destroy(); } catch(e) {} });

    // Trend
    if (this.canvasTrend) {
      new Chart(this.canvasTrend, {
        type: 'line',
        data: {
          labels: ['Wk1','Wk2','Wk3','Wk4','Wk5','Wk6','Wk7','Wk8'],
          datasets: [
            { label: 'Completed', data: [38, 52, 60, 72, 89, 104, 124, 152], borderColor: '#0B7A5B', backgroundColor: 'rgba(11,122,91,.08)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#0B7A5B' },
            { label: 'Initiated', data: [88, 102, 118, 132, 148, 162, 175, 185], borderColor: '#074994', backgroundColor: 'rgba(7,73,148,.04)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#074994' },
            { label: 'Rejected', data: [6, 9, 8, 12, 11, 14, 12, 10], borderColor: '#900909', backgroundColor: 'transparent', tension: 0.4, fill: false, pointRadius: 3, pointBackgroundColor: '#900909', borderDash: [4,3] },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 11, family: 'DM Sans' } } }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 11 } } } } }
      });
    }

    // Doughnut
    if (this.canvasDoughnut) {
      new Chart(this.canvasDoughnut, {
        type: 'doughnut',
        data: {
          labels: ['High Risk', 'Medium Risk', 'Low Risk'],
          datasets: [{ data: [92, 312, 682], backgroundColor: ['#900909','#FFAA00','#0B7A5B'], borderWidth: 0, hoverOffset: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } }
      });
    }
  }

  // ── Computed data based on drill-down level ──
  get currentZoneData() {
    if (!this.selectedZone) return null;
    return ZONES[this.selectedZone];
  }

  get currentRMData() {
    if (!this.selectedZone || !this.selectedRM) return null;
    return ZONES[this.selectedZone].rms[this.selectedRM];
  }

  get currentAgentData() {
    if (!this.selectedZone || !this.selectedRM || !this.selectedAgent) return null;
    const rm = ZONES[this.selectedZone].rms[this.selectedRM];
    return rm.agents.find(a => a.name === this.selectedAgent) || null;
  }

  get totals() {
    const all = Object.values(ZONES);
    return {
      total: all.reduce((s, z) => s + z.total, 0),
      completed: all.reduce((s, z) => s + z.completed, 0),
      pending: all.reduce((s, z) => s + z.pending, 0),
      rejected: all.reduce((s, z) => s + z.rejected, 0),
    };
  }

  // ── Breadcrumb navigation ──
  renderBreadcrumb() {
    return (
      <div class="breadcrumb">
        <span class={!this.selectedZone ? 'bc-item bc-active' : 'bc-item bc-link'} onClick={() => { this.selectedZone = null; this.selectedRM = null; this.selectedAgent = null; this.viewLevel = 'zone'; }}>All Zones</span>
        {this.selectedZone && [
          <span class="bc-sep">›</span>,
          <span class={!this.selectedRM ? 'bc-item bc-active' : 'bc-item bc-link'} onClick={() => { this.selectedRM = null; this.selectedAgent = null; this.viewLevel = 'rm'; }}>{this.selectedZone} Zone</span>
        ]}
        {this.selectedRM && [
          <span class="bc-sep">›</span>,
          <span class={!this.selectedAgent ? 'bc-item bc-active' : 'bc-item bc-link'} onClick={() => { this.selectedAgent = null; this.viewLevel = 'agent'; }}>{this.selectedRM}</span>
        ]}
        {this.selectedAgent && [
          <span class="bc-sep">›</span>,
          <span class="bc-item bc-active">{this.selectedAgent}</span>
        ]}
      </div>
    );
  }

  renderStatBox(label: string, value: number | string, color: string, bg: string, pct?: string) {
    return (
      <div class="stat-box" style={{ borderLeft: `4px solid ${color}` }}>
        <div class="sb-label">{label}</div>
        <div class="sb-value" style={{ color }}>{value}</div>
        {pct && <div class="sb-pct">{pct}</div>}
      </div>
    );
  }

  // ── Zone level table ──
  renderZoneTable() {
    const t = this.totals;
    return (
      <div class="hier-table-wrap">
        <div class="hier-table-title">Zone-wise Performance <span class="level-badge">Zonal View</span></div>
        <table class="hier-table">
          <thead>
            <tr><th>Zone</th><th>Total Cases</th><th>Completed</th><th>Pending</th><th>Rejected</th><th>Completion %</th><th>Action</th></tr>
          </thead>
          <tbody>
            {Object.entries(ZONES).map(([zone, data]) => {
              const pct = Math.round(data.completed / data.total * 100);
              return (
                <tr>
                  <td class="h-name">{zone}</td>
                  <td class="h-num">{data.total}</td>
                  <td class="h-num green">{data.completed}</td>
                  <td class="h-num amber">{data.pending}</td>
                  <td class="h-num red">{data.rejected}</td>
                  <td>
                    <div class="pct-bar-row">
                      <div class="pct-bar-bg"><div class="pct-bar-fill" style={{ width: pct + '%', background: pct >= 60 ? '#0B7A5B' : pct >= 40 ? '#FFAA00' : '#900909' }} /></div>
                      <span class="pct-val">{pct}%</span>
                    </div>
                  </td>
                  <td><button class="btn-drill" onClick={() => { this.selectedZone = zone; this.selectedRM = null; this.selectedAgent = null; this.viewLevel = 'rm'; }}>View RMs ›</button></td>
                </tr>
              );
            })}
            <tr class="total-row">
              <td class="h-name">TOTAL</td>
              <td class="h-num">{t.total}</td>
              <td class="h-num green">{t.completed}</td>
              <td class="h-num amber">{t.pending}</td>
              <td class="h-num red">{t.rejected}</td>
              <td><span class="pct-val">{Math.round(t.completed / t.total * 100)}%</span></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // ── RM level table ──
  renderRMTable() {
    const zData = this.currentZoneData;
    if (!zData) return null;
    return (
      <div class="hier-table-wrap">
        <div class="hier-table-title">Regional Manager Performance — {this.selectedZone} Zone <span class="level-badge">RM View</span></div>
        <table class="hier-table">
          <thead>
            <tr><th>Regional Manager</th><th>Total Cases</th><th>Completed</th><th>Pending</th><th>Rejected</th><th>Avg TAT (days)</th><th>Completion %</th><th>Action</th></tr>
          </thead>
          <tbody>
            {Object.entries(zData.rms).map(([rmName, rm]) => {
              const pct = Math.round(rm.completed / rm.total * 100);
              const tatColor = rm.avgTat <= 3.5 ? '#0B7A5B' : rm.avgTat <= 5 ? '#FFAA00' : '#900909';
              return (
                <tr>
                  <td class="h-name">{rmName}</td>
                  <td class="h-num">{rm.total}</td>
                  <td class="h-num green">{rm.completed}</td>
                  <td class="h-num amber">{rm.pending}</td>
                  <td class="h-num red">{rm.rejected}</td>
                  <td><span class="tat-badge" style={{ color: tatColor, background: tatColor + '18' }}>{rm.avgTat}d</span></td>
                  <td>
                    <div class="pct-bar-row">
                      <div class="pct-bar-bg"><div class="pct-bar-fill" style={{ width: pct + '%', background: pct >= 60 ? '#0B7A5B' : pct >= 40 ? '#FFAA00' : '#900909' }} /></div>
                      <span class="pct-val">{pct}%</span>
                    </div>
                  </td>
                  <td><button class="btn-drill" onClick={() => { this.selectedRM = rmName; this.selectedAgent = null; this.viewLevel = 'agent'; }}>View Agents ›</button></td>
                </tr>
              );
            })}
            <tr class="total-row">
              <td class="h-name">ZONE TOTAL</td>
              <td class="h-num">{zData.total}</td>
              <td class="h-num green">{zData.completed}</td>
              <td class="h-num amber">{zData.pending}</td>
              <td class="h-num red">{zData.rejected}</td>
              <td>—</td>
              <td><span class="pct-val">{Math.round(zData.completed / zData.total * 100)}%</span></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // ── Agent level table ──
  renderAgentTable() {
    const rmData = this.currentRMData;
    if (!rmData) return null;
    return (
      <div class="hier-table-wrap">
        <div class="hier-table-title">Agent Performance — {this.selectedRM} <span class="level-badge">Agent View</span></div>
        <table class="hier-table">
          <thead>
            <tr><th>Agent</th><th>Total Cases</th><th>Completed</th><th>Pending</th><th>Rejected</th><th>Avg TAT (days)</th><th>Completion %</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rmData.agents.map(agent => {
              const pct = Math.round(agent.completed / agent.total * 100);
              const tatColor = agent.avgTat <= 3.5 ? '#0B7A5B' : agent.avgTat <= 5 ? '#FFAA00' : '#900909';
              return (
                <tr>
                  <td class="h-name">{agent.name}</td>
                  <td class="h-num">{agent.total}</td>
                  <td class="h-num green">{agent.completed}</td>
                  <td class="h-num amber">{agent.pending}</td>
                  <td class="h-num red">{agent.rejected}</td>
                  <td><span class="tat-badge" style={{ color: tatColor, background: tatColor + '18' }}>{agent.avgTat}d</span></td>
                  <td>
                    <div class="pct-bar-row">
                      <div class="pct-bar-bg"><div class="pct-bar-fill" style={{ width: pct + '%', background: pct >= 60 ? '#0B7A5B' : pct >= 40 ? '#FFAA00' : '#900909' }} /></div>
                      <span class="pct-val">{pct}%</span>
                    </div>
                  </td>
                  <td><button class="btn-drill" onClick={() => { this.selectedAgent = agent.name; this.viewLevel = 'agent'; }}>View Cases ›</button></td>
                </tr>
              );
            })}
            <tr class="total-row">
              <td class="h-name">RM TOTAL</td>
              <td class="h-num">{rmData.total}</td>
              <td class="h-num green">{rmData.completed}</td>
              <td class="h-num amber">{rmData.pending}</td>
              <td class="h-num red">{rmData.rejected}</td>
              <td><span class="tat-badge" style={{ color: '#074994', background: '#E8F0F8' }}>{rmData.avgTat}d</span></td>
              <td><span class="pct-val">{Math.round(rmData.completed / rmData.total * 100)}%</span></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // ── Case TAT detail view ──
  renderCaseDetail() {
    const agentData = this.currentAgentData;
    if (!agentData) return null;
    const tatColor = (tat: number) => tat <= 3 ? '#0B7A5B' : tat <= 6 ? '#FFAA00' : '#900909';
    const riskColor = (r: string) => r === 'High' ? '#900909' : r === 'Medium' ? '#B8860B' : '#0B7A5B';
    const riskBg = (r: string) => r === 'High' ? '#FDE8E8' : r === 'Medium' ? '#FFF8E6' : '#E6F5F0';
    return (
      <div class="hier-table-wrap">
        <div class="hier-table-title">Case-wise TAT — {this.selectedAgent} <span class="level-badge">Case View</span></div>
        <div class="agent-summary-bar">
          <span>Total: <strong>{agentData.total}</strong></span>
          <span class="green">Completed: <strong>{agentData.completed}</strong></span>
          <span class="amber">Pending: <strong>{agentData.pending}</strong></span>
          <span class="red">Rejected: <strong>{agentData.rejected}</strong></span>
          <span>Avg TAT: <strong class="tat-inline">{agentData.avgTat} days</strong></span>
        </div>
        <table class="hier-table">
          <thead>
            <tr><th>Case ID</th><th>Customer</th><th>Status</th><th>Risk</th><th>TAT (days)</th><th>TAT Status</th></tr>
          </thead>
          <tbody>
            {agentData.cases.map(c => (
              <tr>
                <td class="h-sub">{c.id}</td>
                <td class="h-name">{c.customer}</td>
                <td><span class={`status-pill ${c.status === 'Completed' ? 'sp-green' : c.status === 'Rejected' ? 'sp-red' : 'sp-amber'}`}>{c.status}</span></td>
                <td><span class="risk-pill" style={{ color: riskColor(c.risk), background: riskBg(c.risk) }}>{c.risk}</span></td>
                <td class="h-num">{c.tat}d</td>
                <td><span class="tat-badge" style={{ color: tatColor(c.tat), background: tatColor(c.tat) + '18' }}>{c.tat <= 3 ? 'On Track' : c.tat <= 6 ? 'Delayed' : 'Breached'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div class="tat-legend">
          <span class="tl-item" style={{ color: '#0B7A5B' }}>0–3d: On Track</span>
          <span class="tl-item" style={{ color: '#B8860B' }}>3–6d: Delayed</span>
          <span class="tl-item" style={{ color: '#900909' }}>6d+: Breached</span>
          <span class="tl-sep">|</span>
          <span>SLA Target: 5 business days</span>
        </div>
      </div>
    );
  }

  renderPipelineRow(status: string, count: number, total: number, color: string) {
    const pct = Math.round(count / total * 100);
    return (
      <div class="pipe-row">
        <div class="pipe-label">{status}</div>
        <div class="pipe-bar-wrap"><div class="pipe-bar-fill" style={{ width: pct + '%', background: color }} /></div>
        <div class="pipe-count">{count}</div>
      </div>
    );
  }

  render() {
    const t = this.totals;
    const statsForLevel = this.selectedAgent ? this.currentAgentData :
                          this.selectedRM ? this.currentRMData :
                          this.selectedZone ? this.currentZoneData : t;
    const st = statsForLevel as any;

    return (
      <div class="analytics-wrap">
        {/* Header */}
        <div class="ana-header">
          <div>
            <div class="ana-greeting">Re-KYC Analytics Dashboard</div>
            <div class="ana-sub">National Bank Ltd. • As of 24 Apr 2026</div>
          </div>
          <div class="ana-controls">
            <div class="period-tabs">
              {['7d','30d','90d','YTD'].map(p =>
                <button class={this.period === p ? 'ptab active' : 'ptab'} onClick={() => { this.period = p; }}>{p}</button>
              )}
            </div>
            <button class="btn-export">Export</button>
          </div>
        </div>

        <div class="ana-body">
          {/* Top stat boxes — always show org-level */}
          <div class="stat-boxes-row">
            {this.renderStatBox('Total KYC Due', t.total, '#074994', '#E8F0F8', '100%')}
            {this.renderStatBox('Completed', t.completed, '#0B7A5B', '#E6F5F0', Math.round(t.completed/t.total*100) + '%')}
            {this.renderStatBox('Pending', t.pending, '#B8860B', '#FFF8E6', Math.round(t.pending/t.total*100) + '%')}
            {this.renderStatBox('Rejected', t.rejected, '#900909', '#FDE8E8', Math.round(t.rejected/t.total*100) + '%')}
            {this.renderStatBox('High Risk', 92, '#6D28D9', '#F3E8FF', '8.5%')}
            {this.renderStatBox('Avg TAT', '4.2d', '#0D1F35', '#F0F4F8', 'SLA: 5d')}
          </div>

          {/* Breadcrumb + hierarchy filters */}
          <div class="nav-row">
            {this.renderBreadcrumb()}
            {!this.selectedZone && (
              <div class="filter-hint">Click "View RMs" to drill into a zone</div>
            )}
          </div>

          {/* Charts + hierarchy table side by side */}
          <div class="charts-hier-row">
            {/* Left: charts */}
            <div class="charts-col">
              <div class="chart-card">
                <div class="chart-title">Completion Rate Trend</div>
                <div class="chart-sub">KYC completions across last 8 weeks</div>
                <div style={{ height: '170px', position: 'relative' }}>
                  <canvas ref={el => this.canvasTrend = el as HTMLCanvasElement} />
                </div>
              </div>
              <div class="chart-card">
                <div class="chart-title">Risk Category Mix</div>
                <div class="chart-sub">Total: {t.total} cases</div>
                <div class="donut-row">
                  <div style={{ height: '120px', width: '120px', position: 'relative', flex: '0 0 120px' }}>
                    <canvas ref={el => this.canvasDoughnut = el as HTMLCanvasElement} />
                  </div>
                  <div class="donut-legend-col">
                    <div class="dl-item"><span class="dl-dot" style={{ background: '#900909' }} /><span>High Risk</span><strong>92</strong></div>
                    <div class="dl-item"><span class="dl-dot" style={{ background: '#FFAA00' }} /><span>Medium Risk</span><strong>312</strong></div>
                    <div class="dl-item"><span class="dl-dot" style={{ background: '#0B7A5B' }} /><span>Low Risk</span><strong>682</strong></div>
                  </div>
                </div>
              </div>
              <div class="chart-card">
                <div class="chart-title">KYC Pipeline</div>
                <div class="chart-sub">Distribution across stages (total: {t.total})</div>
                <div class="pipeline">
                  {this.renderPipelineRow('Completed', t.completed, t.total, '#0B7A5B')}
                  {this.renderPipelineRow('Pending VKYC', 118, t.total, '#B8860B')}
                  {this.renderPipelineRow('Pending Doc Upload', 124, t.total, '#FFAA00')}
                  {this.renderPipelineRow('Pending Verification', 86, t.total, '#6D28D9')}
                  {this.renderPipelineRow('In Progress', 96, t.total, '#3067A6')}
                  {this.renderPipelineRow('Initiated', 105, t.total, '#ACC2DB')}
                  {this.renderPipelineRow('Rejected', t.rejected, t.total, '#900909')}
                </div>
              </div>
            </div>

            {/* Right: hierarchical table */}
            <div class="hier-col">
              {!this.selectedZone && this.renderZoneTable()}
              {this.selectedZone && !this.selectedRM && this.renderRMTable()}
              {this.selectedRM && !this.selectedAgent && this.renderAgentTable()}
              {this.selectedAgent && this.renderCaseDetail()}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
