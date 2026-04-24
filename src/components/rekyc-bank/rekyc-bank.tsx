import { Component, h, State } from '@stencil/core';
import { Customer, UploadedDoc, fetchCustomers, fetchCustomer, reviewDocument, regenLink, fileUrl } from '../../utils/constants';

@Component({ tag: 'rekyc-bank', styleUrl: 'rekyc-bank.css', shadow: false })
export class RekycBank {
  @State() page: 'dashboard' | 'analytics' = 'dashboard';
  @State() customers: Customer[] = [];
  @State() selected: Customer | null = null;
  @State() filter = 'all';
  @State() rejectingDocId: string | null = null;
  @State() rejectReason = '';
  @State() toast: string | null = null;
  @State() loading = true;
  @State() apiError: string | null = null;
  @State() searchQuery = '';
  private pollInterval: any;

  async componentWillLoad() { await this.load(); }
  connectedCallback() { this.pollInterval = setInterval(() => this.load(), 8000); }
  disconnectedCallback() { clearInterval(this.pollInterval); }

  async load() {
    try {
      const result = await fetchCustomers();
      if (!Array.isArray(result)) throw new Error('Invalid API response');
      this.customers = result;
      this.apiError = null;
      if (this.selected) {
        const fresh = await fetchCustomer(this.selected.id);
        this.selected = fresh;
      }
    } catch (err: any) {
      this.apiError = err.message || 'Failed to connect';
      this.customers = [];
    } finally {
      this.loading = false;
    }
  }

  async selectCustomer(id: string) {
    this.selected = await fetchCustomer(id);
    this.rejectingDocId = null;
    this.rejectReason = '';
  }

  async doApprove(docId: string) {
    await reviewDocument(this.selected!.id, docId, 'approve', '', 'Bank Officer');
    this.toast = 'ok:Document approved successfully';
    setTimeout(() => { this.toast = null; }, 3000);
    await this.load();
  }

  async doReject(docId: string) {
    if (!this.rejectReason.trim()) return;
    await reviewDocument(this.selected!.id, docId, 'reject', this.rejectReason, 'Bank Officer');
    this.rejectingDocId = null;
    this.rejectReason = '';
    this.toast = 'err:Document rejected - customer notified';
    setTimeout(() => { this.toast = null; }, 3000);
    await this.load();
  }

  async doRegenLink() {
    await regenLink(this.selected!.id);
    this.toast = 'ok:New link generated and sent to customer';
    setTimeout(() => { this.toast = null; }, 3000);
    await this.load();
  }

  get filtered() {
    let list = Array.isArray(this.customers) ? this.customers : [];
    if (this.filter !== 'all') list = list.filter(c => c.status === this.filter);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.acct.toLowerCase().includes(q) ||
        (c.mobile || '').includes(q)
      );
    }
    return list;
  }

  statusStyle(s: string) {
    if (s === 'Completed') return 'badge-green';
    if (s === 'Rejected') return 'badge-red';
    if (s === 'In Progress') return 'badge-blue';
    if (s === 'Initiated') return 'badge-blue';
    if (s === 'Link Generated') return 'badge-gray';
    if (s === 'Pending VKYC') return 'badge-orange';
    if (s === 'Pending Doc Upload') return 'badge-orange';
    if (s === 'Pending Verification') return 'badge-purple';
    return 'badge-gray';
  }

  docBadge(s: string) {
    if (s === 'approved') return { cls: 'badge-green', label: 'Approved' };
    if (s === 'rejected') return { cls: 'badge-red', label: 'Rejected' };
    return { cls: 'badge-orange', label: 'Pending Review' };
  }

  stepStyle(s: string) {
    if (s === 'Completed' || s === 'Verified') return 'step-done';
    if (s === 'Failed' || s === 'Rejected') return 'step-fail';
    if (s === 'In Progress') return 'step-prog';
    return 'step-pending';
  }

  chIcon(ch: string) {
    return ch;
  }

  // ── Render helpers ──

  renderFilterBtn(val: string, label: string) {
    const cls = this.filter === val ? 'filter-btn active' : 'filter-btn';
    return <button class={cls} onClick={() => { this.filter = val; }}>{label}</button>;
  }

  renderStatCard(label: string, val: number, icon: string, color: string) {
    return (
      <div class="stat-card">
        <div class="stat-icon" style={{ background: color + '18', color }}>{icon}</div>
        <div>
          <div class="stat-val" style={{ color }}>{val}</div>
          <div class="stat-label">{label}</div>
        </div>
      </div>
    );
  }

  renderKycStep(label: string, step: any) {
    if (!step) return null;
    const cls = this.stepStyle(step.status);
    return (
      <div class="kyc-step">
        <div class={`kyc-step-dot ${cls}`} />
        <div class="kyc-step-body">
          <div class="kyc-step-title">{label}</div>
          <div class="kyc-step-meta">
            <span class={`badge-xs ${cls === 'step-done' ? 'badge-green' : cls === 'step-fail' ? 'badge-red' : cls === 'step-prog' ? 'badge-blue' : 'badge-gray'}`}>{step.status}</span>
            {step.date && <span class="kyc-step-date">{step.date}</span>}
          </div>
          {step.type && <div class="kyc-step-extra">Type: {step.type}</div>}
          {step.mode && <div class="kyc-step-extra">Mode: {step.mode}</div>}
        </div>
      </div>
    );
  }

  renderDocCard(doc: UploadedDoc) {
    const ds = this.docBadge(doc.status);
    const isRejecting = this.rejectingDocId === doc.id;
    const docClass = 'doc-card' + (doc.status === 'pending' ? ' doc-pending' : doc.status === 'rejected' ? ' doc-rejected' : '');
    return (
      <div class={docClass}>
        <div class="doc-header">
          <div class="doc-icon">Doc</div>
          <div class="doc-meta">
            <div class="doc-name">{doc.name}</div>
            <div class="doc-file">{doc.fileName} &bull; {doc.size}</div>
            <div class="doc-uploader">Uploaded by: {doc.uploadedBy} &bull; {doc.uploadDate}</div>
          </div>
          <span class={`badge-xs ${ds.cls}`}>{ds.label}</span>
        </div>
        {doc.fileId && (
          <div class="doc-actions-row">
            <a href={fileUrl(doc.fileId)} target="_blank" class="btn-view-doc">View</a>
            <a href={fileUrl(doc.fileId)} download={doc.fileName} class="btn-dl-doc">Download</a>
          </div>
        )}
        {doc.status !== 'pending' && doc.reviewedBy && (
          <div class="doc-review">Reviewed by {doc.reviewedBy} on {doc.reviewDate}</div>
        )}
        {doc.status === 'rejected' && doc.rejectReason && (
          <div class="doc-reject-reason">Reason: {doc.rejectReason}</div>
        )}
        {doc.status === 'pending' && !isRejecting && (
          <div class="doc-btn-row">
            <button class="btn-approve" onClick={() => this.doApprove(doc.id)}>Approve</button>
            <button class="btn-reject" onClick={() => { this.rejectingDocId = doc.id; this.rejectReason = ''; }}>Reject</button>
          </div>
        )}
        {isRejecting && (
          <div class="reject-form">
            <div class="reject-label">Rejection Reason *</div>
            <textarea rows={2} onInput={(e: any) => { this.rejectReason = e.target.value; }}>{this.rejectReason}</textarea>
            <div class="reject-row">
              <button class="btn-reject-confirm" disabled={!this.rejectReason.trim()} onClick={() => this.doReject(doc.id)}>Reject &amp; Notify</button>
              <button class="btn-reject-cancel" onClick={() => { this.rejectingDocId = null; this.rejectReason = ''; }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  renderAgentGeo(r: Customer) {
    if (r.source !== 'Branch Agent' || !r.agentGeo) return null;
    return (
      <div class="geo-card">
        <div class="geo-title">📍 Agent Geo-verification</div>
        <div class="geo-row">
          <div class="geo-selfie">
            <div class="selfie-placeholder">👤</div>
            <div class="selfie-label">Agent Selfie</div>
            <div class="selfie-sub">{r.agent?.name}</div>
          </div>
          <div class="geo-details">
            <div class="geo-item"><span class="geo-lbl">Capture Time</span><span class="geo-val">{r.agentGeo.time}</span></div>
            <div class="geo-item"><span class="geo-lbl">Agent Location</span><span class="geo-val">{r.agentGeo.location}</span></div>
            <div class="geo-item"><span class="geo-lbl">Customer Address</span><span class="geo-val">{r.address?.slice(0, 40)}...</span></div>
            <div class="geo-item"><span class="geo-lbl">Distance from Record</span><span class={r.agentGeo.distanceOk ? 'geo-val geo-ok' : 'geo-val geo-warn'}>{r.agentGeo.distance} {r.agentGeo.distanceOk ? '✓ Within range' : '⚠ Out of range'}</span></div>
          </div>
        </div>
      </div>
    );
  }

  renderDetail(d: Customer) {
    const docs = d.documents || [];
    const reminders = d.reminders || [];
    const pendingCount = docs.filter(x => x.status === 'pending').length;
    const toastParts = this.toast ? this.toast.split(':') : [];
    const toastType = toastParts[0];
    const toastMsg = toastParts.slice(1).join(':');
    const sc = d.status;

    return (
      <div class="detail">
        <div class="detail-header">
          <div>
            <div class="det-name">{d.name}</div>
            <div class="det-sub">{d.id} &bull; {d.acct} &bull; {d.mobile}</div>
          </div>
          <button class="close-btn" onClick={() => { this.selected = null; }}>✕</button>
        </div>

        <div class="info-grid">
          <div class="info-cell">
            <div class="info-label">STATUS</div>
            <div class="info-val"><span class={`badge-xs ${this.statusStyle(sc)}`}>{sc}</span></div>
          </div>
          <div class="info-cell">
            <div class="info-label">DUE DATE</div>
            <div class="info-val">{d.due}</div>
          </div>
          <div class="info-cell">
            <div class="info-label">RELATIONSHIP</div>
            <div class="info-val">{(d as any).relationship || 'Savings Account'}</div>
          </div>
          <div class="info-cell">
            <div class="info-label">ASSIGNED TO</div>
            <div class="info-val">{(d as any).assignedTo || 'Unassigned'}</div>
          </div>
          <div class="info-cell">
            <div class="info-label">ZONE</div>
            <div class="info-val">{(d as any).zone || '-'}</div>
          </div>
          <div class="info-cell">
            <div class="info-label">SOURCE</div>
            <div class="info-val">{d.source || '-'}</div>
          </div>
        </div>

        {d.agent && (
          <div class="agent-card">
            <div class="agent-label">BRANCH AGENT COLLECTION</div>
            <div class="agent-detail">Agent: <strong>{d.agent.name}</strong> &bull; Collected: {d.agent.date}</div>
          </div>
        )}

        {this.renderAgentGeo(d)}

        {/* KYC Verification Steps */}
        <div class="section-head">KYC Verification Status</div>
        <div class="kyc-steps">
          {this.renderKycStep('PAN Validation', (d as any).panStep)}
          {this.renderKycStep('POI Validation', (d as any).poiStep)}
          {this.renderKycStep('POA Validation', (d as any).poaStep)}
          {this.renderKycStep('Video KYC (VKYC)', (d as any).vkycStep)}
        </div>

        {/* Documents */}
        <div class="section-head" style={{ marginTop: '16px' }}>
          <span>Uploaded Documents</span>
          {pendingCount > 0 && <span class="pending-count">{pendingCount} PENDING</span>}
        </div>
        {this.toast && <div class={toastType === 'ok' ? 'toast good' : 'toast bad'}>{toastMsg}</div>}
        {docs.length === 0
          ? <div class="empty-docs">No documents submitted yet</div>
          : docs.map(doc => this.renderDocCard(doc))
        }

        {/* Re-KYC Link */}
        <div class="section-head" style={{ marginTop: '16px' }}>Re-KYC Link</div>
        <div class="link-card">
          <div>
            <span class={d.linkActive ? 'link-badge active' : 'link-badge'}>{d.linkActive ? '● Active' : '● Inactive'}</span>
            {d.linkExpiry && <span class="link-expiry">&nbsp; Expires: {d.linkExpiry}</span>}
          </div>
          {d.status !== 'Completed' && (
            <button class="btn-regen" onClick={() => this.doRegenLink()}>🔄 Regenerate Link</button>
          )}
        </div>

        {/* Communication History */}
        <div class="section-head" style={{ marginTop: '16px' }}>Communication History</div>
        <div class="timeline">
          {reminders.map((r, i) => (
            <div class="tl-item">
              {i < reminders.length - 1 && <div class="tl-line" />}
              <div class="tl-dot" style={{ background: r.ch === 'WhatsApp' ? '#25D366' : r.ch === 'Email' ? '#3067A6' : r.ch === 'System' ? '#9CA3AF' : '#10B981' }} />
              <div class="tl-body">
                <span class="tl-ch">{this.chIcon(r.ch)} {r.ch}</span>
                <span class="tl-date">{r.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  renderRiskBadge(risk: string) {
    const s = risk === 'High' ? { bg: '#FDE8E8', c: '#900909' } : risk === 'Medium' ? { bg: '#FFF8E6', c: '#B8860B' } : { bg: '#E6F5F0', c: '#0B7A5B' };
    return <span class="risk-badge" style={{ background: s.bg, color: s.c }}>{risk}</span>;
  }

  renderTableRow(r: Customer) {
    const isActive = this.selected && this.selected.id === r.id;
    const docs = r.documents || [];
    const reminders = r.reminders || [];
    const pendingDocs = docs.filter(d => d.status === 'pending').length;
    const lastReminder = reminders.filter(x => x.ch !== 'System').slice(-1)[0];
    return (
      <tr class={isActive ? 'row-active' : ''} onClick={() => this.selectCustomer(r.id)}>
        <td>
          <div class="cell-name">{r.name}</div>
          <div class="cell-sub">{r.id}</div>
        </td>
        <td class="cell-sm">{(r as any).relationship || 'Savings'}</td>
        <td class="cell-sm">{(r as any).zone || '-'}<br/><span class="cell-city">{(r as any).city || ''}</span></td>
        <td class="cell-sm">{(r as any).assignedTo || <span class="cell-muted">Unassigned</span>}</td>
        <td>{this.renderRiskBadge((r as any).risk || 'Low')}</td>
        <td><span class={`status-badge ${this.statusStyle(r.status)}`}>{r.status}</span></td>
        <td class="cell-sm">
          {r.source
            ? <span class="source-tag">{r.source === 'Digital' ? 'Digital' : 'Branch'}</span>
            : <span class="cell-muted">-</span>
          }
        </td>
        <td class="cell-sm">
          <span class="cell-docs">{docs.length}</span>
          {pendingDocs > 0 && <span class="pending-dot" title={`${pendingDocs} pending`} />}
        </td>
        <td class="cell-sm">
          {lastReminder
            ? <div><div class="cell-sm">{lastReminder.ch}</div><div class="cell-date">{lastReminder.date.split(',')[0]}</div></div>
            : <span class="cell-muted">-</span>
          }
        </td>
        <td>
          <button class="btn-view" onClick={(e: MouseEvent) => { e.stopPropagation(); this.selectCustomer(r.id); }}>View</button>
        </td>
      </tr>
    );
  }

  render() {
    if (this.loading) {
      return (
        <div class="dash-loading">
          <div class="nb-logo">NB</div>
          <div class="loading-text">Loading Re-KYC Dashboard...</div>
          <div class="loading-bar"><div class="loading-fill" /></div>
        </div>
      );
    }
    if (this.apiError) {
      return (
        <div class="dash-loading">
          <div class="nb-logo">NB</div>
          <div class="api-error">
            <div>Cannot connect to API</div>
            <code>{(window as any).__REKYC_API__ || 'API_URL not configured'}</code>
            <div class="err-msg">{this.apiError}</div>
            <button class="btn-retry" onClick={() => this.load()}>Retry</button>
          </div>
        </div>
      );
    }

    const all = Array.isArray(this.customers) ? this.customers : [];
    const totalPending = all.filter(c => ['Link Generated','Initiated','In Progress','Pending Doc Upload','Pending VKYC','Pending Verification'].includes(c.status)).length;
    const totalCompleted = all.filter(c => c.status === 'Completed').length;
    const totalOverdue = all.filter(c => c.status === 'Rejected').length;
    const d = this.selected;

    return (
      <div class="dash">
        {/* Sidebar */}
        <div class="sidebar">
          <div class="sidebar-logo">
            <div class="nb-logo-sm">NB</div>
            <span class="sidebar-brand">National Bank</span>
          </div>
          <div class="sidebar-section">Re-KYC</div>
          <div class={this.page === 'dashboard' ? 'sidebar-item active' : 'sidebar-item'} onClick={() => { this.page = 'dashboard'; }}>Dashboard</div>
          <div class={this.page === 'analytics' ? 'sidebar-item active' : 'sidebar-item'} onClick={() => { this.page = 'analytics'; }}>Analytics</div>
          <div class="sidebar-section">Settings</div>
          <div class="sidebar-item">Configuration</div>
        </div>

        {/* Main content */}
        <div class="content-wrap">
          {this.page === 'analytics'
            ? <rekyc-analytics />
            : this.renderDashboard(d, all, totalPending, totalCompleted, totalOverdue)
          }
        </div>
      </div>
    );
  }

  renderDashboard(d: Customer | null, all: Customer[], totalPending: number, totalCompleted: number, totalOverdue: number) {
    return (
      <div class="dash-content">
        {/* Top bar */}
        <div class="topbar">
          <div class="topbar-title-row">
            <div>
              <h1 class="page-title">Re-KYC Dashboard</h1>
              <div class="page-sub">National Bank Ltd. &bull; Operations Team</div>
            </div>
            <div class="topbar-right">
              <div class="search-wrap">
                <span class="search-icon">🔍</span>
                <input class="search-input" placeholder="Search by name, ID, mobile..." value={this.searchQuery} onInput={(e: any) => { this.searchQuery = e.target.value; }} />
              </div>
              <div class="topbar-user">
                <div class="user-avatar">KO</div>
                <div class="user-info"><div class="user-name">KYC Officer</div><div class="user-role">Operations</div></div>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div class="stats-row">
            {this.renderStatCard('Total Triggered', all.length, '📋', '#074994')}
            {this.renderStatCard('Active / Pending', totalPending, '⏳', '#B8860B')}
            {this.renderStatCard('Completed', totalCompleted, '✅', '#0B7A5B')}
            {this.renderStatCard('Rejected', totalOverdue, '❌', '#900909')}
          </div>

          {/* Filters */}
          <div class="filter-row">
            {this.renderFilterBtn('all', 'All Cases')}
            {this.renderFilterBtn('Link Generated', 'Link Generated')}
            {this.renderFilterBtn('Initiated', 'Initiated')}
            {this.renderFilterBtn('In Progress', 'In Progress')}
            {this.renderFilterBtn('Pending Doc Upload', 'Pending Upload')}
            {this.renderFilterBtn('Pending VKYC', 'Pending VKYC')}
            {this.renderFilterBtn('Pending Verification', 'Pending Verification')}
            {this.renderFilterBtn('Completed', 'Completed')}
            {this.renderFilterBtn('Rejected', 'Rejected')}
          </div>
        </div>

        {/* Table + detail */}
        <div class="main-body">
          <div class="table-area">
            <div class="table-header-row">
              <span class="table-count">{this.filtered.length} records</span>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Relationship</th>
                    <th>Zone / City</th>
                    <th>Assigned To</th>
                    <th>Risk</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Docs</th>
                    <th>Last Reminder</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {this.filtered.map(r => this.renderTableRow(r))}
                </tbody>
              </table>
            </div>
          </div>

          {d && this.renderDetail(d)}
        </div>
      </div>
    );
  }
}
