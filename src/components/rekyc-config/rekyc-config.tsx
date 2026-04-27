import { Component, h, State } from '@stencil/core';
import { API } from '../../utils/constants';

interface CustomerConfig {
  id: string;
  name: string;
  mobile: string;
  email: string;
  due: string;
  status: string;
  risk: string;
}

const CUSTOMERS = [
  { id: 'KYC-4528', label: 'Rajesh Kumar Sharma — Pending VKYC' },
  { id: 'KYC-7891', label: 'Priya Mehta — Completed' },
  { id: 'KYC-5512', label: 'Sneha Reddy — Pending Doc Upload' },
  { id: 'KYC-6678', label: 'Vikram Singh — Initiated' },
  { id: 'KYC-8834', label: 'Arjun Nair — Link Generated' },
  { id: 'KYC-9901', label: 'Sanjay Kapoor — Rejected' },
  { id: 'KYC-7723', label: 'Rohit Agarwal — In Progress' },
];

const STATUS_OPTIONS = [
  'Link Generated','Initiated','In Progress',
  'Pending Doc Upload','Pending VKYC','Pending Verification','Completed','Rejected'
];

const RISK_OPTIONS = ['Low', 'Medium', 'High'];

@Component({ tag: 'rekyc-config', styleUrl: 'rekyc-config.css', shadow: false })
export class RekycConfig {
  @State() selectedId = 'KYC-4528';
  @State() config: CustomerConfig | null = null;
  @State() loading = false;
  @State() saving = false;
  @State() saved = false;
  @State() error = '';
  @State() resetDone = false;
  @State() resetting = false;

  // Editable fields
  @State() mobile = '';
  @State() email = '';
  @State() name = '';
  @State() due = '';
  @State() status = '';
  @State() risk = '';

  async componentWillLoad() { await this.loadConfig(); }

  async loadConfig() {
    this.loading = true;
    this.saved = false;
    this.error = '';
    try {
      const r = await fetch(`${API}/api/demo/config/${this.selectedId}`);
      const d: CustomerConfig = await r.json();
      this.config = d;
      this.name   = d.name;
      this.mobile = d.mobile;
      this.email  = d.email;
      this.due    = d.due;
      this.status = d.status;
      this.risk   = d.risk || 'Low';
    } catch(e) {
      this.error = 'Failed to load. Check API connection.';
    } finally { this.loading = false; }
  }

  async save() {
    this.saving = true;
    this.saved = false;
    this.error = '';
    try {
      const r = await fetch(`${API}/api/demo/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custId: this.selectedId,
          name:   this.name,
          mobile: this.mobile.startsWith('+') ? this.mobile : `+91 ${this.mobile}`,
          email:  this.email,
          due:    this.due,
          status: this.status,
          risk:   this.risk,
        }),
      });
      if (r.ok) { this.saved = true; setTimeout(() => this.saved = false, 3000); }
      else { this.error = 'Save failed. Please try again.'; }
    } catch(e) { this.error = 'Network error. Please check connection.'; }
    finally { this.saving = false; }
  }

  async resetData() {
    this.resetting = true;
    try {
      await fetch(`${API}/api/reset`, { method: 'POST' });
      this.resetDone = true;
      await this.loadConfig();
      setTimeout(() => this.resetDone = false, 3000);
    } catch(e) { this.error = 'Reset failed.'; }
    finally { this.resetting = false; }
  }

  renderField(label: string, hint: string, children: any) {
    return (
      <div class="cfg-field">
        <label class="cfg-label">{label}</label>
        {hint && <div class="cfg-hint">{hint}</div>}
        {children}
      </div>
    );
  }

  render() {
    const demoUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/customer`;
    const bankUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/bank`;

    return (
      <div class="cfg-wrap">
        {/* Header */}
        <div class="cfg-header">
          <div class="cfg-logo">NB</div>
          <div>
            <div class="cfg-title">Re-KYC Demo Configuration</div>
            <div class="cfg-sub">Set up customer details before your demo</div>
          </div>
          <div class="cfg-links">
            <a href="/customer" class="cfg-link-btn" target="_blank">Customer Portal ↗</a>
            <a href="/bank" class="cfg-link-btn outline" target="_blank">Bank Dashboard ↗</a>
          </div>
        </div>

        <div class="cfg-body">
          {/* Left — config form */}
          <div class="cfg-main">
            <div class="cfg-section">
              <div class="cfg-section-title">Select Customer to Configure</div>
              <select class="cfg-select"
                onChange={async (e: any) => { this.selectedId = e.target.value; await this.loadConfig(); }}>
                {CUSTOMERS.map(c =>
                  <option value={c.id} selected={this.selectedId === c.id}>{c.label}</option>
                )}
              </select>
            </div>

            {this.loading && (
              <div class="cfg-loading">
                <div class="cfg-spinner" /> Loading customer data...
              </div>
            )}

            {!this.loading && this.config && (
              <div>
                <div class="cfg-section">
                  <div class="cfg-section-title">Demo Participant Details</div>
                  <div class="cfg-section-sub">These will be used during the live demo flow</div>

                  {this.renderField('Customer Name', 'Name shown on all KYC screens',
                    <input class="cfg-input" value={this.name}
                      onInput={(e: any) => this.name = e.target.value} />
                  )}

                  {this.renderField('Mobile Number', 'OTP will be sent to this number — must be a verified Twilio number on trial',
                    <div class="cfg-mobile-wrap">
                      <span class="cfg-prefix">+91</span>
                      <input class="cfg-input cfg-mobile" placeholder="98765 43210" type="tel"
                        value={this.mobile.replace(/^\+91\s?/,'')}
                        onInput={(e: any) => this.mobile = e.target.value.replace(/\D/g,'')} />
                    </div>
                  )}

                  {this.renderField('Email Address', 'Acknowledgement email will be sent here',
                    <input class="cfg-input" type="email" value={this.email}
                      onInput={(e: any) => this.email = e.target.value} />
                  )}

                  {this.renderField('KYC Due Date', 'Shown on the customer portal',
                    <input class="cfg-input" value={this.due}
                      placeholder="30 Apr 2026"
                      onInput={(e: any) => this.due = e.target.value} />
                  )}
                </div>

                <div class="cfg-section">
                  <div class="cfg-section-title">Demo Scenario</div>
                  <div class="cfg-section-sub">Control what the bank officer sees on the dashboard</div>

                  <div class="cfg-row-2">
                    {this.renderField('Current Status', '',
                      <select class="cfg-input"
                        onChange={(e: any) => this.status = e.target.value}>
                        {STATUS_OPTIONS.map(s =>
                          <option value={s} selected={this.status === s}>{s}</option>
                        )}
                      </select>
                    )}
                    {this.renderField('Risk Category', '',
                      <select class="cfg-input"
                        onChange={(e: any) => this.risk = e.target.value}>
                        {RISK_OPTIONS.map(r =>
                          <option value={r} selected={this.risk === r}>{r}</option>
                        )}
                      </select>
                    )}
                  </div>
                </div>

                {this.error && <div class="cfg-error">{this.error}</div>}

                <div class="cfg-actions">
                  <button class="cfg-btn-save" disabled={this.saving} onClick={() => this.save()}>
                    {this.saving ? 'Saving...' : this.saved ? '✓ Saved!' : 'Save Configuration'}
                  </button>
                </div>

                {this.saved && (
                  <div class="cfg-success">
                    ✓ Configuration saved. The customer portal will now use these details.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — quick guide + links */}
          <div class="cfg-sidebar">
            <div class="cfg-card">
              <div class="cfg-card-title">Demo Flow</div>
              <div class="cfg-steps">
                <div class="cfg-step"><span class="step-num">1</span><div><strong>Configure</strong><br/>Set mobile number and customer name above</div></div>
                <div class="cfg-step"><span class="step-num">2</span><div><strong>Customer Portal</strong><br/>Open on your phone or second screen</div></div>
                <div class="cfg-step"><span class="step-num">3</span><div><strong>Enter last 4 digits</strong><br/>Of the mobile number you configured</div></div>
                <div class="cfg-step"><span class="step-num">4</span><div><strong>Receive real OTP</strong><br/>SMS delivered via Twilio Verify</div></div>
                <div class="cfg-step"><span class="step-num">5</span><div><strong>Bank Dashboard</strong><br/>Show reviewer seeing the submitted documents</div></div>
                <div class="cfg-step"><span class="step-num">6</span><div><strong>Approve or Reject</strong><br/>Customer receives notification instantly</div></div>
              </div>
            </div>

            <div class="cfg-card">
              <div class="cfg-card-title">Quick Links</div>
              <a href="/customer" target="_blank" class="cfg-quick-link">
                <span class="ql-icon">📱</span>
                <div><div class="ql-title">Customer Portal</div><div class="ql-url">{demoUrl}</div></div>
                <span class="ql-arrow">›</span>
              </a>
              <a href="/bank" target="_blank" class="cfg-quick-link">
                <span class="ql-icon">🏦</span>
                <div><div class="ql-title">Bank Dashboard</div><div class="ql-url">{bankUrl}</div></div>
                <span class="ql-arrow">›</span>
              </a>
            </div>

            <div class="cfg-card cfg-card-danger">
              <div class="cfg-card-title">Reset Demo Data</div>
              <div class="cfg-card-sub">Restores all 11 customers to original seed data. Use before each demo session.</div>
              <button class="cfg-btn-reset" disabled={this.resetting} onClick={() => this.resetData()}>
                {this.resetting ? 'Resetting...' : this.resetDone ? '✓ Reset Complete' : 'Reset All Data'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
