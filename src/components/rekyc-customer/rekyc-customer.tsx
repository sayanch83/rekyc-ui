import { Component, h, State, Prop } from '@stencil/core';
import { Customer, fetchCustomer, updateCustomer, uploadDocument, CONSENT_ITEMS, KYC_REASONS } from '../../utils/constants';

type Screen = 'whatsapp'|'browser'|'auth_otp'|'consent'|'landing'|'confirm'
  |'minor_choice'|'addr'|'mob_access'|'mob_new'|'mob_otp_old'|'mob_otp_new'
  |'mob_no_access'|'mob_postpaid'|'mob_postpaid_otp'|'branch'
  |'full_intro'|'full_pan'|'full_aadhaar'|'full_aadhaar_otp'|'digilocker'
  |'full_doc'|'full_vkyc'|'full_vkyc_live'|'success';

@Component({ tag: 'rekyc-customer', styleUrl: 'rekyc-customer.css', shadow: false })
export class RekycCustomer {
  @Prop() customerId: string = 'KYC-4528';

  @State() screen: Screen = 'whatsapp';
  @State() hist: Screen[] = ['whatsapp'];
  @State() cust: Customer | null = null;
  @State() consents: Record<string, boolean> = {};
  @State() otpVals: Record<string, string[]> = {};
  @State() sigText = '';
  @State() mobileEntry = '';   // what user typed on browser screen
  @State() minorOpt: string | null = null;
  @State() accessOpt: string | null = null;
  @State() postpaidOpt: string | null = null;
  @State() aadhaarMethod: string | null = null;
  @State() uploading = false;
  @State() uploadedDocs: Record<string, { name: string; fileName: string }> = {};

  async componentWillLoad() {
    try { this.cust = await fetchCustomer(this.customerId); }
    catch (e) { console.error('Failed to load customer:', e); }
  }

  go(s: Screen) { this.hist = [...this.hist, s]; this.screen = s; }
  back() { if (this.hist.length > 1) { const h = this.hist.slice(0,-1); this.hist = h; this.screen = h[h.length-1]; } }
  reset() { this.screen = 'whatsapp'; this.hist = ['whatsapp']; this.consents = {}; this.otpVals = {}; this.sigText = ''; this.mobileEntry = ''; }

  tgl(k: string) { this.consents = { ...this.consents, [k]: !this.consents[k] }; }
  allConsented() { return !!(this.consents.c0 && this.consents.c1 && this.consents.c2); }
  toggleAll() { const on = this.allConsented(); this.consents = { ...this.consents, c0: !on, c1: !on, c2: !on }; }

  otpFilled(prefix: string) { return (this.otpVals[prefix] || []).filter(Boolean).length === 6; }

  handleOtp(prefix: string, idx: number, val: string) {
    const arr = [...(this.otpVals[prefix] || Array(6).fill(''))];
    arr[idx] = val.replace(/\D/g, '').slice(-1);
    this.otpVals = { ...this.otpVals, [prefix]: arr };
    if (val && idx < 5) (document.getElementById(`${prefix}-${idx+1}`) as HTMLInputElement)?.focus();
  }

  async doUpload(slot: string, docName: string, file: File) {
    this.uploading = true;
    try {
      await uploadDocument(this.customerId, file, docName);
      this.uploadedDocs = { ...this.uploadedDocs, [slot]: { name: docName, fileName: file.name } };
    } finally { this.uploading = false; }
  }

  async completeKyc(kycType: string) {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    // Determine status based on journey type
    const newStatus = kycType === 'Full KYC' ? 'Pending VKYC' : 'Completed';
    await updateCustomer(this.customerId, {
      status: newStatus,
      kycType,
      source: 'Digital',
      completedDate: today,
      linkActive: false,
      reminders: [...(this.cust?.reminders || []), { ch: 'System', date: today, status: 'KYC submitted via digital portal' }],
    } as any);
    // Refresh customer data so bank dashboard sees updated state
    try { this.cust = await fetchCustomer(this.customerId); } catch(e) {}
    this.go('success');
  }

  // ── Render helpers ──
  renderOtp(prefix: string) {
    const vals = this.otpVals[prefix] || Array(6).fill('');
    return (
      <div class="otp-row">
        {vals.map((v, i) => (
          <input id={`${prefix}-${i}`} type="password" inputMode="numeric" maxLength={1} value={v}
            class={{ 'otp-box': true, filled: !!v }}
            onInput={(e: any) => this.handleOtp(prefix, i, e.target.value)}
            onKeyDown={(e: any) => { if (e.key === 'Backspace' && !v && i > 0) (document.getElementById(`${prefix}-${i-1}`) as HTMLInputElement)?.focus(); }} />
        ))}
      </div>
    );
  }

  renderUpload(slot: string, label: string, docName: string) {
    const done = !!this.uploadedDocs[slot];
    return (
      <label class={{ 'upload-zone': true, done }}>
        <input type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }}
          onChange={(e: any) => { const f = e.target.files[0]; if (f) this.doUpload(slot, docName, f); }} />
        <div class="up-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        {done
          ? [<div class="up-name">✓ {this.uploadedDocs[slot].fileName}</div>, <div class="up-hint">Uploaded • Tap to replace</div>]
          : [<div class="up-text">{label}</div>, <div class="up-hint">JPG, PNG or PDF • Max 10MB</div>]}
      </label>
    );
  }

  renderNotice(type: string, children: any) {
    return <div class={`notice ${type}`}><div class="notice-icon">{type === 'ok' ? '✓' : type === 'warn' ? '⚠' : 'ℹ'}</div><p>{children}</p></div>;
  }

  renderRadio(selected: boolean, label: string, sub: string, onClick: () => void) {
    return (
      <div class={{ 'radio-opt': true, sel: selected }} onClick={onClick}>
        <div class="radio-dot"><div class="radio-inner" /></div>
        <div><div class="radio-label">{label}</div>{sub && <div class="radio-sub">{sub}</div>}</div>
      </div>
    );
  }

  renderChk(key: string, locked: boolean, children: any) {
    const checked = locked || this.consents[key];
    return (
      <div class={{ cbox: true, checked, locked }} onClick={() => !locked && this.tgl(key)}>
        <div class="chk-box">{checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>}</div>
        <div class="chk-content">{children}</div>
      </div>
    );
  }

  renderOfferTeaser(revealed: boolean) {
    return (
      <div class={{ 'offer-teaser': true, revealed }}>
        <div class="offer-icon">{revealed ? '🎁' : '🎉'}</div>
        <div class="offer-text">
          {revealed
            ? [<div class="offer-title gold">KYC Submitted!</div>,
               <div class="offer-value">Your reward will be credited once your KYC is verified and approved by the bank.</div>]
            : [<div class="offer-title">Complete KYC to Unlock</div>,
               <div class="offer-sub">A pre-approved offer & shopping voucher awaits you!</div>]}
        </div>
      </div>
    );
  }

  titles: Record<string, [string, string]> = {
    whatsapp: ['Re-KYC', 'Secure identity verification'],
    browser: ['Verify Identity', 'Secure portal'],
    auth_otp: ['Authentication', 'Verify identity'],
    consent: ['Consent', 'Before we begin'],
    landing: ['Review Details', 'Your current KYC'],
    confirm: ['Self-Declaration', 'Confirm details'],
    minor_choice: ['Update Details', 'What changed?'],
    addr: ['Update Address', 'New address'],
    mob_access: ['Update Mobile', 'Verify access'],
    mob_new: ['New Mobile', 'Enter number'],
    mob_otp_old: ['Verify Current', 'Step 1/2'],
    mob_otp_new: ['Verify New', 'Step 2/2'],
    mob_no_access: ['Verification', 'Additional check'],
    mob_postpaid: ['Upload Bill', 'Postpaid verify'],
    mob_postpaid_otp: ['Verify Number', 'OTP check'],
    branch: ['Branch Visit', 'In-person required'],
    full_intro: ['Full KYC', 'Complete verification'],
    full_pan: ['PAN', 'Step 1/4'],
    full_aadhaar: ['Aadhaar', 'Step 2/4'],
    full_aadhaar_otp: ['Aadhaar OTP', 'Step 2/4'],
    digilocker: ['DigiLocker', 'Aadhaar fetch'],
    full_doc: ['Documents', 'Step 3/4'],
    full_vkyc: ['Video KYC', 'Step 4/4'],
    full_vkyc_live: ['VKYC Live', 'In progress'],
    success: ['Done', 'KYC Submitted'],
  };

  render() {
    if (!this.cust) return <div class="loading">Loading...</div>;
    const [t1, t2] = this.titles[this.screen] || ['Re-KYC', ''];
    const noBack = ['whatsapp', 'success', 'branch', 'consent'];

    return (
      <div class="phone-wrap">
        <div class="phone">
          <div class="status-bar"><span>9:41</span><span>⦿ ▮▮▮ 🔋</span></div>
          <div class="hdr">
            {!noBack.includes(this.screen) && (
              <button class="hdr-back" onClick={() => this.back()}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            )}
            <div><h1>{t1}</h1><p>{t2}</p></div>
          </div>
          <div class="body">{this.renderScreen()}</div>
          {this.uploading && <div class="upload-overlay">Uploading...</div>}
        </div>
      </div>
    );
  }

  renderScreen() {
    const c = this.cust!;
    // Fix 3: derive last4 consistently from the API mobile field
    const last4 = c.mobile.replace(/\D/g, '').slice(-4);
    // Mask: show first part hidden, last 4 visible
    const maskedMobile = `+91 XXXXX X${last4}`;

    switch (this.screen) {

    // ── WhatsApp notification ──
    case 'whatsapp': return (
      <div class="scr">
        <p class="intro">You received a message from <strong>National Bank</strong>.</p>
        <div class="wa-bubble">
          <div class="wa-header"><div class="wa-avatar">NB</div><div><strong>National Bank Official</strong> <span class="verified">✓ Verified</span></div></div>
          <div class="wa-body">
            Hi <strong>{c.name.split(' ')[0]}</strong>! 👋<br/><br/>
            Your KYC update is due by <strong>{c.due}</strong>. Complete it now to keep your account active and unlock rewards waiting for you.<br/><br/>
            🔒 Quick and secure — takes just 5 minutes.
          </div>
          <div class="wa-time">9:37 AM ✓✓</div>
        </div>
        <button class="btn-wa" onClick={() => this.go('browser')}>🔗 Open Re-KYC Portal</button>
      </div>
    );

    // ── Browser: mobile entry ──
    case 'browser': return (
      <div class="scr">
        <div class="browser-bar"><span class="lock">🔒</span> <code><strong>https://</strong>nationalbank.co.in/rekyc</code></div>
        <div class="bank-row"><div class="bank-logo">NB</div><div><strong>National Bank Ltd.</strong><br/><span class="t2">Secure Re-KYC Portal</span></div></div>
        {this.renderOfferTeaser(false)}
        <label class="field-label">Registered Mobile (last 4 digits) *</label>
        <input class="field-input" id="mob-entry" type="text" inputMode="numeric" maxLength={4}
          placeholder="e.g. 3210"
          value={this.mobileEntry}
          onInput={(e: any) => { this.mobileEntry = e.target.value.replace(/\D/g,'').slice(0,4); }} />
        <div class="hint">Enter the last 4 digits of your registered mobile number</div>
        <button class="btn-primary" disabled={this.mobileEntry.length !== 4} onClick={() => this.go('auth_otp')}>Verify &amp; Proceed</button>
      </div>
    );

    // ── Auth OTP ── (Fix 3: show last4 the user entered, confirming it matches)
    case 'auth_otp': return (
      <div class="scr tc">
        <p class="t2">OTP sent to mobile ending in <strong>···{this.mobileEntry || last4}</strong></p>
        {this.renderOtp('auth')}
        <button class="btn-primary" disabled={!this.otpFilled('auth')} onClick={() => this.go('consent')}>Authenticate</button>
        <button class="btn-text">Resend OTP</button>
      </div>
    );

    // ── Fix 1: CONSENT — now first screen after OTP, before anything else ──
    case 'consent': return (
      <div class="scr">
        <div class="bank-row"><div class="bank-logo">NB</div><div><strong>National Bank Ltd.</strong><br/><span class="t2">Re-KYC Consent</span></div></div>
        {this.renderNotice('info', <span>Before we proceed, please read and accept the declarations below. This is required to update your KYC records with the bank.</span>)}

        <div class="select-all-row" onClick={() => this.toggleAll()}>
          <div class={{ 'chk-box': true, checked: this.allConsented() }}>
            {this.allConsented() && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
          <span class="select-all-label">Accept All</span>
        </div>

        {CONSENT_ITEMS.map((txt, i) => this.renderChk(`c${i}`, false,
          <span>{i === 0 ? <span>I, <strong>{c.name}</strong>, {txt.slice(2)}</span> : txt}</span>
        ))}

        <button class="btn-accent" style={{ marginTop: '16px' }}
          disabled={!this.allConsented()}
          onClick={() => this.go('landing')}>
          Proceed to KYC Update
        </button>
        <p class="hint tc" style={{ marginTop: '8px' }}>By proceeding, you authorise National Bank to access and update your KYC records.</p>
      </div>
    );

    // ── Landing ──
    case 'landing': return (
      <div class="scr">
        <div class="bank-row"><div class="bank-logo">NB</div><div><strong>National Bank Ltd.</strong><br/><span class="t2">Customer ID: {c.acct}</span></div></div>
        {this.renderNotice('warn', <span><strong>KYC renewal due by {c.due}.</strong> Update now to keep your account active.</span>)}
        {this.renderOfferTeaser(false)}

        <h3 class="sec-title">Personal Information</h3>
        <div class="data-card">
          {([['Full Name', c.name],['Date of Birth', c.dob],['PAN', c.pan],['Aadhaar', c.aadhaar],['Constitution', c.constitution]] as [string,string][]).map(([l,v]) =>
            <div class="d-row"><span class="d-lbl">{l}</span><span class="d-val">{v}</span></div>
          )}
        </div>

        <h3 class="sec-title">Contact</h3>
        <div class="data-card">
          {/* Fix 3: Show masked mobile using same last4 */}
          <div class="d-row"><span class="d-lbl">Mobile</span><span class="d-val">{maskedMobile}</span></div>
          <div class="d-row"><span class="d-lbl">Email</span><span class="d-val">{c.email}</span></div>
        </div>

        {/* Fix 2: Remove "No Expiry" text; show expiry only when applicable */}
        <h3 class="sec-title">KYC Details on Record</h3>
        {c.docsOnFile.map(d => {
          const expired = !d.valid;
          // Clean meta: remove "No expiry" variants
          const meta = d.meta.replace(/\s*•?\s*No expiry/gi, '').replace(/\s*•?\s*No Expiry/gi, '').trim();
          return (
            <div class={{ 'doc-row': true, 'doc-row-expired': expired }}>
              <div class="doc-icon">📄</div>
              <div class="doc-info">
                <div class={{ 'doc-name': true, 'doc-name-expired': expired }}>{d.name}</div>
                {meta && <div class="doc-meta">{meta}</div>}
              </div>
              {expired && <span class="badge red">Expired</span>}
            </div>
          );
        })}

        <h3 class="sec-title" style={{ marginTop: '20px' }}>How would you like to proceed?</h3>
        <div class="action-card" onClick={() => this.go('confirm')}>
          <div class="ac-icon green">✓</div>
          <div class="ac-body"><div class="ac-title">Details are Correct</div><div class="ac-desc">Self-declare all details are accurate</div><div class="ac-time">⏱ ~2 min</div></div>
          <div class="ac-arrow">›</div>
        </div>
        <div class="action-card" onClick={() => this.go('minor_choice')}>
          <div class="ac-icon blue">✎</div>
          <div class="ac-body"><div class="ac-title">Update Address / Mobile</div><div class="ac-desc">Address or mobile number changed</div><div class="ac-time">⏱ ~5 min</div></div>
          <div class="ac-arrow">›</div>
        </div>
        <div class="action-card" onClick={() => this.go('full_intro')}>
          <div class="ac-icon amber">⚑</div>
          <div class="ac-body"><div class="ac-title">Name / Constitution Change or Document Expired</div><div class="ac-desc">Identity details changed or a document needs renewal</div><div class="ac-time">⏱ ~10 min</div></div>
          <div class="ac-arrow">›</div>
        </div>
      </div>
    );

    // ── Fix 5: Self-declaration — NO OTP (user already authenticated at start) ──
    case 'confirm': return (
      <div class="scr">
        {this.renderNotice('ok', 'You are confirming that all KYC details on record are correct and up-to-date.')}
        {this.renderOfferTeaser(false)}
        <h3 class="sec-title">Digital Signature</h3>
        <p class="t2" style={{ marginBottom: '10px' }}>Type your full name below as your digital signature to submit the declaration.</p>
        <label class="field-label">Full Name *</label>
        <input class="field-input" type="text" placeholder={`Enter: ${c.name}`} value={this.sigText} onInput={(e:any) => this.sigText = e.target.value} />
        <div class="hint">Must match your registered name exactly</div>
        {/* Fix 5: Direct submit — no OTP needed as journey started with OTP */}
        <button class="btn-accent" style={{ marginTop: '16px' }}
          disabled={this.sigText.trim().length < 4}
          onClick={() => this.completeKyc('Self-Declaration')}>
          ✓ Submit Self-Declaration
        </button>
      </div>
    );

    // ── FLOW B: Minor Update ──
    case 'minor_choice': return (
      <div class="scr">
        <h3 class="sec-title">What would you like to update?</h3>
        {this.renderRadio(this.minorOpt === 'address', 'Address has changed', '', () => this.minorOpt = 'address')}
        {this.renderRadio(this.minorOpt === 'mobile', 'Mobile number has changed', '', () => this.minorOpt = 'mobile')}
        {this.renderRadio(this.minorOpt === 'both', 'Both address and mobile', '', () => this.minorOpt = 'both')}
        <button class="btn-primary" disabled={!this.minorOpt} onClick={() => this.go(this.minorOpt === 'mobile' ? 'mob_access' : 'addr')}>Continue</button>
      </div>
    );
    case 'addr': return (
      <div class="scr">
        <h3 class="sec-title">New Address Details</h3>
        <label class="field-label">Address Line 1 *</label><input class="field-input" placeholder="Flat/House, Building" />
        <label class="field-label">Address Line 2</label><input class="field-input" placeholder="Street, Locality" />
        <div class="row-2"><div><label class="field-label">City *</label><input class="field-input" placeholder="City"/></div><div><label class="field-label">PIN *</label><input class="field-input" placeholder="400001" maxLength={6}/></div></div>
        <h3 class="sec-title">Upload Address Proof</h3>
        {this.renderUpload('addr', 'Upload address proof', 'Address Proof')}
        <button class="btn-primary" onClick={() => this.go(this.minorOpt === 'both' ? 'mob_access' : 'success')}>Continue</button>
      </div>
    );
    case 'mob_access': return (
      <div class="scr">
        {this.renderNotice('info', <span>Current registered mobile: <strong>{maskedMobile}</strong></span>)}
        <h3 class="sec-title">Do you have access to your current number?</h3>
        {this.renderRadio(this.accessOpt === 'yes', 'Yes, I can receive OTP', 'Verify via OTP on both numbers', () => this.accessOpt = 'yes')}
        {this.renderRadio(this.accessOpt === 'no', "No, I don't have access", 'Alternate verification required', () => this.accessOpt = 'no')}
        <button class="btn-primary" disabled={!this.accessOpt} onClick={() => this.go(this.accessOpt === 'yes' ? 'mob_new' : 'mob_no_access')}>Continue</button>
      </div>
    );
    case 'mob_new': return (
      <div class="scr">
        <h3 class="sec-title">Enter New Mobile Number</h3>
        <label class="field-label">Current Mobile</label><input class="field-input readonly" value={maskedMobile} readOnly />
        <label class="field-label">New Mobile Number *</label><input class="field-input" placeholder="Enter 10-digit number" maxLength={10} />
        <button class="btn-primary" onClick={() => this.go('mob_otp_old')}>Send OTP to Current Number</button>
      </div>
    );
    case 'mob_otp_old': return (
      <div class="scr tc">
        <p class="t2">Enter OTP sent to <strong>{maskedMobile}</strong></p>
        {this.renderOtp('mold')}
        <button class="btn-primary" disabled={!this.otpFilled('mold')} onClick={() => this.go('mob_otp_new')}>Verify &amp; Continue</button>
      </div>
    );
    case 'mob_otp_new': return (
      <div class="scr tc">
        <p class="t2">Enter OTP sent to <strong>new number</strong></p>
        {this.renderOtp('mnew')}
        <button class="btn-accent" disabled={!this.otpFilled('mnew')} onClick={() => this.completeKyc('Partial Update')}>Verify &amp; Update</button>
      </div>
    );
    case 'mob_no_access': return (
      <div class="scr">
        {this.renderNotice('warn', <span>Digital update is only available for <strong>postpaid connections</strong>.</span>)}
        <label class="field-label">New Mobile Number *</label><input class="field-input" placeholder="10-digit number" maxLength={10} />
        <h3 class="sec-title">Is your new number postpaid?</h3>
        {this.renderRadio(this.postpaidOpt === 'yes', "Yes, it's postpaid", 'Upload bill for verification', () => this.postpaidOpt = 'yes')}
        {this.renderRadio(this.postpaidOpt === 'no', 'No / Not sure', 'Branch visit required', () => this.postpaidOpt = 'no')}
        <button class="btn-primary" disabled={!this.postpaidOpt} onClick={() => this.go(this.postpaidOpt === 'yes' ? 'mob_postpaid' : 'branch')}>Continue</button>
      </div>
    );
    case 'mob_postpaid': return (
      <div class="scr">
        <h3 class="sec-title">Upload Postpaid Bill</h3>
        {this.renderNotice('info', <span>Upload a <strong>postpaid bill ≤ 3 months old</strong> showing your name and number.</span>)}
        {this.renderUpload('bill', 'Upload postpaid bill', 'Postpaid Mobile Bill')}
        <button class="btn-primary" onClick={() => this.go('mob_postpaid_otp')}>Verify via OTP</button>
      </div>
    );
    case 'mob_postpaid_otp': return (
      <div class="scr tc">
        <p class="t2">Enter OTP sent to <strong>new postpaid number</strong></p>
        {this.renderOtp('ppot')}
        <button class="btn-accent" disabled={!this.otpFilled('ppot')} onClick={() => this.completeKyc('Partial Update')}>Verify &amp; Update</button>
      </div>
    );
    case 'branch': return (
      <div class="scr tc">
        <div class="branch-icon">🏦</div>
        <h2 class="branch-title">Branch Visit Required</h2>
        <p class="t2">Your new number is not postpaid. Mobile update requires in-person verification.</p>
        <div class="branch-list">
          {['Original ID proof', 'New SIM with active connection', 'Visit nearest branch'].map(t =>
            <div class="branch-item">📋 {t}</div>
          )}
        </div>
        <button class="btn-primary" onClick={() => this.reset()}>Back to Home</button>
      </div>
    );

    // ── FLOW C: Full KYC ──
    case 'full_intro': return (
      <div class="scr">
        {this.renderNotice('info', <strong>Please complete all steps below to update your KYC.</strong>)}
        {this.renderOfferTeaser(false)}
        <h3 class="sec-title">Reason for Re-KYC</h3>
        <div class="hint" style={{ marginBottom: '8px' }}>Select all that apply.</div>
        {KYC_REASONS.map(r => this.renderChk(`r_${r.key}`, false, <div><div class="chk-label">{r.label}</div><div class="chk-sub">{r.sub}</div></div>))}
        <h3 class="sec-title">Steps to Complete</h3>
        <div class="step-list">
          {['PAN Verification', 'Aadhaar Validation', 'Document Upload', 'Video KYC'].map((s, i) =>
            <div class={{ 'step-item': true, active: i === 0 }}><div class="step-dot">{i + 1}</div><span>{s}</span></div>
          )}
        </div>
        <button class="btn-primary" onClick={() => this.go('full_pan')}>Begin Verification</button>
      </div>
    );

    case 'full_pan': return (
      <div class="scr">
        <h3 class="sec-title">Step 1: PAN Verification</h3>
        <label class="field-label">PAN Number *</label>
        <input class="field-input" placeholder="ABCPS1234K" maxLength={10} style={{ textTransform: 'uppercase' }} />
        <label class="field-label">Full Name (as on PAN) *</label>
        <input class="field-input" placeholder="Enter name exactly as on PAN" />
        <label class="field-label">Date of Birth (as per PAN) *</label>
        <input class="field-input" type="date" />
        <div class="hint">DOB must match exactly as printed on your PAN card</div>
        <button class="btn-primary" onClick={() => this.go('full_aadhaar')}>Verify PAN</button>
      </div>
    );

    case 'full_aadhaar': return (
      <div class="scr">
        <h3 class="sec-title">Step 2: Aadhaar Validation</h3>
        {this.renderNotice('info', 'Choose your preferred verification method.')}
        {this.renderRadio(this.aadhaarMethod === 'digilocker', 'DigiLocker Fetch (Recommended)', 'Instant paperless verification — no OTP needed', () => this.aadhaarMethod = 'digilocker')}
        {this.renderRadio(this.aadhaarMethod === 'otp', 'Aadhaar OTP (eKYC)', 'OTP sent to your Aadhaar-linked mobile', () => this.aadhaarMethod = 'otp')}
        {this.aadhaarMethod === 'otp' && (
          <div>
            <label class="field-label" style={{ marginTop: '12px' }}>Aadhaar Number *</label>
            <input class="field-input" placeholder="XXXX  XXXX  XXXX" maxLength={14} inputMode="numeric" />
            <div class="hint">Enter your 12-digit Aadhaar number</div>
          </div>
        )}
        <button class="btn-primary" style={{ marginTop: '12px' }} disabled={!this.aadhaarMethod}
          onClick={() => this.go(this.aadhaarMethod === 'digilocker' ? 'digilocker' : 'full_aadhaar_otp')}>
          {this.aadhaarMethod === 'digilocker' ? 'Open DigiLocker' : 'Send Aadhaar OTP'}
        </button>
      </div>
    );

    case 'digilocker': return (
      <div class="scr tc">
        <div class="digi-icon">🔐</div>
        <h2>DigiLocker</h2>
        <p class="t2">You will be redirected to DigiLocker to fetch your Aadhaar details securely.</p>
        <div class="digi-features">
          {['Instant Aadhaar fetch', 'No physical document needed', 'Govt. verified and tamper-proof', 'Data shared with your consent only'].map(t =>
            <div class="digi-item">✓ {t}</div>
          )}
        </div>
        <button class="btn-primary" onClick={() => this.go('full_doc')}>Continue to DigiLocker →</button>
        <div class="hint tc">Simulated — in production, opens DigiLocker SSO</div>
      </div>
    );

    case 'full_aadhaar_otp': return (
      <div class="scr tc">
        <h3 class="sec-title">Aadhaar OTP Verification</h3>
        <p class="t2">OTP sent to the mobile linked with your Aadhaar</p>
        {this.renderOtp('adho')}
        <button class="btn-primary" disabled={!this.otpFilled('adho')} onClick={() => this.go('full_doc')}>Verify Aadhaar</button>
        <button class="btn-text">Resend OTP</button>
      </div>
    );

    case 'full_doc': return (
      <div class="scr">
        <h3 class="sec-title">Step 3: Upload Identity Document</h3>
        {this.renderNotice('info', 'Upload a valid government-issued identity document.')}
        <label class="field-label">Document Type *</label>
        <select class="field-input"><option>Select</option><option>Passport</option><option>Driving Licence</option><option>Voter ID</option><option>Aadhaar Card</option></select>
        <label class="field-label">Document Number *</label><input class="field-input" placeholder="Enter document number" />
        <h3 class="sec-title">Front Side</h3>
        {this.renderUpload('docF', 'Upload front of document', 'ID Document (Front)')}
        <h3 class="sec-title" style={{ marginTop: '12px' }}>Back Side</h3>
        {this.renderUpload('docB', 'Upload back of document', 'ID Document (Back)')}
        <button class="btn-primary" onClick={() => this.go('full_vkyc')}>Continue to Video KYC</button>
      </div>
    );

    case 'full_vkyc': return (
      <div class="scr">
        <div class="vkyc-success-icon">✓</div>
        <h2 class="vkyc-done-title">Details Updated Successfully!</h2>
        <p class="t2 tc" style={{ marginBottom: '16px' }}>Your PAN, Aadhaar and documents have been verified. Complete Video KYC to finalise the process.</p>

        <div class="vkyc-link-card">
          <div class="vkyc-link-label">Your VKYC Session Link</div>
          <div class="vkyc-link-url">https://vkyc.nationalbank.co.in/s/KYC2026{c.acct.slice(-4)}</div>
          <button class="btn-accent" style={{ marginTop: '12px' }} onClick={() => this.go('full_vkyc_live')}>
            Start Video KYC Now
          </button>
        </div>

        <div class="vkyc-later-notice">
          <div class="vkyc-later-icon">📲</div>
          <div class="vkyc-later-text">
            <strong>Prefer to complete later?</strong><br/>
            This link has been sent to <strong>{maskedMobile}</strong> and your registered email. Valid for <strong>3 days</strong>.
          </div>
        </div>

        <div class="vkyc-steps-note">
          <div class="vkyc-step-row">✓ <span>PAN verified</span></div>
          <div class="vkyc-step-row">✓ <span>Aadhaar validated</span></div>
          <div class="vkyc-step-row">✓ <span>Documents uploaded</span></div>
          <div class="vkyc-step-row pending">◉ <span>Video KYC — Pending</span></div>
        </div>
      </div>
    );

    case 'full_vkyc_live': return (
      <div class="scr">
        <div class="vkyc-cam"><div class="face-oval" /><div class="vkyc-text">Position your face in frame</div></div>
        <div class="connecting"><span class="dot" /> Connecting to agent...</div>
        <button class="btn-accent" onClick={() => this.completeKyc('Full KYC')}>Complete VKYC (Demo)</button>
      </div>
    );

    // ── Fix 4: Success — reward on verification, not instant ──
    case 'success': return (
      <div class="scr tc">
        <div class="suc-icon">✓</div>
        <h2>KYC Submitted Successfully</h2>
        <p class="t2" style={{ marginBottom: '12px' }}>Thank you, <strong>{c.name.split(' ')[0]}</strong>. Your KYC submission is now under review.</p>
        {this.renderOfferTeaser(true)}
        <div class="data-card" style={{ textAlign: 'left', marginTop: '12px' }}>
          <div class="d-row"><span class="d-lbl">Status</span><span class="d-val" style={{ color: '#B8860B' }}>Under Review</span></div>
          <div class="d-row"><span class="d-lbl">Submitted On</span><span class="d-val">{new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
          <div class="d-row"><span class="d-lbl">Reference</span><span class="d-val">KYC-2026-{c.acct.slice(-4)}</span></div>
        </div>
        <div class="ref-card" style={{ background: 'var(--pri-bg)', marginTop: '12px' }}>
          <div class="ref-label">WHAT HAPPENS NEXT</div>
          <div style={{ fontSize: '12.5px', color: 'var(--t2)', lineHeight: '1.6' }}>
            Your KYC details will be verified by the bank within <strong>2–3 working days</strong>. You will receive a confirmation SMS and email once approved. Your reward will be credited upon successful verification.
          </div>
        </div>
        <button class="btn-primary" style={{ marginTop: '16px' }} onClick={() => this.reset()}>Back to Home</button>
      </div>
    );

    default: return <div>Unknown screen</div>;
    }
  }
}
