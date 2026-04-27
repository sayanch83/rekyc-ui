import { Component, h, State } from '@stencil/core';

// Use window-level API URL injected by serve.mjs, fallback to env
function apiBase(): string {
  if (typeof window !== 'undefined' && (window as any).__REKYC_API__) return (window as any).__REKYC_API__;
  return 'https://rekyc-work-production.up.railway.app';
}

interface Cust { id: string; name: string; mobile: string; email: string; due: string; status: string; risk: string; }

const CUSTOMERS = [
  { id: 'KYC-4528', label: 'Rajesh Kumar Sharma' },
  { id: 'KYC-7891', label: 'Priya Mehta' },
  { id: 'KYC-5512', label: 'Sneha Reddy' },
  { id: 'KYC-6678', label: 'Vikram Singh' },
  { id: 'KYC-8834', label: 'Arjun Nair' },
  { id: 'KYC-9901', label: 'Sanjay Kapoor' },
  { id: 'KYC-7723', label: 'Rohit Agarwal' },
];

const STATUSES = ['Link Generated','Initiated','In Progress','Pending Doc Upload','Pending VKYC','Pending Verification','Completed','Rejected'];
const RISKS    = ['Low','Medium','High'];

@Component({ tag: 'rekyc-config', styleUrl: 'rekyc-config.css', shadow: false })
export class RekycConfig {
  @State() selId   = 'KYC-4528';
  @State() cust: Cust | null = null;
  @State() loading = false;
  @State() saving  = false;
  @State() saved   = false;
  @State() resetting = false;
  @State() resetDone = false;
  @State() deleting = false;
  @State() deleteId = '';
  @State() deleteConfirm = false;
  @State() err     = '';

  // Form fields kept separate so they are reactive
  @State() fName   = '';
  @State() fMobile = '';
  @State() fEmail  = '';
  @State() fDue    = '';
  @State() fStatus = '';
  @State() fRisk   = '';

  componentDidLoad() { this.load(this.selId); }

  async load(id: string) {
    this.loading = true;
    this.err = '';
    this.cust = null;
    try {
      // Try demo/config endpoint first, fall back to customers/:id
      let r = await fetch(`${apiBase()}/api/demo/config/${id}`);
      if (r.status === 404) {
        // Endpoint not deployed yet — fall back to full customer record
        r = await fetch(`${apiBase()}/api/customers/${id}`);
      }
      if (!r.ok) throw new Error(`API returned ${r.status}`);
      const d: Cust = await r.json();
      this.cust    = d;
      this.fName   = d.name   || '';
      this.fMobile = (d.mobile || '').replace(/^\+91\s?/,'').replace(/\s/g,'');
      this.fEmail  = d.email  || '';
      this.fDue    = d.due    || '';
      this.fStatus = d.status || '';
      this.fRisk   = (d as any).risk   || 'Low';
    } catch(e: any) {
      this.err = `Could not load data — ${e.message}. Check API connection.`;
    } finally { this.loading = false; }
  }

  async save() {
    this.saving = true; this.saved = false; this.err = '';
    try {
      const mobile = this.fMobile.replace(/\D/g,'');
      const r = await fetch(`${apiBase()}/api/demo/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custId: this.selId,
          name:   this.fName.trim(),
          mobile: `+91 ${mobile}`,
          email:  this.fEmail.trim(),
          due:    this.fDue.trim(),
          status: this.fStatus,
          risk:   this.fRisk,
        }),
      });
      if (r.ok) { this.saved = true; setTimeout(() => this.saved = false, 4000); }
      else { const b = await r.text(); this.err = `Save failed: ${b}`; }
    } catch(e: any) { this.err = `Network error: ${e.message}`; }
    finally { this.saving = false; }
  }

  async reset() {
    this.resetting = true; this.err = '';
    try {
      await fetch(`${apiBase()}/api/reset`, { method: 'POST' });
      this.resetDone = true;
      await this.load(this.selId);
      setTimeout(() => this.resetDone = false, 4000);
    } catch(e: any) { this.err = `Reset failed: ${e.message}`; }
    finally { this.resetting = false; }
  }

  async deleteCustomer() {
    if (!this.deleteConfirm) { this.deleteConfirm = true; return; }
    this.deleting = true; this.err = '';
    try {
      const r = await fetch(`${apiBase()}/api/customers/${this.selId}`, { method: 'DELETE' });
      if (r.ok) {
        this.deleteConfirm = false;
        // Reload with first customer
        this.selId = 'KYC-4528';
        await this.load(this.selId);
      } else {
        const b = await r.json();
        this.err = b.error || 'Delete failed';
      }
    } catch(e: any) { this.err = `Delete failed: ${e.message}`; }
    finally { this.deleting = false; this.deleteConfirm = false; }
  }

  inp(label: string, hint: string, el: any) {
    return (
      <div class="f">
        <label class="fl">{label}</label>
        {hint && <div class="fh">{hint}</div>}
        {el}
      </div>
    );
  }

  render() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const last4 = this.fMobile.replace(/\D/g,'').slice(-4);

    return (
      <div class="cfg-wrap">

        {/* ── Header ── */}
        <div class="cfg-hdr">
          <div class="cfg-logo">NB</div>
          <div>
            <div class="cfg-title">Demo Configuration</div>
            <div class="cfg-sub">Set up customer details before your demo session</div>
          </div>
          <div class="cfg-hdr-links">
            <a href="/customer" target="_blank" class="hdr-btn">📱 Customer</a>
            <a href="/bank"     target="_blank" class="hdr-btn">🏦 Dashboard</a>
          </div>
        </div>

        <div class="cfg-layout">

          {/* ── Left: Form ── */}
          <div class="cfg-form">

            {/* Customer selector */}
            <div class="cfg-card">
              <div class="card-title">Select Customer</div>
              <select class="cfg-sel"
                onChange={(e: any) => { this.selId = e.target.value; this.load(e.target.value); }}>
                {CUSTOMERS.map(c =>
                  <option value={c.id} selected={this.selId === c.id}>
                    {c.id} — {c.label}
                  </option>
                )}
              </select>
            </div>

            {/* Error */}
            {this.err && (
              <div class="cfg-err">
                ⚠ {this.err}
                <button class="retry-btn" onClick={() => this.load(this.selId)}>Retry</button>
              </div>
            )}

            {/* Loading */}
            {this.loading && (
              <div class="cfg-loading"><div class="spin" />Loading customer...</div>
            )}

            {/* Form fields */}
            {!this.loading && this.cust && (
              <div>
                <div class="cfg-card">
                  <div class="card-title">Demo Participant</div>
                  <div class="card-sub">OTP will be sent to this mobile number during the demo</div>

                  {this.inp('Customer Name', '', 
                    <input class="fi" value={this.fName} onInput={(e:any) => this.fName = e.target.value} />
                  )}

                  {this.inp('Mobile Number', 'Must be a verified Twilio number on trial accounts',
                    <div class="fi-mobile">
                      <span class="fi-pfx">+91</span>
                      <input class="fi fi-mob-input" type="tel" maxLength={10}
                        value={this.fMobile}
                        onInput={(e:any) => this.fMobile = e.target.value.replace(/\D/g,'').slice(0,10)} />
                    </div>
                  )}

                  {this.fMobile.replace(/\D/g,'').length === 10 && (
                    <div class="mobile-preview">
                      On the portal, customer enters last 4 digits: <strong>{last4}</strong>
                    </div>
                  )}

                  {this.inp('Email Address', 'Acknowledgement email sent here',
                    <input class="fi" type="email" value={this.fEmail} onInput={(e:any) => this.fEmail = e.target.value} />
                  )}

                  {this.inp('KYC Due Date', 'Shown on customer portal (e.g. 30 Apr 2026)',
                    <input class="fi" value={this.fDue} placeholder="30 Apr 2026" onInput={(e:any) => this.fDue = e.target.value} />
                  )}
                </div>

                <div class="cfg-card">
                  <div class="card-title">Dashboard Scenario</div>
                  <div class="card-sub">Controls what the bank officer sees</div>

                  <div class="fi-row">
                    {this.inp('Status', '',
                      <select class="fi" onChange={(e:any) => this.fStatus = e.target.value}>
                        {STATUSES.map(s => <option value={s} selected={this.fStatus === s}>{s}</option>)}
                      </select>
                    )}
                    {this.inp('Risk', '',
                      <select class="fi" onChange={(e:any) => this.fRisk = e.target.value}>
                        {RISKS.map(r => <option value={r} selected={this.fRisk === r}>{r}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                <button class={{ 'save-btn': true, 'saved': this.saved }} disabled={this.saving}
                  onClick={() => this.save()}>
                  {this.saving ? '⏳ Saving...' : this.saved ? '✓ Saved successfully!' : 'Save Configuration'}
                </button>
              </div>
            )}
          </div>

          {/* ── Right: Sidebar ── */}
          <div class="cfg-sidebar">

            <div class="cfg-card">
              <div class="card-title">Demo Steps</div>
              {[
                ['1', 'Configure', 'Enter mobile & name above, click Save'],
                ['2', 'Open Customer Portal', `Go to ${origin}/customer`],
                ['3', 'Enter last 4 digits', `Enter: ${last4 || '····'} on the entry screen`],
                ['4', 'Real OTP arrives', 'SMS via Twilio Verify'],
                ['5', 'Complete journey', 'PAN → Aadhaar → Docs → VKYC'],
                ['6', 'Bank Dashboard', 'Review documents, approve or reject'],
              ].map(([n, t, d]) =>
                <div class="step-row">
                  <div class="step-n">{n}</div>
                  <div><div class="step-t">{t}</div><div class="step-d">{d}</div></div>
                </div>
              )}
            </div>

            <div class="cfg-card links-card">
              <div class="card-title">Quick Links</div>
              {[
                ['📱', 'Customer Portal', `${origin}/customer`, '/customer'],
                ['🏦', 'Bank Dashboard', `${origin}/bank`, '/bank'],
              ].map(([icon, label, url, href]) =>
                <a href={href as string} target="_blank" class="ql">
                  <span class="ql-icon">{icon}</span>
                  <div><div class="ql-t">{label}</div><div class="ql-u">{url}</div></div>
                  <span class="ql-arr">›</span>
                </a>
              )}
            </div>

            <div class="cfg-card danger-card" style={{ marginBottom: '8px' }}>
              <div class="card-title">Delete This Customer</div>
              <div class="card-sub">Remove this customer record from the dashboard. Useful to re-add via bulk upload.</div>
              {this.deleteConfirm
                ? <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-danger)', marginBottom: '8px', fontWeight: '600' }}>
                      ⚠ Confirm delete {this.selId}? This cannot be undone.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button class="reset-btn" disabled={this.deleting}
                        style={{ flex: '1', borderColor: 'rgba(144,9,9,.4)', background: '#fde8e8' }}
                        onClick={() => this.deleteCustomer()}>
                        {this.deleting ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button class="reset-btn" onClick={() => this.deleteConfirm = false}
                        style={{ flex: '1', borderColor: 'var(--color-border-secondary)', color: 'var(--color-text-secondary)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                : <button class="reset-btn" onClick={() => this.deleteCustomer()}>
                    ✕ Delete Customer Record
                  </button>
              }
            </div>

            <div class="cfg-card danger-card">
              <div class="card-title">Reset Demo Data</div>
              <div class="card-sub">Restores all customers to original seed data. Run before each demo.</div>
              <button class="reset-btn" disabled={this.resetting} onClick={() => this.reset()}>
                {this.resetting ? 'Resetting...' : this.resetDone ? '✓ Reset complete!' : '↺ Reset All Data'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
