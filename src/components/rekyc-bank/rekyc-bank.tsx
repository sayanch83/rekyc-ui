import { Component, h, State } from '@stencil/core';
import { Customer, fetchCustomers, fetchCustomer, reviewDocument, regenLink, fileUrl } from '../../utils/constants';

@Component({ tag: 'rekyc-bank', styleUrl: 'rekyc-bank.css', shadow: false })
export class RekycBank {
  @State() customers: Customer[] = [];
  @State() selected: Customer | null = null;
  @State() filter = 'all';
  @State() rejectingDocId: string | null = null;
  @State() rejectReason = '';
  @State() toast: string | null = null;
  @State() viewingFile: string | null = null;
  private interval: any;

  async componentWillLoad() { await this.load(); }
  connectedCallback() { this.interval = setInterval(() => this.load(), 5000); }
  disconnectedCallback() { clearInterval(this.interval); }

  async load() {
    this.customers = await fetchCustomers();
    if (this.selected) {
      const fresh = await fetchCustomer(this.selected.id);
      this.selected = fresh;
    }
  }

  async selectCustomer(id: string) {
    this.selected = await fetchCustomer(id);
    this.rejectingDocId = null;
    this.rejectReason = '';
  }

  async doApprove(docId: string) {
    await reviewDocument(this.selected!.id, docId, 'approve', '', 'Bank Officer');
    this.showToast('✓ Document approved');
    await this.load();
  }

  async doReject(docId: string) {
    if (!this.rejectReason.trim()) return;
    await reviewDocument(this.selected!.id, docId, 'reject', this.rejectReason, 'Bank Officer');
    this.rejectingDocId = null;
    this.rejectReason = '';
    this.showToast('✗ Document rejected – customer notified');
    await this.load();
  }

  async doRegenLink() {
    await regenLink(this.selected!.id);
    this.showToast('🔗 New link generated & sent');
    await this.load();
  }

  showToast(msg: string) { this.toast = msg; setTimeout(() => this.toast = null, 3000); }

  get filtered() {
    return this.filter === 'all' ? this.customers : this.customers.filter(c => c.status === this.filter);
  }

  statusColor(s: string) {
    return { pending: { bg: 'var(--warn-bg)', c: '#B8860B' }, completed: { bg: 'var(--acc-s)', c: 'var(--acc)' },
      'in-progress': { bg: 'var(--pri-bg)', c: 'var(--pri2)' }, overdue: { bg: 'var(--dng-bg)', c: 'var(--dng)' }
    }[s] || { bg: 'var(--sf2)', c: 'var(--t3)' };
  }
  chColor(ch: string) { return { SMS: '#10B981', Email: '#3067A6', WhatsApp: '#25D366', System: '#9CA3AF' }[ch] || '#9CA3AF'; }
  docStatusBadge(s: string) {
    return { approved: { bg: 'var(--acc-s)', c: 'var(--acc)', label: '✓ Approved' }, pending: { bg: 'var(--warn-bg)', c: '#B8860B', label: '⏳ Pending' }, rejected: { bg: 'var(--dng-bg)', c: 'var(--dng)', label: '✗ Rejected' } }[s] || { bg: 'var(--sf2)', c: 'var(--t3)', label: s };
  }

  render() {
    const d = this.selected;
    const stats = [
      { label: 'Total', val: this.customers.length, color: 'var(--pri)' },
      { label: 'Pending', val: this.customers.filter(c => c.status === 'pending' || c.status === 'in-progress').length, color: '#B8860B' },
      { label: 'Completed', val: this.customers.filter(c => c.status === 'completed').length, color: 'var(--acc)' },
      { label: 'Overdue', val: this.customers.filter(c => c.status === 'overdue').length, color: 'var(--dng)' },
    ];

    return (
      <div class="dash">
        {/* Top bar */}
        <div class="topbar">
          <div class="topbar-left">
            <div class="logo">NB</div>
            <div><div class="topbar-title">Re-KYC Dashboard</div><div class="topbar-sub">National Bank Ltd. • Operations</div></div>
          </div>
          <div class="filters">
            {['all','pending','in-progress','completed','overdue'].map(f =>
              <button class={{ 'filter-btn': true, active: this.filter === f }} onClick={() => this.filter = f}>{f === 'all' ? 'All' : f === 'in-progress' ? 'In Progress' : f.charAt(0).toUpperCase()+f.slice(1)}</button>
            )}
          </div>
        </div>

        <div class="main">
          {/* Table area */}
          <div class="table-area">
            {/* Stats */}
            <div class="stats-row">
              {stats.map(s => <div class="stat-card"><div class="stat-label">{s.label}</div><div class="stat-val" style={{ color: s.color }}>{s.val}</div></div>)}
            </div>

            {/* Table */}
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>{['Customer','Account','Due Date','Type','Status','Source','Docs','Reminders',''].map(h => <th>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {this.filtered.map(r => {
                    const sc = this.statusColor(r.status);
                    const pendingDocs = r.documents.filter(d => d.status === 'pending').length;
                    return (
                      <tr class={{ active: d?.id === r.id }} onClick={() => this.selectCustomer(r.id)}>
                        <td><div class="cell-name">{r.name}</div><div class="cell-sub">{r.id}</div></td>
                        <td>{r.acct}</td>
                        <td>{r.due}</td>
                        <td><span class="cell-type">{r.kycType || '—'}</span></td>
                        <td><span class="status-badge" style={{ background: sc.bg, color: sc.c }}>{r.status}</span></td>
                        <td>
                          {r.source
                            ? <span class="source-tag">{r.source === 'Digital' ? '🌐 Digital' : '🏢 Branch'}</span>
                            : <span class="cell-muted">—</span>}
                        </td>
                        <td>
                          <span class="cell-docs">{r.documents.length}</span>
                          {pendingDocs > 0 && <span class="pending-dot" title={`${pendingDocs} pending review`} />}
                        </td>
                        <td><span class="cell-rem">{r.reminders.length} sent</span></td>
                        <td><button class="view-btn" onClick={(e) => { e.stopPropagation(); this.selectCustomer(r.id); }}>View</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail panel */}
          {d && (
            <div class="detail">
              <button class="close-btn" onClick={() => this.selected = null}>✕</button>
              <div class="det-name">{d.name}</div>
              <div class="det-sub">{d.id} • {d.acct} • {d.mobile}</div>

              {/* Info grid */}
              <div class="info-grid">
                <div class="info-cell"><div class="info-label">STATUS</div><div class="info-val" style={{ color: this.statusColor(d.status).c }}>{d.status}</div></div>
                <div class="info-cell"><div class="info-label">DUE DATE</div><div class="info-val">{d.due}</div></div>
                <div class="info-cell"><div class="info-label">KYC TYPE</div><div class="info-val">{d.kycType || '—'}</div></div>
                <div class="info-cell"><div class="info-label">SOURCE</div><div class="info-val">{d.source ? (d.source === 'Digital' ? '🌐 Digital' : '🏢 Branch') : '—'}</div></div>
              </div>

              {d.agent && (
                <div class="agent-card">
                  <div class="agent-label">BRANCH COLLECTION</div>
                  <div>Agent: <strong>{d.agent.name}</strong> • {d.agent.date}</div>
                </div>
              )}

              {/* ══ DOCUMENTS SECTION ══ */}
              <div class="section-head">
                <span>Submitted Documents</span>
                {d.documents.filter(x => x.status === 'pending').length > 0 && (
                  <span class="pending-count">{d.documents.filter(x => x.status === 'pending').length} PENDING</span>
                )}
              </div>

              {this.toast && <div class={{ 'toast': true, good: this.toast.startsWith('✓'), bad: this.toast.startsWith('✗') }}>{this.toast}</div>}

              {d.documents.length === 0 && <div class="empty-docs">No documents submitted yet</div>}

              {d.documents.map(doc => {
                const ds = this.docStatusBadge(doc.status);
                return (
                  <div class={{ 'doc-card': true, pending: doc.status === 'pending', rejected: doc.status === 'rejected' }}>
                    {/* Header */}
                    <div class="doc-header">
                      <div class="doc-icon-wrap"><span class="doc-emoji">📄</span></div>
                      <div class="doc-meta">
                        <div class="doc-name">{doc.name}</div>
                        <div class="doc-file">{doc.fileName} • {doc.size}</div>
                      </div>
                      <span class="doc-status" style={{ background: ds.bg, color: ds.c }}>{ds.label}</span>
                    </div>

                    {/* Upload info */}
                    <div class="doc-upload-info">
                      <span>📤 {doc.uploadedBy}</span>
                      <span>📅 {doc.uploadDate}</span>
                    </div>

                    {/* View file button */}
                    {doc.fileId && (
                      <div class="doc-view-row">
                        <a href={fileUrl(doc.fileId)} target="_blank" class="view-file-btn">👁 View Document</a>
                        <a href={fileUrl(doc.fileId)} download class="dl-file-btn">⬇ Download</a>
                      </div>
                    )}

                    {/* Review info */}
                    {doc.status !== 'pending' && doc.reviewedBy && (
                      <div class="doc-review-info">
                        <strong>Reviewed by:</strong> {doc.reviewedBy} • {doc.reviewDate}
                      </div>
                    )}

                    {/* Reject reason */}
                    {doc.status === 'rejected' && doc.rejectReason && (
                      <div class="doc-reject-reason"><strong>Reason:</strong> {doc.rejectReason}</div>
                    )}

                    {/* Action buttons */}
                    {doc.status === 'pending' && this.rejectingDocId !== doc.id && (
                      <div class="doc-actions">
                        <button class="approve-btn" onClick={() => this.doApprove(doc.id)}>✓ Approve</button>
                        <button class="reject-btn" onClick={() => { this.rejectingDocId = doc.id; this.rejectReason = ''; }}>✗ Reject</button>
                      </div>
                    )}

                    {/* Reject form */}
                    {this.rejectingDocId === doc.id && (
                      <div class="reject-form">
                        <div class="reject-label">Rejection Reason *</div>
                        <textarea placeholder="Reason will be sent to customer..." rows={3} value={this.rejectReason} onInput={(e: any) => this.rejectReason = e.target.value} />
                        <div class="reject-actions">
                          <button class="reject-confirm" disabled={!this.rejectReason.trim()} onClick={() => this.doReject(doc.id)}>Reject & Notify</button>
                          <button class="reject-cancel" onClick={() => { this.rejectingDocId = null; this.rejectReason = ''; }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Link section */}
              <div class="section-head" style={{ marginTop: '16px' }}>Re-KYC Link</div>
              <div class="link-card">
                <div class="link-status">
                  <span class={{ 'link-badge': true, active: d.linkActive }}>{d.linkActive ? '✓ Active' : '✗ Inactive'}</span>
                  {d.linkExpiry && <span class="link-expiry">Expires: {d.linkExpiry}</span>}
                </div>
                {d.status !== 'completed' && <button class="regen-btn" onClick={() => this.doRegenLink()}>🔄 Regenerate Link</button>}
              </div>

              {/* Reminders */}
              <div class="section-head" style={{ marginTop: '16px' }}>Communication History</div>
              <div class="timeline">
                {d.reminders.map((r, i) =>
                  <div class="tl-item">
                    <div class="tl-dot" style={{ background: this.chColor(r.ch) }} />
                    {i < d.reminders.length - 1 && <div class="tl-line" />}
                    <div class="tl-content">
                      <div class="tl-head"><span class="tl-ch">{r.ch}</span><span class="tl-date">{r.date}</span></div>
                      <div class="tl-status">{r.status}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}
