import { Component, h, State, Prop } from '@stencil/core';
import { Customer, fetchCustomer, updateCustomer, uploadDocument, CONSENT_ITEMS, KYC_REASONS, fileUrl, sendOtp, verifyOtp, saveFcmToken, FIREBASE_CONFIG, firebaseConfigured } from '../../utils/constants';

type Screen = 'whatsapp'|'browser'|'auth_otp'|'consent'|'landing'|'confirm'
  |'minor_choice'|'addr'|'mob_access'|'mob_new'|'mob_otp_old'|'mob_otp_new'
  |'mob_no_access'|'mob_postpaid'|'mob_postpaid_otp'|'branch'
  |'full_intro'|'full_pan'|'full_pan_result'|'full_aadhaar'|'full_aadhaar_otp'|'digilocker'
  |'full_doc'|'full_vkyc'|'full_vkyc_live'|'resubmit'|'success';

// ── Aadhaar Verhoeff checksum ──
const MULT = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const PERM = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
function verhoeff(n: string): boolean {
  let c = 0;
  const rev = n.replace(/\s/g,'').split('').reverse();
  for (let i = 0; i < rev.length; i++) c = MULT[c][PERM[i%8][+rev[i]]];
  return c === 0;
}

// ── PAN format ──
function validPan(p: string): boolean { return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p.toUpperCase()); }

// ── Generate PDF acknowledgement ──
function downloadAck(custId: string, custName: string, kycType: string) {
  const ref = `KYC-2026-${custId.slice(-4)}`;
  const date = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>KYC Acknowledgement</title>
  <style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}h1{color:#074994;font-size:22px}
  .ref{background:#f0f4f8;border-left:4px solid #074994;padding:12px 16px;margin:20px 0;border-radius:0 8px 8px 0}
  table{width:100%;border-collapse:collapse;margin:20px 0}td{padding:8px 12px;border-bottom:1px solid #eee}
  td:first-child{color:#666;width:180px}.footer{margin-top:40px;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:16px}
  .stamp{border:2px solid #074994;display:inline-block;padding:8px 20px;color:#074994;font-size:14px;font-weight:bold;border-radius:4px;transform:rotate(-2deg);margin:20px 0}
  </style></head><body>
  <h1>National Bank Ltd.</h1>
  <p style="color:#666;margin-top:4px">KYC Update — Acknowledgement Receipt</p>
  <div class="ref"><strong>Reference: ${ref}</strong><br><span style="font-size:13px;color:#555">Keep this for your records</span></div>
  <table>
  <tr><td>Customer Name</td><td><strong>${custName}</strong></td></tr>
  <tr><td>Customer ID</td><td>${custId}</td></tr>
  <tr><td>KYC Type</td><td>${kycType}</td></tr>
  <tr><td>Submission Date</td><td>${date}</td></tr>
  <tr><td>Status</td><td><strong style="color:#B8860B">Under Review</strong></td></tr>
  <tr><td>Expected TAT</td><td>2–3 working days</td></tr>
  </table>
  <div class="stamp">SUBMITTED</div>
  <p>Your KYC details have been received and are under review. You will be notified via SMS and email once the verification is complete.</p>
  <div class="footer">National Bank Ltd. | KYC Operations | This is a system-generated acknowledgement. No signature required.</div>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `KYC-Acknowledgement-${ref}.html`;
  a.click();
}

@Component({ tag: 'rekyc-customer', styleUrl: 'rekyc-customer.css', shadow: false })
export class RekycCustomer {
  @Prop() customerId: string = 'KYC-4528';

  @State() screen: Screen = 'whatsapp';
  @State() hist: Screen[] = ['whatsapp'];
  @State() cust: Customer | null = null;
  @State() consents: Record<string, boolean> = {};
  @State() otpVals: Record<string, string[]> = {};
  @State() sigText = '';
  @State() mobileEntry = '';
  @State() mobileError = '';
  @State() otpAttempts: Record<string, number> = {};
  @State() otpError = '';
  @State() otpLocked = false;
  @State() resendCooldown = 0;
  @State() sessionExpiry = 0;
  @State() sessionWarning = false;
  @State() minorOpt: string | null = null;
  @State() accessOpt: string | null = null;
  @State() postpaidOpt: string | null = null;
  @State() aadhaarMethod: string | null = null;
  @State() aadhaarNum = '';
  @State() aadhaarError = '';
  @State() panNum = '';
  @State() panName = '';
  @State() panDob = '';
  @State() panError = '';
  @State() panVerified = false;
  @State() uploading = false;
  @State() uploadedDocs: Record<string, { name: string; fileName: string; preview?: string }> = {};
  @State() resubmitDocId = '';
  @State() resubmitReason = '';
  @State() otpSending = false;
  @State() otpDemoMode = true;
  @State() pushToast: { msg: string; type: string } | null = null;

  private sessionTimer: any;
  private cooldownTimer: any;

  async componentWillLoad() {
    try { this.cust = await fetchCustomer(this.customerId); }
    catch (e) { console.error('Failed to load customer:', e); }
  }
  disconnectedCallback() {
    clearInterval(this.sessionTimer);
    clearInterval(this.cooldownTimer);
  }

  go(s: Screen) { this.hist = [...this.hist, s]; this.screen = s; }
  back() { if (this.hist.length > 1) { const h = this.hist.slice(0,-1); this.hist = h; this.screen = h[h.length-1]; } }
  reset() {
    clearInterval(this.sessionTimer);
    this.screen = 'whatsapp'; this.hist = ['whatsapp'];
    this.consents = {}; this.otpVals = {}; this.sigText = '';
    this.mobileEntry = ''; this.mobileError = ''; this.otpError = '';
    this.otpAttempts = {}; this.otpLocked = false; this.resendCooldown = 0;
    this.panNum = ''; this.panName = ''; this.panDob = ''; this.panError = ''; this.panVerified = false;
    this.aadhaarNum = ''; this.aadhaarError = ''; this.aadhaarMethod = null;
    this.uploadedDocs = {}; this.sessionExpiry = 0;
  }

  startSession() {
    clearInterval(this.sessionTimer);
    this.sessionExpiry = Date.now() + 15 * 60 * 1000;
    this.sessionWarning = false;
    this.sessionTimer = setInterval(() => {
      const remaining = this.sessionExpiry - Date.now();
      if (remaining <= 0) { clearInterval(this.sessionTimer); this.reset(); }
      else if (remaining <= 2 * 60 * 1000) { this.sessionWarning = true; }
    }, 5000);
    // Register for push notifications after session starts
    this.registerPush();
  }

  // ── Firebase Push Registration ──
  async registerPush() {
    if (!firebaseConfigured()) return;
    try {
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js' as any);
      const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js' as any);
      const apps = getApps();
      const app = apps.length ? apps[0] : initializeApp(FIREBASE_CONFIG);
      const messaging = getMessaging(app);
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const vapidKey = (window as any).__FIREBASE_VAPID_KEY__;
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
      if (token && this.cust) {
        await saveFcmToken(this.cust.id, token);
        console.log('FCM token registered');
      }
      // In-app notification when portal is open
      onMessage(messaging, (payload: any) => {
        this.showToast(payload.notification?.title + ': ' + payload.notification?.body, 'info');
        // If rejection — reload customer data to show rejection card
        if (payload.data?.action === 'rejected') {
          fetchCustomer(this.cust!.id).then(c => { this.cust = c; });
        }
      });
    } catch(e) {
      console.log('Push registration skipped:', (e as any).message);
    }
  }

  showToast(msg: string, type: 'ok'|'err'|'info' = 'ok') {
    this.pushToast = { msg, type };
    setTimeout(() => { this.pushToast = null; }, 5000);
  }

  startResendCooldown() {
    this.resendCooldown = 30;
    clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      if (this.resendCooldown > 0) this.resendCooldown = this.resendCooldown - 1;
      else clearInterval(this.cooldownTimer);
    }, 1000);
  }

  // ── Mobile validation ──
  validateMobile(): boolean {
    const c = this.cust!;
    const actual = c.mobile.replace(/\D/g, '').slice(-4);
    if (this.mobileEntry !== actual) {
      this.mobileError = 'The digits you entered do not match our records. Please check and try again.';
      return false;
    }
    this.mobileError = '';
    return true;
  }

  // ── Send OTP via API (real Twilio if configured, demo mode otherwise) ──
  async triggerOtp(onSent: () => void) {
    const c = this.cust!;
    this.otpError = '';
    this.otpSending = true;
    try {
      const result = await sendOtp(c.mobile);
      if (result.ok) {
        this.otpDemoMode = !!result.hint;
        this.startResendCooldown();
        onSent();
      } else {
        this.otpError = result.error || 'Failed to send OTP. Please try again.';
      }
    } catch(e) {
      this.otpError = 'Network error. Please check your connection.';
    } finally {
      this.otpSending = false;
    }
  }

  // ── Verify OTP via API ──
  async verifyOtpCode(prefix: string, mobile: string, onSuccess: () => void) {
    const entered = (this.otpVals[prefix] || []).join('');
    this.otpError = '';
    try {
      const result = await verifyOtp(mobile, entered);
      if (result.ok) {
        this.otpLocked = false;
        this.otpError = '';
        onSuccess();
      } else if (result.locked) {
        this.otpLocked = true;
        this.otpError = result.error || 'Session locked.';
      } else if (result.expired) {
        this.otpError = result.error || 'OTP expired. Please request a new one.';
        this.otpVals = { ...this.otpVals, [prefix]: Array(6).fill('') };
      } else {
        this.otpError = result.error || 'Incorrect OTP.';
      }
    } catch(e) {
      this.otpError = 'Network error. Please try again.';
    }
  }

  // ── PAN verification (simulated NSDL match) ──
  verifyPan() {
    if (!validPan(this.panNum)) { this.panError = 'Invalid PAN format. Must be 10 characters: AAAAA9999A.'; return; }
    if (!this.panName.trim()) { this.panError = 'Please enter your full name as on PAN.'; return; }
    if (!this.panDob) { this.panError = 'Please enter your date of birth.'; return; }
    // Simulated NSDL check: name must match (case-insensitive, first word)
    const c = this.cust!;
    const apiName = c.name.split(' ')[0].toLowerCase();
    const entered = this.panName.split(' ')[0].toLowerCase();
    if (!entered.includes(apiName) && !apiName.includes(entered)) {
      this.panError = 'Name does not match PAN records. Please enter your name exactly as on the card.';
      return;
    }
    this.panError = '';
    this.panVerified = true;
    this.go('full_pan_result');
  }

  // ── Aadhaar validation ──
  validateAadhaar(): boolean {
    const clean = this.aadhaarNum.replace(/\s/g, '');
    if (clean.length !== 12) { this.aadhaarError = 'Aadhaar number must be 12 digits.'; return false; }
    if (!verhoeff(clean)) { this.aadhaarError = 'Invalid Aadhaar number. Please check and re-enter.'; return false; }
    this.aadhaarError = '';
    return true;
  }

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
      // Generate preview for images
      let preview: string | undefined;
      if (file.type.startsWith('image/')) {
        preview = await new Promise<string>(res => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.readAsDataURL(file);
        });
      }
      await uploadDocument(this.customerId, file, docName);
      this.uploadedDocs = { ...this.uploadedDocs, [slot]: { name: docName, fileName: file.name, preview } };
    } finally { this.uploading = false; }
  }

  async completeKyc(kycType: string) {
    clearInterval(this.sessionTimer);
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const newStatus = kycType === 'Full KYC' ? 'Pending VKYC' : 'Completed';
    await updateCustomer(this.customerId, {
      status: newStatus, kycType, source: 'Digital', completedDate: today, linkActive: false,
      reminders: [...(this.cust?.reminders || []), { ch: 'System', date: today, status: 'KYC submitted via digital portal' }],
    } as any);
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
            disabled={this.otpLocked}
            class={{ 'otp-box': true, filled: !!v, 'otp-error': !!this.otpError }}
            onInput={(e: any) => { this.otpError = ''; this.handleOtp(prefix, i, e.target.value); }}
            onKeyDown={(e: any) => { if (e.key === 'Backspace' && !v && i > 0) (document.getElementById(`${prefix}-${i-1}`) as HTMLInputElement)?.focus(); }} />
        ))}
      </div>
    );
  }

  renderOtpFooter(prefix: string, displayMobile: string, actualMobile?: string) {
    return (
      <div>
        {this.otpError && <div class="field-error">{this.otpError}</div>}
        <div class="otp-footer">
          <span class="hint">OTP sent to {displayMobile}</span>
          {this.resendCooldown > 0
            ? <span class="resend-timer">Resend in {this.resendCooldown}s</span>
            : <button class="btn-text" onClick={async () => {
            this.otpVals = { ...this.otpVals, [prefix]: Array(6).fill('') };
            this.otpError = ''; this.otpLocked = false;
            if (actualMobile) { await this.triggerOtp(() => {}); } else { this.startResendCooldown(); }
          }}>Resend OTP</button>
          }
        </div>
        {this.otpDemoMode && <div class="hint tc" style={{ color: 'var(--acc)', fontSize: '11.5px' }}>Demo mode — use 123456</div>}
      </div>
    );
  }

  renderUpload(slot: string, label: string, docName: string) {
    const done = !!this.uploadedDocs[slot];
    const doc = this.uploadedDocs[slot];
    return (
      <label class={{ 'upload-zone': true, done }}>
        <input type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }}
          onChange={(e: any) => { const f = e.target.files[0]; if (f) this.doUpload(slot, docName, f); }} />
        {done && doc?.preview
          ? <img src={doc.preview} alt="Preview" class="upload-preview" />
          : <div class="up-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
        }
        {done
          ? [<div class="up-name">✓ {doc!.fileName}</div>, <div class="up-hint">{doc?.preview ? 'Image preview shown' : 'PDF uploaded'} • Tap to replace</div>]
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
               <div class="offer-sub">A pre-approved offer &amp; shopping voucher awaits!</div>]}
        </div>
      </div>
    );
  }

  renderSessionWarning() {
    if (!this.sessionWarning) return null;
    return (
      <div class="session-warn">
        ⏱ Session expiring in 2 minutes.
        <button class="btn-text" style={{ marginLeft: '8px', color: 'var(--warn)' }} onClick={() => this.startSession()}>Extend</button>
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
    full_pan: ['PAN Verification', 'Step 1/4'],
    full_pan_result: ['PAN Verified', 'Step 1/4 complete'],
    full_aadhaar: ['Aadhaar', 'Step 2/4'],
    full_aadhaar_otp: ['Aadhaar OTP', 'Step 2/4'],
    digilocker: ['DigiLocker', 'Aadhaar fetch'],
    full_doc: ['Documents', 'Step 3/4'],
    full_vkyc: ['Video KYC', 'Step 4/4'],
    full_vkyc_live: ['VKYC Live', 'In progress'],
    resubmit: ['Re-upload Document', 'Action required'],
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
          {this.renderSessionWarning()}
          {this.pushToast && (
            <div class={`push-toast ${this.pushToast.type}`}>
              {this.pushToast.msg}
              <button onClick={() => { this.pushToast = null; }} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: '700' }}>✕</button>
            </div>
          )}
          <div class="body">{this.renderScreen()}</div>
          {this.uploading && <div class="upload-overlay"><div class="upload-spinner" />Uploading...</div>}
        </div>
      </div>
    );
  }

  renderScreen() {
    const c = this.cust!;
    const last4 = c.mobile.replace(/\D/g, '').slice(-4);
    const maskedMobile = `+91 XXXXX X${last4}`;

    // ── Compute expiry status for documents ──
    const today = new Date();
    const docsWithExpiry = c.docsOnFile.map(d => {
      const expMatch = d.meta.match(/Exp:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
      let daysLeft: number | null = null;
      if (expMatch) {
        const expDate = new Date(expMatch[1]);
        daysLeft = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
      return { ...d, daysLeft };
    });

    switch (this.screen) {

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

    case 'browser': return (
      <div class="scr">
        <div class="browser-bar"><span class="lock">🔒</span> <code><strong>https://</strong>nationalbank.co.in/rekyc</code></div>
        <div class="bank-row"><div class="bank-logo">NB</div><div><strong>National Bank Ltd.</strong><br/><span class="t2">Secure Re-KYC Portal</span></div></div>
        {this.renderOfferTeaser(false)}
        <label class="field-label">Registered Mobile (last 4 digits) *</label>
        <input class={{ 'field-input': true, 'field-err': !!this.mobileError }}
          type="text" inputMode="numeric" maxLength={4} placeholder="e.g. 3210"
          value={this.mobileEntry}
          onInput={(e: any) => { this.mobileEntry = e.target.value.replace(/\D/g,'').slice(0,4); this.mobileError = ''; }} />
        {this.mobileError
          ? <div class="field-error">{this.mobileError}</div>
          : <div class="hint">Enter the last 4 digits of your registered mobile number</div>}
        <button class="btn-primary" disabled={this.mobileEntry.length !== 4 || this.otpSending}
          onClick={() => {
            if (!this.validateMobile()) return;
            this.triggerOtp(() => this.go('auth_otp'));
          }}>
          {this.otpSending ? 'Sending OTP...' : 'Verify & Proceed'}
        </button>
      </div>
    );

    case 'auth_otp': return (
      <div class="scr tc">
        <p class="t2">OTP sent to <strong>{maskedMobile}</strong></p>
        {this.otpLocked
          ? <div class="lockout-card">🔒 Session locked — too many incorrect attempts.<br/>Please restart.</div>
          : this.renderOtp('auth')
        }
        {!this.otpLocked && this.renderOtpFooter('auth', maskedMobile, c.mobile)}
        <button class="btn-primary" disabled={!this.otpFilled('auth') || this.otpLocked}
          onClick={() => this.verifyOtpCode('auth', c.mobile, () => { this.startSession(); this.go('consent'); })}>
          Authenticate
        </button>
        {this.otpLocked && <button class="btn-text" onClick={() => this.reset()}>Start Over</button>}
      </div>
    );

    case 'consent': return (
      <div class="scr">
        <div class="bank-row"><div class="bank-logo">NB</div><div><strong>National Bank Ltd.</strong><br/><span class="t2">Re-KYC Consent</span></div></div>
        {this.renderNotice('info', <span>Before we proceed, please read and accept the declarations below. This is required to update your KYC records.</span>)}
        <div class="select-all-row" onClick={() => this.toggleAll()}>
          <div class={{ 'chk-box': true, checked: this.allConsented() }}>
            {this.allConsented() && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
          <span class="select-all-label">Accept All</span>
        </div>
        {CONSENT_ITEMS.map((txt, i) => this.renderChk(`c${i}`, false,
          <span>{i === 0 ? <span>I, <strong>{c.name}</strong>, {txt.slice(2)}</span> : txt}</span>
        ))}
        <button class="btn-accent" style={{ marginTop: '16px' }} disabled={!this.allConsented()} onClick={() => this.go('landing')}>
          Proceed to KYC Update
        </button>
        <p class="hint tc" style={{ marginTop: '8px' }}>By proceeding, you authorise National Bank to access and update your KYC records.</p>
      </div>
    );

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

        <h3 class="sec-title">Contact &amp; Address</h3>
        <div class="data-card">
          <div class="d-row"><span class="d-lbl">Mobile</span><span class="d-val">{maskedMobile}</span></div>
          <div class="d-row"><span class="d-lbl">Email</span><span class="d-val">{c.email}</span></div>
          <div class="d-row"><span class="d-lbl">Address</span><span class="d-val" style={{ fontSize: '12px' }}>{c.address}</span></div>
        </div>

        <h3 class="sec-title">KYC Details on Record</h3>
        {docsWithExpiry.map(d => {
          const expired = !d.valid;
          const expiringSoon = d.daysLeft !== null && d.daysLeft >= 0 && d.daysLeft <= 90;
          const metaClean = d.meta.replace(/\s*•?\s*No expiry/gi,'').trim();
          return (
            <div class={{ 'doc-row': true, 'doc-row-expired': expired, 'doc-row-warn': !expired && expiringSoon }}>
              <div class="doc-icon">📄</div>
              <div class="doc-info">
                <div class={{ 'doc-name': true, 'doc-name-expired': expired }}>{d.name}</div>
                {metaClean && <div class="doc-meta">{metaClean}</div>}
                {d.daysLeft !== null && d.daysLeft >= 0 && !expired &&
                  <div class={{ 'doc-expiry-chip': true, 'expiring-soon': expiringSoon }}>
                    Expires in {d.daysLeft} day{d.daysLeft === 1 ? '' : 's'}
                  </div>
                }
              </div>
              {expired && <span class="badge red">Expired</span>}
              {expiringSoon && !expired && <span class="badge amber">Expiring</span>}
            </div>
          );
        })}

        {/* Pending rejection re-submission */}
        {c.documents.filter(d => d.status === 'rejected').length > 0 && (
          <div>
            {this.renderNotice('warn', <span><strong>Action required:</strong> {c.documents.filter(d => d.status === 'rejected').length} document(s) were rejected by the bank. Please re-upload.</span>)}
            {c.documents.filter(d => d.status === 'rejected').map(d => (
              <div class="rejection-card" onClick={() => { this.resubmitDocId = d.id; this.resubmitReason = d.rejectReason || ''; this.go('resubmit'); }}>
                <div class="rej-icon">✗</div>
                <div class="rej-body">
                  <div class="rej-title">{d.name}</div>
                  <div class="rej-reason">{d.rejectReason || 'Rejected by bank officer'}</div>
                </div>
                <div class="rej-arrow">Re-upload ›</div>
              </div>
            ))}
          </div>
        )}

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

    case 'confirm': return (
      <div class="scr">
        {this.renderNotice('ok', 'You are confirming that all KYC details on record are correct and up-to-date.')}
        {this.renderOfferTeaser(false)}
        <h3 class="sec-title">Digital Signature</h3>
        <p class="t2" style={{ marginBottom: '10px' }}>Type your full name below as your digital signature.</p>
        <label class="field-label">Full Name *</label>
        <input class="field-input" type="text" placeholder={`Enter: ${c.name}`} value={this.sigText} onInput={(e:any) => this.sigText = e.target.value} />
        <div class="hint">Must match your registered name exactly</div>
        <button class="btn-accent" style={{ marginTop: '16px' }} disabled={this.sigText.trim().length < 4}
          onClick={() => this.completeKyc('Self-Declaration')}>
          ✓ Submit Self-Declaration
        </button>
      </div>
    );

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
        {this.renderNotice('info', <span>Current address: <em style={{ color: 'var(--t2)', fontSize: '12px' }}>{c.address}</em></span>)}
        <label class="field-label">Address Line 1 *</label><input class="field-input" placeholder="Flat/House, Building" />
        <label class="field-label">Address Line 2</label><input class="field-input" placeholder="Street, Locality" />
        <div class="row-2">
          <div><label class="field-label">City *</label><input class="field-input" placeholder="City"/></div>
          <div><label class="field-label">PIN *</label><input class="field-input" placeholder="400001" maxLength={6}/></div>
        </div>
        <label class="field-label">State *</label>
        <select class="field-input"><option>Select State</option><option>Maharashtra</option><option>Delhi</option><option>Karnataka</option><option>Tamil Nadu</option><option>Gujarat</option><option>West Bengal</option><option>Telangana</option><option>Rajasthan</option></select>
        <h3 class="sec-title">Upload Address Proof</h3>
        {this.renderUpload('addr', 'Upload address proof', 'Address Proof')}
        <button class="btn-primary" disabled={!this.uploadedDocs['addr']} onClick={() => this.go(this.minorOpt === 'both' ? 'mob_access' : 'success')}>Continue</button>
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
        <label class="field-label">New Mobile Number *</label><input class="field-input" placeholder="Enter 10-digit number" maxLength={10} type="tel" />
        <button class="btn-primary" onClick={() => { this.startResendCooldown(); this.go('mob_otp_old'); }}>Send OTP to Current Number</button>
      </div>
    );

    case 'mob_otp_old': return (
      <div class="scr tc">
        <p class="t2">Enter OTP sent to <strong>{maskedMobile}</strong></p>
        {this.renderOtp('mold')}
        {this.renderOtpFooter('mold', maskedMobile, c.mobile)}
        <button class="btn-primary" disabled={!this.otpFilled('mold') || this.otpLocked}
          onClick={() => this.verifyOtpCode('mold', c.mobile, () => { this.startResendCooldown(); this.go('mob_otp_new'); })}>
          Verify &amp; Continue
        </button>
      </div>
    );

    case 'mob_otp_new': return (
      <div class="scr tc">
        <p class="t2">Enter OTP sent to <strong>new number</strong></p>
        {this.renderOtp('mnew')}
        {this.renderOtpFooter('mnew', 'new number', c.mobile)}
        <button class="btn-accent" disabled={!this.otpFilled('mnew') || this.otpLocked}
          onClick={() => this.verifyOtpCode('mnew', c.mobile, () => this.completeKyc('Partial Update'))}>
          Verify &amp; Update
        </button>
      </div>
    );

    case 'mob_no_access': return (
      <div class="scr">
        {this.renderNotice('warn', <span>Digital update is only available for <strong>postpaid connections</strong>.</span>)}
        <label class="field-label">New Mobile Number *</label><input class="field-input" placeholder="10-digit number" maxLength={10} type="tel" />
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
        <button class="btn-primary" disabled={!this.uploadedDocs['bill']} onClick={() => { this.startResendCooldown(); this.go('mob_postpaid_otp'); }}>Verify via OTP</button>
      </div>
    );

    case 'mob_postpaid_otp': return (
      <div class="scr tc">
        <p class="t2">Enter OTP sent to <strong>new postpaid number</strong></p>
        {this.renderOtp('ppot')}
        {this.renderOtpFooter('ppot', 'new postpaid number', c.mobile)}
        <button class="btn-accent" disabled={!this.otpFilled('ppot') || this.otpLocked}
          onClick={() => this.verifyOtpCode('ppot', c.mobile, () => this.completeKyc('Partial Update'))}>
          Verify &amp; Update
        </button>
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
        {this.renderNotice('info', <span>Enter your PAN details exactly as they appear on your PAN card.</span>)}
        <label class="field-label">PAN Number *</label>
        <input class={{ 'field-input': true, 'field-err': !!this.panError && !validPan(this.panNum) }}
          placeholder="ABCPS1234K" maxLength={10}
          value={this.panNum}
          onInput={(e: any) => { this.panNum = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''); this.panError = ''; }}
          style={{ textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' }} />
        {this.panNum.length > 0 && this.panNum.length < 10 && <div class="hint">PAN format: AAAAA9999A ({this.panNum.length}/10)</div>}
        {this.panNum.length === 10 && validPan(this.panNum) && <div class="hint" style={{ color: 'var(--acc)' }}>✓ Valid format</div>}

        <label class="field-label">Full Name (as on PAN) *</label>
        <input class="field-input" placeholder="Enter name exactly as on PAN card"
          value={this.panName} onInput={(e: any) => { this.panName = e.target.value; this.panError = ''; }} />

        <label class="field-label">Date of Birth (as per PAN) *</label>
        <input class="field-input" type="date"
          value={this.panDob} onInput={(e: any) => { this.panDob = e.target.value; this.panError = ''; }} />
        <div class="hint">DOB must match exactly as printed on your PAN card</div>

        {this.panError && <div class="field-error">{this.panError}</div>}

        <button class="btn-primary" style={{ marginTop: '8px' }}
          disabled={!validPan(this.panNum) || !this.panName.trim() || !this.panDob}
          onClick={() => this.verifyPan()}>
          Verify PAN
        </button>
      </div>
    );

    case 'full_pan_result': return (
      <div class="scr">
        <div class="verify-result ok">
          <div class="vr-icon">✓</div>
          <div class="vr-body">
            <div class="vr-title">PAN Verified Successfully</div>
            <div class="vr-sub">Details matched with NSDL records</div>
          </div>
        </div>
        <div class="data-card" style={{ marginTop: '12px' }}>
          <div class="d-row"><span class="d-lbl">PAN</span><span class="d-val" style={{ letterSpacing: '2px', fontFamily: 'monospace' }}>{this.panNum}</span></div>
          <div class="d-row"><span class="d-lbl">Name</span><span class="d-val">{this.panName}</span></div>
          <div class="d-row"><span class="d-lbl">DOB</span><span class="d-val">{this.panDob}</span></div>
          <div class="d-row"><span class="d-lbl">Status</span><span class="d-val" style={{ color: 'var(--acc)' }}>Active — Individual</span></div>
        </div>
        {this.renderNotice('ok', 'Your PAN details have been verified. Proceed to Aadhaar validation.')}
        <button class="btn-primary" onClick={() => this.go('full_aadhaar')}>Continue to Aadhaar</button>
      </div>
    );

    case 'full_aadhaar': return (
      <div class="scr">
        <h3 class="sec-title">Step 2: Aadhaar Validation</h3>
        {this.renderNotice('info', 'Choose your preferred verification method.')}
        {this.renderRadio(this.aadhaarMethod === 'digilocker', 'DigiLocker Fetch (Recommended)', 'Instant paperless — no OTP needed', () => this.aadhaarMethod = 'digilocker')}
        {this.renderRadio(this.aadhaarMethod === 'otp', 'Aadhaar OTP (eKYC)', 'OTP sent to Aadhaar-linked mobile', () => this.aadhaarMethod = 'otp')}
        {this.aadhaarMethod === 'otp' && (
          <div>
            <label class="field-label" style={{ marginTop: '12px' }}>Aadhaar Number *</label>
            <input class={{ 'field-input': true, 'field-err': !!this.aadhaarError }}
              placeholder="XXXX  XXXX  XXXX" maxLength={14} inputMode="numeric"
              value={this.aadhaarNum}
              onInput={(e: any) => {
                const raw = e.target.value.replace(/\D/g,'').slice(0,12);
                this.aadhaarNum = raw.replace(/(\d{4})(\d{0,4})(\d{0,4})/,'$1 $2 $3').trim();
                this.aadhaarError = '';
              }} />
            {this.aadhaarError && <div class="field-error">{this.aadhaarError}</div>}
            {!this.aadhaarError && this.aadhaarNum.replace(/\s/g,'').length === 12 &&
              <div class="hint" style={{ color: 'var(--acc)' }}>✓ Valid Aadhaar number</div>}
          </div>
        )}
        <button class="btn-primary" style={{ marginTop: '12px' }} disabled={!this.aadhaarMethod}
          onClick={() => {
            if (this.aadhaarMethod === 'otp') {
              if (!this.validateAadhaar()) return;
              this.startResendCooldown();
              this.go('full_aadhaar_otp');
            } else {
              this.go('digilocker');
            }
          }}>
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
        <div class="hint tc" style={{ marginTop: '8px' }}>Simulated — in production, opens DigiLocker OAuth</div>
      </div>
    );

    case 'full_aadhaar_otp': return (
      <div class="scr tc">
        <h3 class="sec-title">Aadhaar OTP Verification</h3>
        <p class="t2">OTP sent to the mobile linked with Aadhaar <strong>{this.aadhaarNum}</strong></p>
        {this.renderOtp('adho')}
        {this.renderOtpFooter('adho', 'Aadhaar-linked mobile', c.mobile)}
        <button class="btn-primary" disabled={!this.otpFilled('adho') || this.otpLocked}
          onClick={() => this.verifyOtpCode('adho', c.mobile, () => this.go('full_doc'))}>
          Verify Aadhaar
        </button>
      </div>
    );

    case 'full_doc': return (
      <div class="scr">
        <h3 class="sec-title">Step 3: Upload Identity Document</h3>
        {this.renderNotice('info', 'Upload a valid government-issued identity document.')}
        <label class="field-label">Document Type *</label>
        <select class="field-input"><option value="">Select</option><option>Passport</option><option>Driving Licence</option><option>Voter ID</option><option>Aadhaar Card</option></select>
        <label class="field-label">Document Number *</label>
        <input class="field-input" placeholder="Enter document number" />
        <h3 class="sec-title">Front Side</h3>
        {this.renderUpload('docF', 'Tap to upload front of document', 'ID Document (Front)')}
        <h3 class="sec-title" style={{ marginTop: '12px' }}>Back Side</h3>
        {this.renderUpload('docB', 'Tap to upload back of document', 'ID Document (Back)')}
        <button class="btn-primary"
          disabled={!this.uploadedDocs['docF'] || !this.uploadedDocs['docB']}
          onClick={() => this.go('full_vkyc')}>Continue to Video KYC</button>
      </div>
    );

    case 'full_vkyc': return (
      <div class="scr">
        <div class="vkyc-success-icon">✓</div>
        <h2 class="vkyc-done-title">Details Updated Successfully!</h2>
        <p class="t2 tc" style={{ marginBottom: '16px' }}>PAN, Aadhaar and documents verified. Complete Video KYC to finalise.</p>
        <div class="vkyc-link-card">
          <div class="vkyc-link-label">Your VKYC Session Link</div>
          <div class="vkyc-link-url">https://vkyc.nationalbank.co.in/s/KYC2026{c.acct.slice(-4)}</div>
          <button class="btn-accent" style={{ marginTop: '12px' }} onClick={() => this.go('full_vkyc_live')}>Start Video KYC Now</button>
        </div>
        <div class="vkyc-later-notice">
          <div class="vkyc-later-icon">📲</div>
          <div class="vkyc-later-text">
            <strong>Prefer to complete later?</strong><br/>
            Link sent to <strong>{maskedMobile}</strong> and your email. Valid for <strong>3 days</strong>.
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

    case 'resubmit': return (
      <div class="scr">
        {this.renderNotice('warn', <span><strong>Document rejected.</strong> Please upload a new, valid copy to proceed.</span>)}
        <div class="rejection-detail">
          <div class="rd-label">Rejection reason</div>
          <div class="rd-reason">{this.resubmitReason || 'Document could not be verified. Please upload a clearer copy.'}</div>
        </div>
        <h3 class="sec-title">Upload Replacement Document</h3>
        {this.renderUpload('resub', 'Upload replacement document', 'Replacement Document')}
        <div class="hint">Ensure the document is clearly legible, unobstructed, and within expiry date.</div>
        <button class="btn-primary" disabled={!this.uploadedDocs['resub']}
          onClick={() => this.completeKyc('Self-Declaration')}>
          Submit Replacement
        </button>
      </div>
    );

    case 'success': return (
      <div class="scr tc">
        <div class="suc-icon">✓</div>
        <h2>KYC Submitted Successfully</h2>
        <p class="t2" style={{ marginBottom: '12px' }}>Thank you, <strong>{c.name.split(' ')[0]}</strong>. Your submission is under review.</p>
        {this.renderOfferTeaser(true)}
        <div class="data-card" style={{ textAlign: 'left', marginTop: '12px' }}>
          <div class="d-row"><span class="d-lbl">Status</span><span class="d-val" style={{ color: '#B8860B' }}>Under Review</span></div>
          <div class="d-row"><span class="d-lbl">Submitted On</span><span class="d-val">{new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
          <div class="d-row"><span class="d-lbl">Reference</span><span class="d-val" style={{ fontFamily: 'monospace', fontWeight: '700' }}>KYC-2026-{c.acct.slice(-4)}</span></div>
          <div class="d-row"><span class="d-lbl">Expected TAT</span><span class="d-val">2–3 working days</span></div>
        </div>
        <div class="ref-card" style={{ background: 'var(--pri-bg)', marginTop: '12px', textAlign: 'left' }}>
          <div class="ref-label">WHAT HAPPENS NEXT</div>
          <div style={{ fontSize: '12.5px', color: 'var(--t2)', lineHeight: '1.6' }}>
            Your details will be verified by the bank within 2–3 working days. You will receive a confirmation SMS and email once approved. Your reward will be credited upon successful verification.
          </div>
        </div>
        <button class="btn-accent" style={{ marginTop: '16px' }} onClick={() => downloadAck(c.id, c.name, c.kycType || 'KYC Update')}>
          ⬇ Download Acknowledgement
        </button>
        <button class="btn-primary" style={{ marginTop: '10px' }} onClick={() => this.reset()}>Back to Home</button>
      </div>
    );

    default: return <div>Unknown screen</div>;
    }
  }
}
