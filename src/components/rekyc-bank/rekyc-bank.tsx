import { Component, h, State } from '@stencil/core';
import { Customer, UploadedDoc, fetchCustomers, fetchCustomer, reviewDocument, regenLink, fileUrl } from '../../utils/constants';

@Component({ tag: 'rekyc-bank', styleUrl: 'rekyc-bank.css', shadow: false })
export class RekycBank {
  @State() page: 'dashboard' | 'analytics' | 'bulk' = 'dashboard';
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
    if (ch === 'WhatsApp') return '💬';
    if (ch === 'SMS')      return '📱';
    if (ch === 'Email')    return '✉';
    if (ch === 'System')   return '⚙';
    return '📋';
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
    const isPending = doc.status === 'pending';
    const isApproved = doc.status === 'approved';
    const isRejected = doc.status === 'rejected';

    return (
      <div class={`doc-card-v2 ${isPending ? 'doc-v2-pending' : isApproved ? 'doc-v2-approved' : isRejected ? 'doc-v2-rejected' : ''}`}>
        {/* Doc header row */}
        <div class="doc-v2-header">
          <div class="doc-v2-icon">
            {doc.name.toLowerCase().includes('pan') ? '🪪'
              : doc.name.toLowerCase().includes('passport') ? '📘'
              : doc.name.toLowerCase().includes('aadhaar') || doc.name.toLowerCase().includes('aadhar') ? '🪪'
              : doc.name.toLowerCase().includes('voter') ? '📋'
              : doc.name.toLowerCase().includes('photo') ? '📷'
              : doc.name.toLowerCase().includes('licence') || doc.name.toLowerCase().includes('license') ? '🚗'
              : '📄'}
          </div>
          <div class="doc-v2-meta">
            <div class="doc-v2-name">{doc.name}</div>
            <div class="doc-v2-file">{doc.fileName} &bull; {doc.size}</div>
            <div class="doc-v2-uploader">By {doc.uploadedBy} &bull; {doc.uploadDate}</div>
          </div>
          <span class={`doc-v2-badge ${ds.cls}`}>{ds.label}</span>
        </div>

        {/* View / Download — always shown if file exists */}
        {doc.fileId && (
          <div class="doc-v2-preview-row">
            <a href={fileUrl(doc.fileId)} target="_blank" class="doc-v2-btn-view">
              👁 View Document
            </a>
            <a href={fileUrl(doc.fileId)} download={doc.fileName} class="doc-v2-btn-dl">
              ⬇ Download
            </a>
          </div>
        )}

        {/* Review result */}
        {!isPending && doc.reviewedBy && (
          <div class={`doc-v2-reviewed ${isApproved ? 'doc-v2-reviewed-ok' : 'doc-v2-reviewed-fail'}`}>
            {isApproved ? '✓ Approved' : '✗ Rejected'} by {doc.reviewedBy} &bull; {doc.reviewDate}
          </div>
        )}
        {isRejected && doc.rejectReason && (
          <div class="doc-v2-reject-reason">Reason: {doc.rejectReason}</div>
        )}

        {/* Approve / Reject — only for pending */}
        {isPending && !isRejecting && (
          <div class="doc-v2-actions">
            <button class="doc-v2-approve" onClick={() => this.doApprove(doc.id)}>
              ✓ Approve
            </button>
            <button class="doc-v2-reject" onClick={() => { this.rejectingDocId = doc.id; this.rejectReason = ''; }}>
              ✗ Reject
            </button>
          </div>
        )}

        {/* Rejection form */}
        {isRejecting && (
          <div class="doc-v2-reject-form">
            <label class="reject-form-label">Rejection Reason <span style={{ color: '#900909' }}>*</span></label>
            <textarea class="reject-form-textarea" rows={2}
              placeholder="Explain why this document cannot be accepted..."
              onInput={(e: any) => { this.rejectReason = e.target.value; }}>{this.rejectReason}</textarea>
            <div class="reject-form-btns">
              <button class="doc-v2-reject-confirm" disabled={!this.rejectReason.trim()}
                onClick={() => this.doReject(doc.id)}>
                ✗ Reject &amp; Notify Customer
              </button>
              <button class="doc-v2-reject-cancel"
                onClick={() => { this.rejectingDocId = null; this.rejectReason = ''; }}>
                Cancel
              </button>
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
    const needsReview = pendingCount > 0 || sc === 'Pending Verification';

    return (
      <div class={needsReview ? 'detail detail-wide' : 'detail'}>

        {/* ── Header ── */}
        <div class="detail-header">
          <div class="det-header-left">
            <div class="det-avatar">{d.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}</div>
            <div>
              <div class="det-name">{d.name}</div>
              <div class="det-sub">{d.id} &bull; {d.acct} &bull; {d.mobile}</div>
            </div>
          </div>
          <div class="det-header-right">
            <span class={`badge-xs ${this.statusStyle(sc)}`}>{sc}</span>
            <button class="close-btn" onClick={() => { this.selected = null; }}>✕</button>
          </div>
        </div>

        {/* ── Toast ── */}
        {this.toast && <div class={toastType === 'ok' ? 'toast good' : 'toast bad'}>{toastMsg}</div>}

        {/* ── Two-column layout for wide mode ── */}
        <div class={needsReview ? 'det-body-wide' : 'det-body-narrow'}>

          {/* Left column — customer info + KYC steps + link */}
          <div class="det-col-left">
            <div class="det-section-title">Customer Details</div>
            <div class="info-grid-2">
              <div class="ig2-cell"><div class="info-label">RELATIONSHIP</div><div class="info-val">{(d as any).relationship || 'Savings Account'}</div></div>
              <div class="ig2-cell"><div class="info-label">DUE DATE</div><div class="info-val">{d.due}</div></div>
              <div class="ig2-cell"><div class="info-label">ZONE</div><div class="info-val">{(d as any).zone || '-'}</div></div>
              <div class="ig2-cell"><div class="info-label">RISK</div><div class="info-val">{(d as any).risk || '-'}</div></div>
              <div class="ig2-cell"><div class="info-label">SOURCE</div><div class="info-val">{d.source || '-'}</div></div>
              <div class="ig2-cell"><div class="info-label">ASSIGNED TO</div><div class="info-val">{(d as any).assignedTo || 'Unassigned'}</div></div>
            </div>

            {d.agent && (
              <div class="agent-card">
                <div class="agent-label">BRANCH AGENT</div>
                <div class="agent-detail"><strong>{d.agent.name}</strong> &bull; {d.agent.date}</div>
              </div>
            )}
            {this.renderAgentGeo(d)}

            <div class="det-section-title" style={{ marginTop: '14px' }}>KYC Verification</div>
            <div class="kyc-steps">
              {this.renderKycStep('PAN Validation', (d as any).panStep)}
              {this.renderKycStep('POI Validation', (d as any).poiStep)}
              {this.renderKycStep('POA Validation', (d as any).poaStep)}
              {this.renderKycStep('Video KYC (VKYC)', (d as any).vkycStep)}
            </div>

            <div class="det-section-title" style={{ marginTop: '14px' }}>Re-KYC Link</div>
            <div class="link-card">
              <div>
                <span class={d.linkActive ? 'link-badge active' : 'link-badge'}>{d.linkActive ? '● Active' : '● Inactive'}</span>
                {d.linkExpiry && <span class="link-expiry">&nbsp;Expires: {d.linkExpiry}</span>}
              </div>
              {d.status !== 'Completed' && (
                <button class="btn-regen" onClick={() => this.doRegenLink()}>🔄 Regenerate Link</button>
              )}
            </div>

            <div class="det-section-title" style={{ marginTop: '14px' }}>Communication</div>
            <div class="timeline">
              {reminders.slice(-5).map((r, i, arr) => (
                <div class="tl-item">
                  {i < arr.length - 1 && <div class="tl-line" />}
                  <div class="tl-dot" style={{ background: r.ch === 'WhatsApp' ? '#25D366' : r.ch === 'Email' ? '#3067A6' : r.ch === 'System' ? '#9CA3AF' : '#10B981' }} />
                  <div class="tl-body">
                    <span class="tl-ch">{this.chIcon(r.ch)} {r.ch}</span>
                    <span class="tl-date">{r.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — documents ── */}
          <div class="det-col-right">
            <div class="det-doc-header">
              <div class="det-section-title">Uploaded Documents</div>
              {pendingCount > 0 && (
                <span class="pending-count-badge">{pendingCount} pending review</span>
              )}
            </div>
            {docs.length === 0
              ? <div class="empty-docs">No documents submitted yet</div>
              : docs.map(doc => this.renderDocCard(doc))
            }
          </div>
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
          <div class={this.page === 'dashboard' ? 'sidebar-item active' : 'sidebar-item'} onClick={() => { this.page = 'dashboard'; }}>📋 Dashboard</div>
          <div class={this.page === 'analytics' ? 'sidebar-item active' : 'sidebar-item'} onClick={() => { this.page = 'analytics'; }}>📊 Analytics</div>
          <div class={this.page === 'bulk' ? 'sidebar-item active' : 'sidebar-item'} onClick={() => { this.page = 'bulk'; }}>⬆ Bulk Upload</div>
          <div class="sidebar-section">Settings</div>
          <div class="sidebar-item" onClick={() => { window.open('/config','_blank'); }}>⚙ Configuration</div>
        </div>

        {/* Main content */}
        <div class="content-wrap">
          {this.page === 'analytics'
            ? <rekyc-analytics />
            : this.page === 'bulk'
            ? <rekyc-bulk />
            : this.renderDashboard(d, all, totalPending, totalCompleted, totalOverdue)
          }
        </div>
      </div>
    );
  }

  renderDashboard(d: Customer | null, all: Customer[], totalPending: number, totalCompleted: number, totalOverdue: number) {
    // If a customer is selected — show full detail screen instead of table
    if (d) return this.renderDetailScreen(d);

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

          <div class="stats-row">
            {this.renderStatCard('Total Triggered', all.length, '📋', '#074994')}
            {this.renderStatCard('Active / Pending', totalPending, '⏳', '#B8860B')}
            {this.renderStatCard('Completed', totalCompleted, '✅', '#0B7A5B')}
            {this.renderStatCard('Rejected', totalOverdue, '❌', '#900909')}
          </div>

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

        <div class="main-body">
          <div class="table-area" style={{ width: '100%' }}>
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
        </div>
      </div>
    );
  }

  renderDetailScreen(d: Customer) {
    const docs = d.documents || [];
    const reminders = d.reminders || [];
    const pendingCount = docs.filter(x => x.status === 'pending').length;
    const toastParts = this.toast ? this.toast.split(':') : [];
    const toastType = toastParts[0];
    const toastMsg = toastParts.slice(1).join(':');

    return (
      <div class="detail-screen">
        {/* ── Top bar ── */}
        <div class="ds-topbar">
          <button class="ds-back-btn" onClick={() => { this.selected = null; this.toast = null; }}>
            ← Return to Dashboard
          </button>
          <div class="ds-title-area">
            <div class="ds-avatar">{d.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}</div>
            <div>
              <div class="ds-name">{d.name}</div>
              <div class="ds-sub">{d.id} &bull; {d.acct} &bull; {d.mobile}</div>
            </div>
          </div>
          <div class="ds-status-area">
            <span class={`badge-xs ${this.statusStyle(d.status)}`}>{d.status}</span>
            {(d as any).risk && this.renderRiskBadge((d as any).risk)}
            {d.status !== 'Completed' && (
              <button class="btn-regen" onClick={() => this.doRegenLink()}>🔄 Regenerate Link</button>
            )}
          </div>
        </div>

        {this.toast && <div class={toastType === 'ok' ? 'toast good' : 'toast bad'} style={{ margin: '0 24px 0' }}>{toastMsg}</div>}

        {/* ── Body grid ── */}
        <div class="ds-body">

          {/* ── Column 1: Customer info + KYC steps + link ── */}
          <div class="ds-card">
            <div class="ds-card-title">Customer Information</div>
            <div class="ds-info-grid">
              <div class="ds-info-row"><span class="ds-lbl">Full Name</span><span class="ds-val">{d.name}</span></div>
              <div class="ds-info-row"><span class="ds-lbl">Mobile</span><span class="ds-val">{d.mobile}</span></div>
              <div class="ds-info-row"><span class="ds-lbl">Account</span><span class="ds-val">{d.acct}</span></div>
              <div class="ds-info-row"><span class="ds-lbl">Relationship</span><span class="ds-val">{(d as any).relationship || 'Savings Account'}</span></div>
              <div class="ds-info-row"><span class="ds-lbl">KYC Due Date</span><span class="ds-val ds-val-warn">{d.due}</span></div>
              <div class="ds-info-row"><span class="ds-lbl">Zone</span><span class="ds-val">{(d as any).zone || '-'}</span></div>
              <div class="ds-info-row"><span class="ds-lbl">City</span><span class="ds-val">{(d as any).city || '-'}</span></div>
              <div class="ds-info-row"><span class="ds-lbl">Assigned To</span><span class="ds-val">{(d as any).assignedTo || 'Unassigned'}</span></div>
              <div class="ds-info-row"><span class="ds-lbl">Source</span><span class="ds-val">{d.source || '-'}</span></div>
              {(d as any).kycType && <div class="ds-info-row"><span class="ds-lbl">KYC Type</span><span class="ds-val">{(d as any).kycType}</span></div>}
            </div>
          </div>

          {/* ── Column 2: KYC verification steps ── */}
          <div class="ds-card">
            <div class="ds-card-title">KYC Verification Status</div>
            <div class="kyc-steps">
              {this.renderKycStep('PAN Validation', (d as any).panStep)}
              {this.renderKycStep('POI Validation', (d as any).poiStep)}
              {this.renderKycStep('POA Validation', (d as any).poaStep)}
              {this.renderKycStep('Video KYC (VKYC)', (d as any).vkycStep)}
            </div>
            {(d as any).declarationDate && (
              <div class="ds-declaration">
                <div class="ds-decl-title">Self-Declaration</div>
                <div class="ds-decl-row"><span class="ds-lbl">Date</span><span class="ds-val">{(d as any).declarationDate}</span></div>
                {(d as any).declarationName && <div class="ds-decl-row"><span class="ds-lbl">Signed by</span><span class="ds-val">{(d as any).declarationName}</span></div>}
              </div>
            )}

            <div class="ds-card-title" style={{ marginTop: '16px' }}>Re-KYC Link</div>
            <div class="link-card">
              <div>
                <span class={d.linkActive ? 'link-badge active' : 'link-badge'}>{d.linkActive ? '● Active' : '● Inactive'}</span>
                {d.linkExpiry && <span class="link-expiry">&nbsp;Expires: {d.linkExpiry}</span>}
              </div>
            </div>

            {d.agent && (
              <div class="agent-card" style={{ marginTop: '12px' }}>
                <div class="agent-label">BRANCH AGENT</div>
                <div class="agent-detail"><strong>{d.agent.name}</strong> &bull; {d.agent.date}</div>
              </div>
            )}
          </div>

          {/* ── Column 3: Documents ── */}
          <div class="ds-card ds-card-docs">
            <div class="ds-doc-header">
              <div class="ds-card-title">Uploaded Documents</div>
              {pendingCount > 0 && <span class="pending-count-badge">{pendingCount} pending review</span>}
            </div>
            {docs.length === 0
              ? <div class="empty-docs">No documents submitted yet</div>
              : docs.map(doc => this.renderDocCard(doc))
            }
          </div>

          {/* ── Column 4: Communication history ── */}
          <div class="ds-card">
            <div class="ds-card-title">Communication History</div>
            {reminders.length === 0
              ? <div class="empty-docs">No communications yet</div>
              : <div class="timeline">
                  {reminders.map((r, i) => (
                    <div class="tl-item">
                      {i < reminders.length - 1 && <div class="tl-line" />}
                      <div class="tl-dot" style={{ background: r.ch === 'WhatsApp' ? '#25D366' : r.ch === 'Email' ? '#3067A6' : r.ch === 'System' ? '#9CA3AF' : '#10B981' }} />
                      <div class="tl-body">
                        <span class="tl-ch">{this.chIcon(r.ch)} {r.ch}</span>
                        <span class="tl-date">{r.date}</span>
                        {r.status && <span class="tl-status">{r.status}</span>}
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>

        </div>
      </div>
    );
  }
}
