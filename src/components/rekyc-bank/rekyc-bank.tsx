import { Component, h, State } from '@stencil/core';
import { Customer, UploadedDoc, fetchCustomers, fetchCustomer, reviewDocument, regenLink, fileUrl } from '../../utils/constants';

@Component({ tag: 'rekyc-bank', styleUrl: 'rekyc-bank.css', shadow: false })
export class RekycBank {
  @State() customers: Customer[] = [];
  @State() selected: Customer | null = null;
  @State() filter = 'all';
  @State() rejectingDocId: string | null = null;
  @State() rejectReason = '';
  @State() toast: string | null = null;
  @State() loading = true;
  @State() apiError: string | null = null;
  private pollInterval: any;

  async componentWillLoad() { await this.load(); }
  connectedCallback() { this.pollInterval = setInterval(() => this.load(), 6000); }
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
    this.toast = 'ok:Document approved';
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
    this.toast = 'ok:New link generated and sent';
    setTimeout(() => { this.toast = null; }, 3000);
    await this.load();
  }

  get filtered() {
    if (!Array.isArray(this.customers)) return [];
    if (this.filter === 'all') return this.customers;
    return this.customers.filter(c => c.status === this.filter);
  }

  scColor(s: string) {
    if (s === 'pending') return { bg: 'var(--warn-bg)', c: '#B8860B' };
    if (s === 'completed') return { bg: 'var(--acc-s)', c: 'var(--acc)' };
    if (s === 'in-progress') return { bg: 'var(--pri-bg)', c: 'var(--pri2)' };
    if (s === 'overdue') return { bg: 'var(--dng-bg)', c: 'var(--dng)' };
    return { bg: 'var(--sf2)', c: 'var(--t3)' };
  }

  chColor(ch: string) {
    if (ch === 'SMS') return '#10B981';
    if (ch === 'Email') return '#3067A6';
    if (ch === 'WhatsApp') return '#25D366';
    return '#9CA3AF';
  }

  docBadge(s: string) {
    if (s === 'approved') return { bg: 'var(--acc-s)', c: 'var(--acc)', label: 'Approved' };
    if (s === 'rejected') return { bg: 'var(--dng-bg)', c: 'var(--dng)', label: 'Rejected' };
    return { bg: 'var(--warn-bg)', c: '#B8860B', label: 'Pending Review' };
  }

  renderFilterBtn(val: string, label: string) {
    const cls = this.filter === val ? 'filter-btn active' : 'filter-btn';
    return <button class={cls} onClick={() => { this.filter = val; }}>{label}</button>;
  }

  renderStatCard(label: string, val: number, color: string) {
    return (
      <div class="stat-card">
        <div class="stat-label">{label}</div>
        <div class="stat-val" style={{ color }}>{val}</div>
      </div>
    );
  }

  renderTableRow(r: Customer) {
    const sc = this.scColor(r.status);
    const docs = r.documents || [];
    const reminders = r.reminders || [];
    const pendingDocs = docs.filter(d => d.status === 'pending').length;
    const isActive = this.selected && this.selected.id === r.id;
    return (
      <tr class={isActive ? 'active' : ''} onClick={() => this.selectCustomer(r.id)}>
        <td><div class="cell-name">{r.name}</div><div class="cell-sub">{r.id}</div></td>
        <td>{r.acct}</td>
        <td>{r.due}</td>
        <td><span class="cell-type">{r.kycType || '-'}</span></td>
        <td><span class="status-badge" style={{ background: sc.bg, color: sc.c }}>{r.status}</span></td>
        <td>{r.source ? <span class="source-tag">{r.source === 'Digital' ? 'Digital' : 'Branch'}</span> : <span class="cell-muted">-</span>}</td>
        <td><span class="cell-docs">{docs.length}</span>{pendingDocs > 0 && <span class="pending-dot" />}</td>
        <td><span class="cell-rem">{reminders.length} sent</span></td>
        <td><button class="view-btn" onClick={(e: MouseEvent) => { e.stopPropagation(); this.selectCustomer(r.id); }}>View</button></td>
      </tr>
    );
  }

  renderDocCard(doc: UploadedDoc) {
    const ds = this.docBadge(doc.status);
    const isRejecting = this.rejectingDocId === doc.id;
    const docClass = doc.status === 'pending' ? 'doc-card pending' : doc.status === 'rejected' ? 'doc-card rejected' : 'doc-card';
    return (
      <div class={docClass}>
        <div class="doc-header">
          <div class="doc-icon-wrap"><span>📄</span></div>
          <div class="doc-meta">
            <div class="doc-name">{doc.name}</div>
            <div class="doc-file">{doc.fileName} - {doc.size}</div>
          </div>
          <span class="doc-status" style={{ background: ds.bg, color: ds.c }}>{ds.label}</span>
        </div>
        <div class="doc-upload-info">
          <span>Uploaded by: {doc.uploadedBy}</span>
          <span>Date: {doc.uploadDate}</span>
        </div>
        {doc.fileId && (
          <div class="doc-view-row">
            <a href={fileUrl(doc.fileId)} target="_blank" class="view-file-btn">View Document</a>
            <a href={fileUrl(doc.fileId)} download={doc.fileName} class="dl-file-btn">Download</a>
          </div>
        )}
        {doc.status !== 'pending' && doc.reviewedBy && (
          <div class="doc-review-info">Reviewed by: {doc.reviewedBy} on {doc.reviewDate}</div>
        )}
        {doc.status === 'rejected' && doc.rejectReason && (
          <div class="doc-reject-reason">Reason: {doc.rejectReason}</div>
        )}
        {doc.status === 'pending' && !isRejecting && (
          <div class="doc-actions">
            <button class="approve-btn" onClick={() => this.doApprove(doc.id)}>Approve</button>
            <button class="reject-btn" onClick={() => { this.rejectingDocId = doc.id; this.rejectReason = ''; }}>Reject</button>
          </div>
        )}
        {isRejecting && (
          <div class="reject-form">
            <div class="reject-label">Rejection Reason</div>
            <textarea rows={3} onInput={(e: any) => { this.rejectReason = e.target.value; }}>{this.rejectReason}</textarea>
            <div class="reject-actions">
              <button class="reject-confirm" disabled={!this.rejectReason.trim()} onClick={() => this.doReject(doc.id)}>Reject and Notify</button>
              <button class="reject-cancel" onClick={() => { this.rejectingDocId = null; this.rejectReason = ''; }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  renderTimelineItem(r: any, i: number, total: number) {
    return (
      <div class="tl-item">
        <div class="tl-dot" style={{ background: this.chColor(r.ch) }} />
        {i < total - 1 && <div class="tl-line" />}
        <div class="tl-content">
          <div class="tl-head"><span class="tl-ch">{r.ch}</span><span class="tl-date">{r.date}</span></div>
          <div class="tl-status">{r.status}</div>
        </div>
      </div>
    );
  }

  renderDetail(d: Customer) {
    const sc = this.scColor(d.status);
    const docs = d.documents || [];
    const reminders = d.reminders || [];
    const pendingCount = docs.filter(x => x.status === 'pending').length;
    const toastParts = this.toast ? this.toast.split(':') : [];
    const toastType = toastParts[0];
    const toastMsg = toastParts.slice(1).join(':');
    return (
      <div class="detail">
        <button class="close-btn" onClick={() => { this.selected = null; }}>X</button>
        <div class="det-name">{d.name}</div>
        <div class="det-sub">{d.id} - {d.acct} - {d.mobile}</div>
        <div class="info-grid">
          <div class="info-cell"><div class="info-label">STATUS</div><div class="info-val" style={{ color: sc.c }}>{d.status}</div></div>
          <div class="info-cell"><div class="info-label">DUE DATE</div><div class="info-val">{d.due}</div></div>
          <div class="info-cell"><div class="info-label">KYC TYPE</div><div class="info-val">{d.kycType || '-'}</div></div>
          <div class="info-cell"><div class="info-label">SOURCE</div><div class="info-val">{d.source || '-'}</div></div>
        </div>
        {d.agent && (
          <div class="agent-card">
            <div class="agent-label">BRANCH COLLECTION</div>
            <div>Agent: {d.agent.name} - {d.agent.date}</div>
          </div>
        )}
        <div class="section-head">
          <span>Submitted Documents</span>
          {pendingCount > 0 && <span class="pending-count">{pendingCount} PENDING</span>}
        </div>
        {this.toast && <div class={toastType === 'ok' ? 'toast good' : 'toast bad'}>{toastMsg}</div>}
        {docs.length === 0
          ? <div class="empty-docs">No documents submitted yet</div>
          : docs.map(doc => this.renderDocCard(doc))
        }
        <div class="section-head" style={{ marginTop: '16px' }}>Re-KYC Link</div>
        <div class="link-card">
          <div class="link-status">
            <span class={d.linkActive ? 'link-badge active' : 'link-badge'}>{d.linkActive ? 'Active' : 'Inactive'}</span>
            {d.linkExpiry && <span class="link-expiry">Expires: {d.linkExpiry}</span>}
          </div>
          {d.status !== 'completed' && (
            <button class="regen-btn" onClick={() => this.doRegenLink()}>Regenerate Link</button>
          )}
        </div>
        <div class="section-head" style={{ marginTop: '16px' }}>Communication History</div>
        <div class="timeline">
          {reminders.map((r, i) => this.renderTimelineItem(r, i, reminders.length))}
        </div>
      </div>
    );
  }

  render() {
    if (this.loading) {
      return (
        <div class="dash-loading">
          <div class="logo">NB</div>
          <div>Loading Re-KYC Dashboard...</div>
        </div>
      );
    }
    if (this.apiError) {
      return (
        <div class="dash-loading">
          <div class="logo">NB</div>
          <div class="api-error">
            <div>Cannot connect to API</div>
            <div>{this.apiError}</div>
            <button onClick={() => this.load()}>Retry</button>
          </div>
        </div>
      );
    }
    const d = this.selected;
    const totalPending = this.customers.filter(c => c.status === 'pending' || c.status === 'in-progress').length;
    const totalCompleted = this.customers.filter(c => c.status === 'completed').length;
    const totalOverdue = this.customers.filter(c => c.status === 'overdue').length;
    return (
      <div class="dash">
        <div class="topbar">
          <div class="topbar-left">
            <div class="logo">NB</div>
            <div>
              <div class="topbar-title">Re-KYC Dashboard</div>
              <div class="topbar-sub">National Bank Ltd. - Operations</div>
            </div>
          </div>
          <div class="filters">
            {this.renderFilterBtn('all', 'All')}
            {this.renderFilterBtn('pending', 'Pending')}
            {this.renderFilterBtn('in-progress', 'In Progress')}
            {this.renderFilterBtn('completed', 'Completed')}
            {this.renderFilterBtn('overdue', 'Overdue')}
          </div>
        </div>
        <div class="main">
          <div class="table-area">
            <div class="stats-row">
              {this.renderStatCard('Total', this.customers.length, 'var(--pri)')}
              {this.renderStatCard('Pending', totalPending, '#B8860B')}
              {this.renderStatCard('Completed', totalCompleted, 'var(--acc)')}
              {this.renderStatCard('Overdue', totalOverdue, 'var(--dng)')}
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th><th>Account</th><th>Due Date</th>
                    <th>Type</th><th>Status</th><th>Source</th>
                    <th>Docs</th><th>Reminders</th><th></th>
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
