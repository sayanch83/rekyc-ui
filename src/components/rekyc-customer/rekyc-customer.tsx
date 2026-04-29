import { Component, h, State, Prop } from '@stencil/core';
import { Customer, fetchCustomer, updateCustomer, uploadDocument, CONSENT_ITEMS, KYC_REASONS, fileUrl, sendOtp, verifyOtp, saveFcmToken, FIREBASE_CONFIG, firebaseConfigured, getDigilockerAuthUrl, checkDigilockerStatus, validateLinkToken, consumeLinkToken } from '../../utils/constants';

type Screen = 'whatsapp'|'browser'|'auth_otp'|'already_submitted'|'consent'|'pan_upfront'|'pan_upfront_result'|'landing'|'confirm'
  |'minor_choice'|'addr'|'mob_access'|'mob_new'|'mob_otp_old'|'mob_otp_new'
  |'mob_no_access'|'mob_postpaid'|'mob_postpaid_otp'|'branch'
  |'full_intro'|'full_pan'|'full_pan_result'|'full_aadhaar'|'full_aadhaar_otp'|'digilocker'|'digilocker_result'
  |'full_doc'|'full_vkyc'|'full_vkyc_live'|'resubmit'|'success'|'link_error';

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
  @Prop({ mutable: true }) customerId: string = 'KYC-4528';

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
  @State() digilockerVerified = false;
  @State() digilockerName = '';
  @State() digilockerDob = '';
  @State() digilockerLoading = false;
  @State() newConstitution = '';
  @State() simLoading = false;
  @State() linkToken = '';
  @State() showVkycSchedule = false;  // show schedule modal
  @State() scheduleDate = '';
  @State() scheduleSlot = '';
  @State() scheduleConfirmed = false;
  @State() scheduleSlots: Array<{date:string;label:string;slots:Array<{time:string;available:boolean}>}> = [];
  @State() resumeMode = false; // true when resuming a partial journey
  @State() linkError = '';
  @State() tokenValidating = false;
  @State() tokenMobileLast4 = ''; // last 4 of mobile from token — for validation // generic simulated loading state

  private sessionTimer: any;
  private cooldownTimer: any;

  async componentWillLoad() {
    let resolvedCustId = this.customerId;
    let storedToken = ''; // declared in outer scope for use after window block

    if (typeof window !== 'undefined') {
      storedToken                = sessionStorage.getItem('rekyc_link_token') || '';
      const storedMasked = sessionStorage.getItem('rekyc_masked_mobile') || '';
      const storedCustId = sessionStorage.getItem('rekyc_cust_id') || '';

      if (storedToken) {
        // Token link — use stored custId, not the Prop
        this.linkToken = storedToken;
        if (storedCustId) resolvedCustId = storedCustId;
        if (storedMasked) this.tokenMobileLast4 = storedMasked.replace(/\D/g,'').slice(-4);
        this.screen = 'browser';
        this.hist   = ['browser'];
      }

      // DigiLocker callback
      const params = new URLSearchParams(window.location.search);
      const dlVerified = params.get('dl_verified');
      const dlError    = params.get('dl_error');
      if (dlVerified) {
        this.digilockerLoading = true;
        try {
          const status = await checkDigilockerStatus(resolvedCustId);
          if (status.verified) {
            this.digilockerVerified = true;
            this.digilockerName = status.name || '';
            this.digilockerDob  = status.dob  || '';
          }
        } finally { this.digilockerLoading = false; }
        this.hist   = ['whatsapp','browser','auth_otp','consent','landing','full_intro','full_pan','full_pan_result','full_aadhaar','digilocker','digilocker_result'];
        this.screen = 'digilocker_result' as any;
        window.history.replaceState({}, '', '/customer');
      } else if (dlError) {
        this.hist   = ['whatsapp','browser','auth_otp','consent','landing','full_intro','full_pan','full_pan_result','full_aadhaar'];
        this.screen = 'full_aadhaar';
        window.history.replaceState({}, '', '/customer');
      }
    }

    // Use resolvedCustId — from sessionStorage if token link, otherwise Prop
    console.log(`[rekyc] Loading customer: ${resolvedCustId}`);
    try {
      this.cust = await fetchCustomer(resolvedCustId);
      this.customerId = resolvedCustId;
      console.log(`[rekyc] Loaded: ${this.cust?.name}, status: ${this.cust?.status}`);

      // If arriving via token link AND journey already completed — skip to already_submitted
      // Don't even show mobile entry — no point authenticating just to see a completion message
      if (storedToken && this.cust) {
        const done = ['Completed','Pending VKYC','Pending Verification'].includes(this.cust.status);
        if (done) {
          this.screen = 'already_submitted';
          this.hist   = ['already_submitted'];
        }
      }
    } catch (e) { console.error('Failed to load customer:', e); }
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

  // ── Determine if Full KYC is mandatory based on docs on file ──
  requiresFullKyc(): { required: boolean; reason: string } {
    const cust = this.cust;
    if (!cust) return { required: false, reason: '' };

    const docs = cust.docsOnFile || [];
    const today = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    // Check if POI is missing — use both DB and session state
    const hasPoi = cust.poiStep?.status === 'Verified' || docs.length > 0;
    const hasPoa = cust.poaStep?.status === 'Verified' || docs.length > 1;

    if (!hasPoi || !hasPoa) {
      return { required: true, reason: 'One or more identity documents are missing from your records.' };
    }

    // Check for expired or expiring docs
    for (const doc of docs) {
      const expMatch = doc.meta?.match(/Exp:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
      if (expMatch) {
        const expDate = new Date(expMatch[1]);
        if (expDate < today) {
          return { required: true, reason: `${doc.name} has expired and must be renewed.` };
        }
        if (expDate < threeMonthsLater) {
          return { required: true, reason: `${doc.name} is expiring within 3 months and must be renewed.` };
        }
      }
    }

    return { required: false, reason: '' };
  }

  generateScheduleSlots() {
    const result = [];
    const today = new Date();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const allSlots = [];
    for (let h = 10; h < 17; h++) {
      for (const m of [0, 30]) {
        if (h === 16 && m === 30) break;
        const ampm = h < 12 ? 'AM' : 'PM';
        const h12 = h <= 12 ? h : h - 12;
        allSlots.push({ time: `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}` });
      }
    }
    let daysAdded = 0, offset = 1;
    while (daysAdded < 5) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset++);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue;
      const label = `${days[dow]}, ${date.getDate()} ${months[date.getMonth()]}`;
      const dateStr = date.toISOString().slice(0, 10);
      const slots = allSlots.map(s => ({ time: s.time, available: Math.random() > 0.4 }));
      let avail = slots.filter(s => s.available).length;
      for (let i = 0; i < slots.length && avail < 3; i++) {
        if (!slots[i].available) { slots[i].available = true; avail++; }
      }
      result.push({ date: dateStr, label, slots });
      daysAdded++;
    }
    return result;
  }

  async scheduleVkyc() {
    if (!this.scheduleSlot || !this.scheduleDate) return;
    const c = this.cust!;
    const vkycApi = (window as any).__VKYC_API__ || '';
    const apiBase = (window as any).__REKYC_API__ || 'https://rekyc-work-production.up.railway.app';

    // 1. Save scheduled slot to Re-KYC
    await fetch(`${apiBase}/api/customers/${this.customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vkycScheduled: `${this.scheduleDate} · ${this.scheduleSlot}`,
        vkycStep: { status: 'Scheduled', date: this.scheduleDate, slot: this.scheduleSlot },
        status: 'Pending VKYC',
        reminders: [...(c.reminders || []), { ch: 'System', date: new Date().toLocaleDateString('en-IN'), status: `VKYC scheduled for ${this.scheduleDate} · ${this.scheduleSlot}` }],
      })
    });

    // 2. Add customer to VKYC agent queue
    if (vkycApi) {
      try {
        await fetch(`${vkycApi}/queue/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: this.customerId,
            name: c.name,
            mobile: c.mobile,
            appId: this.customerId,
            product: (c as any).relationship || 'Banking Account',
            pan: this.panNum || c.pan,
            dob: this.panDob || c.dob,
            address: c.address,
            scheduledSlot: `${this.scheduleDate} · ${this.scheduleSlot}`,
            status: 'scheduled',
          })
        });
      } catch(e) { /* non-critical */ }
    }

    // 3. Send SMS with VKYC link via Re-KYC API
    await fetch(`${apiBase}/api/vkyc/schedule-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custId: this.customerId,
        slot: `${this.scheduleDate} · ${this.scheduleSlot}`,
      })
    });

    this.scheduleConfirmed = true;
    this.showVkycSchedule = false;

    // Mark journey as complete (Pending VKYC)
    await this.completeKyc('Full KYC');
    this.go('success');
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
    this.registerPush();

    // After OTP, determine where to resume based on customer's journey status
    const c = this.cust;
    if (!c) { this.go('consent'); return; }

    // ── Already fully submitted ──
    if (c.status === 'Completed' || c.status === 'Pending VKYC' || c.status === 'Pending Verification') {
      this.go('already_submitted');
      return;
    }

    // ── Partial journey — resume from where they left ──
    const panDone  = c.panStep?.status === 'Verified';
    const aadDone  = c.poiStep?.status === 'Verified';
    const docDone  = !!(c as any).docUploadDate || (c.documents && c.documents.length > 0);
    const vkycPend = c.vkycStep?.status === 'Pending';

    if (panDone || aadDone || docDone || vkycPend ||
        ['In Progress','Initiated','Link Generated','Pending Doc Upload','Pending VKYC'].includes(c.status)) {

      // Has some progress — skip consent & PAN upfront, go to consent first then resume
      if (panDone && aadDone && docDone) {
        // All steps done, just VKYC remaining
        this.resumeMode = true;
        this.panVerified = true;
        this.go('consent');
      } else if (panDone && aadDone) {
        this.resumeMode = true;
        this.panVerified = true;
        this.go('consent');
      } else if (panDone) {
        this.resumeMode = true;
        this.panVerified = true;
        this.go('consent');
      } else {
        // No steps done yet — normal flow
        this.go('consent');
      }
    } else {
      // Fresh journey
      this.go('consent');
    }
  }

  // ── Determine resume screen after consent (for partial journeys) ──
  getResumeScreen(): Screen {
    const c = this.cust;
    if (!c) return 'landing';
    // Use both session state and DB
    const panDone = this.panVerified || c.panStep?.status === 'Verified';
    const aadDone = this.digilockerVerified || c.poiStep?.status === 'Verified';
    const docDone = !!(this.uploadedDocs && (this.uploadedDocs['docF'] || this.uploadedDocs['docB']))
      || !!(c as any).docUploadDate
      || (c.documents && c.documents.filter((d: any) => d.status !== 'rejected').length > 0);

    if (panDone && aadDone && docDone) return 'full_vkyc';
    if (panDone && aadDone) return 'full_doc';
    if (panDone) return 'full_aadhaar';
    return 'landing';
  }

  // ── Journey progress steps derived from customer record ──
  getJourneySteps() {
    const c = this.cust;
    if (!c) return [];
    // Use session state (this.panVerified etc) for mid-journey — DB only updated at end
    const panDone  = this.panVerified || c.panStep?.status === 'Verified';
    const aadDone  = this.digilockerVerified
      || (this.otpVals['adho']?.filter((v: string) => v).length === 6)
      || c.poiStep?.status === 'Verified';
    const docDone  = !!(this.uploadedDocs && (this.uploadedDocs['docF'] || this.uploadedDocs['docB']))
      || !!(c as any).docUploadDate
      || (c.documents && c.documents.filter((d: any) => d.status !== 'rejected').length > 0);
    const vkycDone = c.vkycStep?.status === 'Completed';
    const vkycPend = c.vkycStep?.status === 'Pending';
    return [
      { label: 'PAN Verification',   done: panDone,  active: !panDone },
      { label: 'Aadhaar Validation', done: aadDone,  active: panDone && !aadDone },
      { label: 'Document Upload',    done: docDone,  active: aadDone && !docDone },
      { label: 'Video KYC',          done: vkycDone, active: docDone && (vkycPend || !vkycDone) },
    ];
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
  // When arriving via SMS link: validate entered mobile against the token
  // When arriving directly: just check format
  async validateMobileAsync(): Promise<boolean> {
    const digits = this.mobileEntry.replace(/\D/g, '');
    if (digits.length !== 10) {
      this.mobileError = 'Please enter a valid 10-digit Indian mobile number.';
      return false;
    }
    if (!/^[6-9]/.test(digits)) {
      this.mobileError = 'Mobile number must start with 6, 7, 8, or 9.';
      return false;
    }

    // Token flow — compare last 4 digits against what's in the token
    if (this.linkToken && this.tokenMobileLast4) {
      const enteredLast4 = digits.slice(-4);
      if (this.tokenMobileLast4 !== enteredLast4) {
        this.mobileError = 'The mobile number you entered does not match the number registered for this link.';
        return false;
      }
    }

    this.mobileError = '';
    return true;
  }

  validateMobile(): boolean {
    const digits = this.mobileEntry.replace(/\D/g, '');
    if (digits.length !== 10) { this.mobileError = 'Please enter a valid 10-digit Indian mobile number.'; return false; }
    if (!/^[6-9]/.test(digits)) { this.mobileError = 'Mobile number must start with 6, 7, 8, or 9.'; return false; }
    this.mobileError = '';
    return true;
  }

  // Format entered number to E.164 for Twilio (+91XXXXXXXXXX)
  get e164Mobile(): string {
    const digits = this.mobileEntry.replace(/\D/g, '');
    return `+91${digits}`;
  }

  get maskedEnteredMobile(): string {
    const digits = this.mobileEntry.replace(/\D/g, '');
    if (digits.length < 4) return `+91 ···· ${digits}`;
    // Show first 2 digits, mask middle, show last 4: 98 XXXX 3210
    const first2 = digits.slice(0, 2);
    const last4  = digits.slice(-4);
    return `+91 ${first2}XXXXXX${last4}`;
  }

  // ── Send OTP via API (real Twilio if configured, demo mode otherwise) ──
  async triggerOtp(onSent: () => void) {
    this.otpError = '';
    this.otpSending = true;
    try {
      const result = await sendOtp(this.e164Mobile);
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

  // ── PAN verification — simulated NSDL response ──
  // PAN structure: AAAAA9999A
  // Character 4 (index 3) indicates entity type:
  //   P = Individual, C = Company, H = HUF, F = Firm, A = AOP, T = Trust, B = BOI
  verifyPan() {
    const pan = this.panNum.toUpperCase();

    if (!validPan(pan)) {
      this.panError = 'Invalid PAN format. Must be 10 characters in format AAAAA9999A.';
      return;
    }
    if (!this.panName.trim()) {
      this.panError = 'Please enter your full name as it appears on your PAN card.';
      return;
    }
    if (!this.panDob) {
      this.panError = 'Please enter your date of birth as per PAN card.';
      return;
    }

    // Check 4th character maps to entity type
    const entityCode = pan[3];
    const entityMap: Record<string, string> = {
      P: 'Individual', C: 'Company', H: 'Hindu Undivided Family',
      F: 'Firm', A: 'Association of Persons', T: 'Trust', B: 'Body of Individuals',
    };
    const detectedType = entityMap[entityCode] || 'Unknown';

    // If constitution change selected, PAN must match the new constitution
    if (this.newConstitution) {
      const constitutionPanMap: Record<string, string[]> = {
        'Individual': ['P'],
        'Sole Proprietorship': ['P'],
        'HUF': ['H'],
        'Partnership Firm': ['F'],
        'Company': ['C'],
        'Trust': ['T'],
        'AOP / BOI': ['A', 'B'],
      };
      const validCodes = constitutionPanMap[this.newConstitution] || ['P'];
      if (!validCodes.includes(entityCode)) {
        this.panError = `PAN type mismatch. For ${this.newConstitution}, PAN must belong to ${validCodes.map(x => entityMap[x]).join(' or ')}. This PAN belongs to: ${detectedType}.`;
        return;
      }
    } else {
      // Default: only Individual PANs allowed
      if (entityCode !== 'P') {
        this.panError = `This PAN belongs to a ${detectedType}. Individual Re-KYC requires a personal PAN card (4th character must be 'P').`;
        return;
      }
    }

    this.panError = '';
    this.panVerified = true;
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

    // Record exactly which steps were completed in this journey
    const updates: any = {
      status: newStatus,
      kycType,
      source: 'Digital',
      completedDate: today,
      linkActive: false,
      reminders: [...(this.cust?.reminders || []), {
        ch: 'System', date: today,
        status: `KYC submitted via digital portal — ${kycType}`,
      }],
    };

    // Only record steps that ACTUALLY happened in this journey
    if (kycType === 'Self-Declaration') {
      // Self-declaration: customer confirmed existing details with digital signature
      // No PAN verification, no Aadhaar, no docs, no VKYC
      updates.declarationDate = today;
      updates.declarationName = this.sigText || '';
      updates.panStep  = null;
      updates.poiStep  = null;
      updates.poaStep  = null;
      updates.vkycStep = { status: 'N/A', date: today };

    } else if (kycType === 'Partial Update') {
      // Mobile/address update only
      updates.partialUpdateDate = today;

    } else if (kycType === 'Full KYC') {
      // PAN — only if verified in this session
      if (this.panVerified && this.panNum) {
        updates.panStep = { status: 'Verified', date: today, pan: this.panNum, name: this.panName };
      }
      // Aadhaar — only if DigiLocker or OTP was actually completed
      if (this.digilockerVerified) {
        updates.poiStep = { status: 'Verified', date: today, type: 'Aadhaar', mode: 'DigiLocker' };
        updates.poaStep = { status: 'Verified', date: today, type: 'Aadhaar', mode: 'DigiLocker' };
      } else if (this.otpVals['adho']?.filter((v: string) => v).length === 6) {
        updates.poiStep = { status: 'Verified', date: today, type: 'Aadhaar', mode: 'OTP' };
        updates.poaStep = { status: 'Verified', date: today, type: 'Aadhaar', mode: 'OTP' };
      }
      // Documents — only if uploaded in this session
      if (this.uploadedDocs && (this.uploadedDocs['docF'] || this.uploadedDocs['docB'])) {
        updates.docUploadDate = today;
      }
      // VKYC — pending after full KYC submission
      updates.vkycStep = { status: 'Pending', date: null };
    }

    // Constitution change
    if (this.newConstitution) {
      updates.constitution = this.newConstitution;
    }

    await updateCustomer(this.customerId, updates);
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
    already_submitted: ['Already Submitted', 'KYC under review'],
    consent: ['Consent', 'Before we begin'],
    pan_upfront: ['PAN Verification', 'Identity check'],
    pan_upfront_result: ['PAN Confirmed', 'Identity verified'],
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
    digilocker_result: ['Aadhaar Verified', 'DigiLocker success'],
    full_doc: ['Documents', 'Step 3/4'],
    full_vkyc: ['Video KYC', 'Step 4/4'],
    full_vkyc_live: ['VKYC Live', 'In progress'],
    resubmit: ['Re-upload Document', 'Action required'],
    success: ['Done', 'KYC Submitted'],
    link_error: ['Link Invalid', 'Access denied'],
  };

  render() {
    if (!this.cust) return <div class="loading">Loading...</div>;
    const [t1, t2] = this.titles[this.screen] || ['Re-KYC', ''];
    const noBack = ['whatsapp', 'success', 'branch', 'consent', 'already_submitted'];

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
          {this.renderProgressBar()}
          <div class="body">{this.renderScreen()}</div>
          {this.uploading && <div class="upload-overlay"><div class="upload-spinner" />Uploading...</div>}
        </div>
      </div>
    );
  }

  renderProgressBar() {
    const midScreens: string[] = ['full_intro','full_pan','full_pan_result','full_aadhaar','full_aadhaar_otp','digilocker','digilocker_result','full_doc','full_vkyc','full_vkyc_live'];
    if (!midScreens.includes(this.screen)) return null;
    const steps = this.getJourneySteps();
    return (
      <div class="progress-bar-wrap">
        {steps.map((s, i) => (
          <div class={{ 'pb-step': true, 'pb-done': s.done, 'pb-active': s.active }}>
            <div class="pb-dot">
              {s.done ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> : <span>{i + 1}</span>}
            </div>
            <div class="pb-label">{s.label}</div>
            {i < steps.length - 1 && <div class="pb-line" />}
          </div>
        ))}
      </div>
    );
  }

  renderScreen() {
    const c = this.cust!;

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

    // ── Already submitted ──
    case 'already_submitted': return (
      <div class="scr tc">
        <div class="suc-icon" style={{ background: 'linear-gradient(135deg,#074994,#3067A6)' }}>✓</div>
        <h2>KYC Already Submitted</h2>
        <p class="t2" style={{ marginBottom: '16px' }}>
          Hi <strong>{c.name.split(' ')[0]}</strong>, your KYC update has already been submitted and is currently under review.
        </p>
        <div class="data-card" style={{ textAlign: 'left', marginBottom: '12px' }}>
          <div class="d-row"><span class="d-lbl">Customer</span><span class="d-val">{c.name}</span></div>
          <div class="d-row"><span class="d-lbl">Status</span>
            <span class="d-val" style={{ color: c.status === 'Completed' ? 'var(--acc)' : '#B8860B', fontWeight: '700' }}>
              {c.status === 'Completed' ? '✓ Completed' : c.status}
            </span>
          </div>
          {c.completedDate && <div class="d-row"><span class="d-lbl">Submitted On</span><span class="d-val">{c.completedDate}</span></div>}
        </div>
        {c.status === 'Completed'
          ? this.renderNotice('ok', 'Your KYC has been verified and approved. No further action needed.')
          : this.renderNotice('info', <span>Your submission is under review. You will receive an SMS and email once approved. Expected TAT: <strong>2–3 working days</strong>.</span>)
        }
        {c.status !== 'Completed' && (
          <div class="ref-card" style={{ marginTop: '12px', textAlign: 'left', background: 'var(--pri-bg)' }}>
            <div class="ref-label">WHAT HAPPENS NEXT</div>
            <div style={{ fontSize: '12.5px', color: 'var(--t2)', lineHeight: '1.6' }}>
              Your documents are being reviewed by National Bank. Once approved, your account services will continue and your reward will be credited.
            </div>
          </div>
        )}
      </div>
    );

    case 'link_error': return (
      <div class="scr tc">
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
        <h2 style={{ color: 'var(--dng)', marginBottom: '8px' }}>Link Unavailable</h2>
        <p class="t2" style={{ marginBottom: '20px' }}>{this.linkError}</p>
        <div class="data-card" style={{ textAlign: 'left' }}>
          <div class="d-row"><span class="d-lbl">What to do</span><span class="d-val" style={{ fontSize: '12px' }}>Contact your National Bank branch or relationship manager to request a new Re-KYC link.</span></div>
        </div>
      </div>
    );

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
        <label class="field-label">Your Mobile Number *</label>
        <div class="mobile-input-wrap">
          <span class="mobile-prefix">+91</span>
          <input class={{ 'field-input': true, 'field-err': !!this.mobileError, 'mobile-field': true }}
            type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number"
            value={this.mobileEntry}
            onInput={(e: any) => { this.mobileEntry = e.target.value.replace(/\D/g,'').slice(0,10); this.mobileError = ''; }} />
        </div>
        {this.mobileError
          ? <div class="field-error">{this.mobileError}</div>
          : <div class="hint">
              {this.linkToken
                ? 'Enter the mobile number where you received this link'
                : 'An OTP will be sent to this number to verify your identity'}
            </div>}
        <button class="btn-primary" disabled={this.mobileEntry.replace(/\D/g,'').length !== 10 || this.otpSending || this.tokenValidating}
          onClick={async () => {
            const valid = await this.validateMobileAsync();
            if (valid) this.triggerOtp(() => this.go('auth_otp'));
          }}>
          {this.tokenValidating ? <span class="btn-loading"><span class="btn-spinner"/>Verifying...</span>
            : this.otpSending ? <span class="btn-loading"><span class="btn-spinner"/>Sending OTP...</span>
            : 'Send OTP'}
        </button>
      </div>
    );

    case 'auth_otp': return (
      <div class="scr tc">
        <p class="t2">OTP sent to <strong>{this.maskedEnteredMobile}</strong></p>
        {this.otpLocked
          ? <div class="lockout-card">🔒 Session locked — too many incorrect attempts.<br/>Please restart.</div>
          : this.renderOtp('auth')
        }
        {!this.otpLocked && this.renderOtpFooter('auth', this.maskedEnteredMobile, this.e164Mobile)}
        <button class="btn-primary" disabled={!this.otpFilled('auth') || this.otpLocked}
          onClick={() => this.verifyOtpCode('auth', this.e164Mobile, () => {
            // Consume the token so link can't be reused
            if (this.linkToken) {
              consumeLinkToken(this.linkToken);
              sessionStorage.removeItem('rekyc_link_token');
              sessionStorage.removeItem('rekyc_masked_mobile');
            }
            this.startSession();
            this.go('consent');
          })}>
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
        <button class="btn-accent" style={{ marginTop: '16px' }} disabled={!this.allConsented()}
          onClick={() => {
            if (this.resumeMode) {
              const dest = this.getResumeScreen();
              this.go(dest);
            } else {
              this.go('pan_upfront');
            }
          }}>
          {this.resumeMode ? 'Continue My KYC →' : 'Proceed to Identity Verification'}
        </button>
        <p class="hint tc" style={{ marginTop: '8px' }}>By proceeding, you authorise National Bank to access and update your KYC records.</p>
      </div>
    );

    case 'pan_upfront': return (
      <div class="scr">
        <div class="bank-row"><div class="bank-logo">NB</div><div><strong>Identity Verification</strong><br/><span class="t2">Required before proceeding</span></div></div>
        {(this.panVerified || this.cust?.panStep?.status === 'Verified')
          ? <div class="resume-notice">
              <div class="rn-icon">✓</div>
              <div class="rn-body">
                <div class="rn-title">PAN already verified</div>
                <div class="rn-sub">PAN confirmed as <strong>{this.panNum}</strong>. You can continue or update below.</div>
              </div>
            </div>
          : this.renderNotice('info', <span>To confirm your identity, please enter your PAN details. This is a mandatory step for all Re-KYC journeys.</span>)
        }
        <label class="field-label">PAN Number *</label>
        <input class={{ 'field-input': true, 'field-err': !!this.panError && !validPan(this.panNum) }}
          placeholder="ABCPS1234K" maxLength={10}
          value={this.panNum}
          onInput={(e: any) => { this.panNum = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''); this.panError = ''; }}
          style={{ textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' }} />
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
          disabled={!validPan(this.panNum) || !this.panName.trim() || !this.panDob || this.simLoading}
          onClick={async () => {
            this.simLoading = true;
            await new Promise(r => setTimeout(r, 1800));
            this.simLoading = false;
            this.verifyPan();
            if (this.panVerified) this.go('pan_upfront_result');
          }}>
          {this.simLoading
            ? <span class="btn-loading"><span class="btn-spinner" />Verifying with NSDL...</span>
            : 'Verify PAN'}
        </button>
      </div>
    );

    case 'pan_upfront_result': return (
      <div class="scr">
        <div class="verify-result ok">
          <div class="vr-icon">✓</div>
          <div class="vr-body">
            <div class="vr-title">Identity Verified</div>
            <div class="vr-sub">PAN confirmed — proceed to review your KYC details</div>
          </div>
        </div>
        <div class="nsdl-card">
          <div class="nsdl-header">
            <div class="nsdl-logo">IT</div>
            <div><div class="nsdl-title">Income Tax Department</div><div class="nsdl-sub">PAN Verification Response</div></div>
            <div class="nsdl-status">ACTIVE</div>
          </div>
          <div class="nsdl-body">
            <div class="nsdl-row"><span class="nsdl-lbl">PAN</span><span class="nsdl-val pan-mono">{this.panNum}</span></div>
            <div class="nsdl-row"><span class="nsdl-lbl">Name</span><span class="nsdl-val">{this.panName.toUpperCase()}</span></div>
            <div class="nsdl-row"><span class="nsdl-lbl">Date of Birth</span><span class="nsdl-val">{this.panDob}</span></div>
            <div class="nsdl-row"><span class="nsdl-lbl">PAN Type</span><span class="nsdl-val">Individual (P)</span></div>
            <div class="nsdl-row"><span class="nsdl-lbl">Status</span><span class="nsdl-val nsdl-ok">✓ Active &amp; Valid</span></div>
          </div>
          <div class="nsdl-footer">Verification Ref: NSDL{Date.now().toString().slice(-10)} | {new Date().toLocaleDateString('en-IN')}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button class="btn-primary" style={{ flex: '1' }} onClick={() => this.go('landing')}>View My KYC Details →</button>
          <button class="btn-text" style={{ flex: '0 0 auto', color: 'var(--t2)', fontSize: '12.5px' }}
            onClick={() => { this.panVerified = false; this.panError = ''; this.go('pan_upfront'); }}>
            ✎ Change Details
          </button>
        </div>
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
          <div class="d-row"><span class="d-lbl">Mobile</span><span class="d-val">{this.maskedEnteredMobile}</span></div>
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
        {(() => {
          const { required, reason } = this.requiresFullKyc();
          return (
            <div>
              {required && (
                <div class="full-kyc-notice">
                  <span class="fkn-icon">⚠</span>
                  <span>{reason} <strong>Full KYC is required.</strong></span>
                </div>
              )}
              <div class={{ 'action-card': true, 'action-card-disabled': required }}
                onClick={() => { if (!required) this.go('confirm'); }}>
                <div class="ac-icon green">✓</div>
                <div class="ac-body">
                  <div class="ac-title">Details are Correct</div>
                  <div class="ac-desc">{required ? 'Not available — Full KYC required' : 'Self-declare all details are accurate'}</div>
                  <div class="ac-time">⏱ ~2 min</div>
                </div>
                <div class="ac-arrow">{required ? '✕' : '›'}</div>
              </div>
              <div class={{ 'action-card': true, 'action-card-disabled': required }}
                onClick={() => { if (!required) this.go('minor_choice'); }}>
                <div class="ac-icon blue">✎</div>
                <div class="ac-body">
                  <div class="ac-title">Update Address / Mobile</div>
                  <div class="ac-desc">{required ? 'Not available — Full KYC required' : 'Address or mobile number changed'}</div>
                  <div class="ac-time">⏱ ~5 min</div>
                </div>
                <div class="ac-arrow">{required ? '✕' : '›'}</div>
              </div>
              <div class="action-card" onClick={() => this.go('full_intro')}>
                <div class="ac-icon amber">⚑</div>
                <div class="ac-body">
                  <div class="ac-title">Full KYC{required ? ' (Required)' : ''}</div>
                  <div class="ac-desc">Complete identity verification with documents</div>
                  <div class="ac-time">⏱ ~10 min</div>
                </div>
                <div class="ac-arrow">›</div>
              </div>
            </div>
          );
        })()}
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
        {this.renderNotice('info', <span>Current address on record: <em style={{ color: 'var(--t2)', fontSize: '12px' }}>{c.address}</em></span>)}
        <label class="field-label">Address Line 1 *</label><input class="field-input" placeholder="Flat/House, Building" />
        <label class="field-label">Address Line 2</label><input class="field-input" placeholder="Street, Locality" />
        <div class="row-2">
          <div><label class="field-label">City *</label><input class="field-input" placeholder="City"/></div>
          <div><label class="field-label">PIN *</label><input class="field-input" placeholder="400001" maxLength={6}/></div>
        </div>
        <label class="field-label">State *</label>
        <select class="field-input"><option>Select State</option><option>Maharashtra</option><option>Delhi</option><option>Karnataka</option><option>Tamil Nadu</option><option>Gujarat</option><option>West Bengal</option><option>Telangana</option><option>Rajasthan</option></select>

        <h3 class="sec-title">Verify Address Proof</h3>
        <p class="t2" style={{ marginBottom: '10px' }}>Choose how to verify your new address:</p>
        {this.renderRadio(this.accessOpt === 'digilocker', 'Fetch via DigiLocker (Recommended)', 'Instant — fetches Aadhaar with updated address', () => this.accessOpt = 'digilocker')}
        {this.renderRadio(this.accessOpt === 'upload', 'Upload document manually', 'Utility bill, bank statement, or lease agreement', () => this.accessOpt = 'upload')}

        {this.accessOpt === 'upload' && (
          <div style={{ marginTop: '10px' }}>
            <label class="field-label">Document Type</label>
            <select class="field-input"><option>Select</option><option>Aadhaar Card</option><option>Utility Bill</option><option>Bank Statement</option><option>Lease Agreement</option><option>Passport</option></select>
            {this.renderUpload('addr', 'Upload address proof document', 'Address Proof')}
          </div>
        )}

        <button class="btn-primary"
          style={{ marginTop: '12px' }}
          disabled={!this.accessOpt || (this.accessOpt === 'upload' && !this.uploadedDocs['addr'])}
          onClick={() => {
            if (this.accessOpt === 'digilocker') {
              this.accessOpt = null;
              this.go('digilocker');
            } else {
              this.go(this.minorOpt === 'both' ? 'mob_access' : 'success');
            }
          }}>
          {this.accessOpt === 'digilocker' ? 'Open DigiLocker →' : 'Continue'}
        </button>
      </div>
    );

    case 'mob_access': return (
      <div class="scr">
        {this.renderNotice('info', <span>Current registered mobile: <strong>{this.maskedEnteredMobile}</strong></span>)}
        <h3 class="sec-title">Do you have access to your current number?</h3>
        {this.renderRadio(this.accessOpt === 'yes', 'Yes, I can receive OTP', 'Verify via OTP on both numbers', () => this.accessOpt = 'yes')}
        {this.renderRadio(this.accessOpt === 'no', "No, I don't have access", 'Alternate verification required', () => this.accessOpt = 'no')}
        <button class="btn-primary" disabled={!this.accessOpt} onClick={() => this.go(this.accessOpt === 'yes' ? 'mob_new' : 'mob_no_access')}>Continue</button>
      </div>
    );

    case 'mob_new': return (
      <div class="scr">
        <h3 class="sec-title">Enter New Mobile Number</h3>
        <label class="field-label">Current Mobile</label><input class="field-input readonly" value={this.maskedEnteredMobile} readOnly />
        <label class="field-label">New Mobile Number *</label><input class="field-input" placeholder="Enter 10-digit number" maxLength={10} type="tel" />
        <button class="btn-primary" onClick={() => { this.startResendCooldown(); this.go('mob_otp_old'); }}>Send OTP to Current Number</button>
      </div>
    );

    case 'mob_otp_old': return (
      <div class="scr tc">
        <p class="t2">Enter OTP sent to <strong>{this.maskedEnteredMobile}</strong></p>
        {this.renderOtp('mold')}
        {this.renderOtpFooter('mold', this.maskedEnteredMobile, this.e164Mobile)}
        <button class="btn-primary" disabled={!this.otpFilled('mold') || this.otpLocked}
          onClick={() => this.verifyOtpCode('mold', this.e164Mobile, () => { this.startResendCooldown(); this.go('mob_otp_new'); })}>
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

        {this.consents['r_constitution'] && (
          <div class="constitution-selector">
            <label class="field-label">New Constitution Type *</label>
            <select class="field-input" onChange={(e: any) => { this.newConstitution = e.target.value; }}>
              <option value="">Select new constitution</option>
              <option value="Individual">Individual</option>
              <option value="Sole Proprietorship">Sole Proprietorship</option>
              <option value="HUF">Hindu Undivided Family (HUF)</option>
              <option value="Partnership Firm">Partnership Firm</option>
              <option value="Company">Company (Private / Public)</option>
              <option value="Trust">Trust / Society</option>
              <option value="AOP / BOI">AOP / Body of Individuals</option>
            </select>
            {this.newConstitution && (
              <div class="notice info" style={{ marginTop: '8px' }}>
                <div class="notice-icon">ℹ</div>
                <p>For <strong>{this.newConstitution}</strong>, you will need to provide a matching PAN card in the next step.</p>
              </div>
            )}
          </div>
        )}

        <h3 class="sec-title">Steps to Complete</h3>
        <div class="step-list">
          <div class={{ 'step-item': true, active: false, 'step-done': this.panVerified }}>
            <div class="step-dot">{this.panVerified ? '✓' : '1'}</div>
            <span>PAN Verification {this.panVerified ? <span style={{ color: 'var(--acc)', fontSize: '11px', fontWeight: '700' }}> — Completed</span> : ''}</span>
          </div>
          {['Aadhaar Validation', 'Document Upload', 'Video KYC'].map((s, i) =>
            <div class={{ 'step-item': true, active: i === 0 && this.panVerified }}><div class="step-dot">{i + 2}</div><span>{s}</span></div>
          )}
        </div>
        <button class="btn-primary"
          disabled={this.consents['r_constitution'] && !this.newConstitution}
          onClick={() => {
            // Skip PAN step if already verified during upfront check
            if (this.panVerified) {
              this.go('full_aadhaar');
            } else {
              this.go('full_pan');
            }
          }}>
          {this.panVerified ? 'Continue to Aadhaar Validation' : 'Begin Verification'}
        </button>
        {this.panVerified && (
          <div class="hint tc" style={{ marginTop: '8px' }}>
            PAN already verified as <strong>{this.panNum}</strong>.
            <button style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', marginLeft: '4px' }}
              onClick={() => { this.panVerified = false; this.go('full_pan'); }}>
              Change PAN
            </button>
          </div>
        )}
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
          disabled={!validPan(this.panNum) || !this.panName.trim() || !this.panDob || this.simLoading}
          onClick={async () => {
            const pan = this.panNum.toUpperCase();
            if (!validPan(pan) || !this.panName.trim() || !this.panDob) { this.verifyPan(); return; }
            this.simLoading = true;
            await new Promise(r => setTimeout(r, 1800));
            this.simLoading = false;
            this.verifyPan();
            if (this.panVerified) this.go('full_pan_result');
          }}>
          {this.simLoading
            ? <span class="btn-loading"><span class="btn-spinner" />Verifying with NSDL...</span>
            : 'Verify PAN'}
        </button>
      </div>
    );

    case 'full_pan_result': return (
      <div class="scr">
        <div class="verify-result ok">
          <div class="vr-icon">✓</div>
          <div class="vr-body">
            <div class="vr-title">PAN Verified Successfully</div>
            <div class="vr-sub">Verified against NSDL — Income Tax Department</div>
          </div>
        </div>
        <div class="nsdl-card">
          <div class="nsdl-header">
            <div class="nsdl-logo">IT</div>
            <div>
              <div class="nsdl-title">Income Tax Department</div>
              <div class="nsdl-sub">PAN Verification Response</div>
            </div>
            <div class="nsdl-status">ACTIVE</div>
          </div>
          <div class="nsdl-body">
            <div class="nsdl-row"><span class="nsdl-lbl">PAN Number</span><span class="nsdl-val pan-mono">{this.panNum.toUpperCase()}</span></div>
            <div class="nsdl-row"><span class="nsdl-lbl">Name as per PAN</span><span class="nsdl-val">{this.panName.toUpperCase()}</span></div>
            <div class="nsdl-row"><span class="nsdl-lbl">Date of Birth</span><span class="nsdl-val">{this.panDob}</span></div>
            <div class="nsdl-row"><span class="nsdl-lbl">PAN Type</span><span class="nsdl-val">Individual (P)</span></div>
            <div class="nsdl-row"><span class="nsdl-lbl">PAN Status</span><span class="nsdl-val nsdl-ok">✓ Active &amp; Valid</span></div>
            <div class="nsdl-row"><span class="nsdl-lbl">Aadhaar Linked</span><span class="nsdl-val nsdl-ok">✓ Linked</span></div>
          </div>
          <div class="nsdl-footer">
            Verification Ref: NSDL{Date.now().toString().slice(-10)} &nbsp;|&nbsp; {new Date().toLocaleDateString('en-IN')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button class="btn-primary" style={{ flex: '1' }} onClick={() => this.go('full_aadhaar')}>Continue to Aadhaar</button>
          <button class="btn-text" style={{ flex: '0 0 auto', color: 'var(--t2)', fontSize: '12.5px' }}
            onClick={() => { this.panVerified = false; this.panError = ''; this.go('full_pan'); }}>
            ✎ Change Details
          </button>
        </div>
      </div>
    );

    case 'full_aadhaar': return (
      <div class="scr">
        <h3 class="sec-title">Step 2: Aadhaar Validation</h3>
        {this.cust?.poiStep?.status === 'Verified'
          ? <div class="resume-notice"><div class="rn-icon">✓</div><div class="rn-body"><div class="rn-title">Aadhaar already verified ({this.cust.poiStep.mode})</div><div class="rn-sub">You can continue to document upload or re-verify below.</div></div></div>
          : this.renderNotice('info', 'Choose your preferred verification method.')
        }
        {this.renderRadio(this.aadhaarMethod === 'digilocker', 'DigiLocker Fetch (Recommended)', 'Instant paperless — no OTP needed', () => this.aadhaarMethod = 'digilocker')}
        {this.renderRadio(this.aadhaarMethod === 'otp', 'Aadhaar OTP (eKYC)', 'OTP sent to Aadhaar-linked mobile', () => this.aadhaarMethod = 'otp')}
        {this.aadhaarMethod === 'otp' && (
          <div>
            <label class="field-label" style={{ marginTop: '12px' }}>Aadhaar Number *</label>
            <input class={{ 'field-input': true, 'field-err': !!this.aadhaarError }}
              placeholder="XXXX  XXXX  XXXX" maxLength={14} inputMode="numeric"
              type="password"
              value={this.aadhaarNum}
              onInput={(e: any) => {
                const raw = e.target.value.replace(/\D/g,'').slice(0,12);
                this.aadhaarNum = raw.replace(/(\d{4})(\d{0,4})(\d{0,4})/,'$1 $2 $3').trim();
                this.aadhaarError = '';
              }} />
            <div class="aadhaar-preview">
              {(() => {
                const digits = this.aadhaarNum.replace(/\s/g,'');
                if (digits.length === 0) return <span class="hint">Aadhaar number will be masked as you type</span>;
                const last4 = digits.slice(-4);
                const maskedPart = 'XXXX XXXX ';
                return <span style={{ fontFamily: 'monospace', letterSpacing: '2px', color: 'var(--t2)' }}>
                  {digits.length >= 4 ? maskedPart : ''}{last4}
                </span>;
              })()}
            </div>
            {this.aadhaarError && <div class="field-error">{this.aadhaarError}</div>}
            {!this.aadhaarError && this.aadhaarNum.replace(/\s/g,'').length === 12 &&
              <div class="hint" style={{ color: 'var(--acc)' }}>✓ Valid Aadhaar number</div>}
          </div>
        )}
        <button class="btn-primary" style={{ marginTop: '12px' }}
          disabled={!this.aadhaarMethod || this.otpSending}
          onClick={async () => {
            if (this.aadhaarMethod === 'otp') {
              if (!this.validateAadhaar()) return;
              this.triggerOtp(() => this.go('full_aadhaar_otp'));
            } else {
              this.go('digilocker');
            }
          }}>
          {this.otpSending ? <span class="btn-loading"><span class="btn-spinner" />Sending OTP...</span>
            : this.aadhaarMethod === 'digilocker' ? 'Open DigiLocker' : 'Send Aadhaar OTP'}
        </button>
      </div>
    );

    case 'digilocker': return (
      <div class="scr tc">
        <div class="digi-icon">🔐</div>
        <h2>DigiLocker</h2>
        <p class="t2" style={{ marginBottom: '16px' }}>You will be redirected to DigiLocker to fetch your Aadhaar details. Authorise National Bank to access your Aadhaar document.</p>
        <div class="digi-features">
          {['Instant Aadhaar fetch', 'No physical document needed', 'Govt. verified and tamper-proof', 'Data shared with your consent only'].map(t =>
            <div class="digi-item">✓ {t}</div>
          )}
        </div>
        {this.digilockerLoading
          ? <div class="digi-loading">
              <div class="upload-spinner" style={{ borderTopColor: 'var(--pri)', borderColor: 'var(--brd)' }} />
              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Connecting to DigiLocker...</div>
                <div class="hint tc" style={{ marginTop: '0' }}>You will be redirected to the government portal</div>
              </div>
            </div>
          : <button class="btn-primary" onClick={async () => {
              this.digilockerLoading = true;
              try {
                const result = await getDigilockerAuthUrl(this.customerId);
                if (result.ok && result.authUrl) {
                  // Real OAuth — redirect to DigiLocker
                  window.location.href = result.authUrl;
                } else if (result.demo) {
                  // DigiLocker not configured — simulate with realistic loader
                  await new Promise(r => setTimeout(r, 2500));
                  this.digilockerVerified = true;
                  this.digilockerName = c.name;
                  this.digilockerDob = c.dob;
                  this.go('digilocker_result');
                } else {
                  this.digilockerLoading = false;
                  this.showToast(result.error || 'DigiLocker unavailable. Please try Aadhaar OTP instead.', 'err');
                }
              } catch(e) {
                this.digilockerLoading = false;
                this.showToast('Failed to connect. Please try again.', 'err');
              }
            }}>
            Open DigiLocker →
          </button>
        }
      </div>
    );

    case 'digilocker_result': return (
      <div class="scr">
        <div class="verify-result ok" style={{ marginBottom: '16px' }}>
          <div class="vr-icon">✓</div>
          <div class="vr-body">
            <div class="vr-title">Aadhaar Verified via DigiLocker</div>
            <div class="vr-sub">Government-verified identity confirmed</div>
          </div>
        </div>
        <div class="data-card">
          <div class="d-row"><span class="d-lbl">Name</span><span class="d-val">{this.digilockerName || c.name}</span></div>
          {this.digilockerDob && <div class="d-row"><span class="d-lbl">Date of Birth</span><span class="d-val">{this.digilockerDob}</span></div>}
          <div class="d-row"><span class="d-lbl">Source</span><span class="d-val" style={{ color: 'var(--acc)' }}>✓ DigiLocker — Govt. Verified</span></div>
          <div class="d-row"><span class="d-lbl">POI Status</span><span class="d-val" style={{ color: 'var(--acc)' }}>✓ Verified</span></div>
          <div class="d-row"><span class="d-lbl">POA Status</span><span class="d-val" style={{ color: 'var(--acc)' }}>✓ Verified</span></div>
        </div>
        {this.renderNotice('ok', 'Your Aadhaar identity has been verified. Proceed to upload your supporting documents.')}
        <button class="btn-primary" onClick={() => this.go('full_doc')}>Continue to Document Upload</button>
      </div>
    );

    case 'full_aadhaar_otp': return (
      <div class="scr tc">
        <h3 class="sec-title">Aadhaar OTP Verification</h3>
        <p class="t2">OTP sent to the mobile linked with Aadhaar ending</p>
        <p style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '700', letterSpacing: '2px', color: 'var(--pri)', marginBottom: '16px' }}>
          XXXX XXXX {this.aadhaarNum.replace(/\s/g,'').slice(-4)}
        </p>
        {this.renderOtp('adho')}
        {this.renderOtpFooter('adho', this.maskedEnteredMobile, this.e164Mobile)}
        <button class="btn-primary" disabled={!this.otpFilled('adho') || this.otpLocked}
          onClick={() => this.verifyOtpCode('adho', this.e164Mobile, () => this.go('full_doc'))}>
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
        <h2 class="vkyc-done-title">Almost There!</h2>
        <p class="t2 tc" style={{ marginBottom: '16px' }}>PAN, Aadhaar and documents verified. One last step — complete your Video KYC session with a National Bank officer.</p>

        <div class="vkyc-steps-note" style={{ marginBottom: '20px' }}>
          <div class="vkyc-step-row">✓ <span>PAN verified</span></div>
          <div class="vkyc-step-row">✓ <span>Aadhaar validated</span></div>
          <div class="vkyc-step-row">✓ <span>Documents uploaded</span></div>
          <div class="vkyc-step-row pending">◉ <span>Video KYC — Pending</span></div>
        </div>

        <button class="btn-primary" style={{ marginBottom: '10px' }}
          onClick={async () => {
            const vkycApi = (window as any).__VKYC_API__ || '';
            if (vkycApi) {
              try {
                await fetch(`${vkycApi}/demo-config`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ applicant: { name: c.name, mobile: c.mobile, appId: this.customerId, product: (c as any).relationship || 'Banking Account', pan: this.panNum || c.pan, dob: this.panDob || c.dob, address: c.address } })
                });
              } catch(e) {}
            }
            await this.completeKyc('Full KYC');
            const vkycUi = (window as any).__VKYC_UI__;
            if (vkycUi) {
              window.location.href = `${vkycUi}?role=applicant&caseId=${this.customerId}`;
            } else {
              this.go('success');
            }
          }}>
          Proceed to Video KYC Now →
        </button>

        <button class="btn-secondary" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--pri)', background: '#fff', color: 'var(--pri)', font: '600 14px var(--font)', cursor: 'pointer' }}
          onClick={() => {
            this.scheduleSlots = this.generateScheduleSlots();
            this.scheduleDate = '';
            this.scheduleSlot = '';
            this.showVkycSchedule = true;
          }}>
          Schedule VKYC for Later
        </button>

        <div class="vkyc-later-notice" style={{ marginTop: '12px' }}>
          <div class="vkyc-later-text" style={{ fontSize: '12px' }}>
            <strong>Schedule VKYC for a convenient time.</strong> An SMS with your VKYC link will be sent and your slot will be reserved with a National Bank officer.
          </div>
        </div>

        {/* ── Schedule modal ── */}
        {this.showVkycSchedule && (
          <div class="sched-backdrop" onClick={() => { this.showVkycSchedule = false; }}>
            <div class="sched-modal" onClick={(e: any) => e.stopPropagation()}>
              <div class="sched-header">
                <div class="sched-title">Schedule Video KYC</div>
                <div class="sched-sub">Select a convenient date and time within the next 5 working days</div>
                <button class="sched-close" onClick={() => { this.showVkycSchedule = false; }}>✕</button>
              </div>

              <div class="sched-body">
                <div class="sched-step-label">Step 1 — Select a date</div>
                <div class="sched-cal">
                  {this.scheduleSlots.map(day => (
                    <button class={{ 'sched-date-card': true, 'sched-date-on': this.scheduleDate === day.date }}
                      onClick={() => { this.scheduleDate = day.date; this.scheduleSlot = ''; }}>
                      <div class="sched-dow">{day.label.split(',')[0]}</div>
                      <div class="sched-day">{day.label.split(', ')[1]?.split(' ')[0]}</div>
                      <div class="sched-mon">{day.label.split(', ')[1]?.split(' ')[1]}</div>
                      <div class="sched-avail">{day.slots.filter(s => s.available).length} slots</div>
                    </button>
                  ))}
                </div>

                {this.scheduleDate && (() => {
                  const day = this.scheduleSlots.find(d => d.date === this.scheduleDate);
                  if (!day) return null;
                  return (
                    <div>
                      <div class="sched-step-label">Step 2 — Pick a time on {day.label}</div>
                      <div class="sched-time-grid">
                        {day.slots.map(slot => {
                          const key = `${day.label} · ${slot.time}`;
                          return (
                            <button class={{ 'sched-slot': true, 'sched-slot-on': this.scheduleSlot === key, 'sched-slot-off': !slot.available }}
                              disabled={!slot.available}
                              onClick={() => { if (slot.available) this.scheduleSlot = key; }}>
                              {slot.time}
                              {!slot.available && <span class="sched-booked">Booked</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div class="sched-footer">
                <button class="sched-cancel" onClick={() => { this.showVkycSchedule = false; }}>Cancel</button>
                <button class="sched-confirm" disabled={!this.scheduleSlot}
                  onClick={() => this.scheduleVkyc()}>
                  Confirm &amp; Send VKYC Link
                </button>
              </div>
            </div>
          </div>
        )}
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

    case 'success': {
      const isScheduled = !!(this.scheduleSlot);
      return (
      <div class="scr tc">
        <div class="suc-icon" style={{ background: isScheduled ? 'linear-gradient(135deg,#074994,#3067A6)' : undefined }}>
          {isScheduled ? '📅' : '✓'}
        </div>
        <h2>{isScheduled ? 'VKYC Scheduled' : 'KYC Submitted Successfully'}</h2>
        <p class="t2" style={{ marginBottom: '12px' }}>
          {isScheduled
            ? <span>Thank you, <strong>{c.name.split(' ')[0]}</strong>. Your Video KYC session has been scheduled.</span>
            : <span>Thank you, <strong>{c.name.split(' ')[0]}</strong>. Your submission is under review.</span>
          }
        </p>

        {isScheduled
          ? <div>
              <div class="data-card" style={{ textAlign: 'left', marginTop: '12px', marginBottom: '12px' }}>
                <div class="d-row"><span class="d-lbl">VKYC Scheduled</span><span class="d-val" style={{ color: '#074994', fontWeight: '700' }}>{this.scheduleSlot}</span></div>
                <div class="d-row"><span class="d-lbl">Reference</span><span class="d-val" style={{ fontFamily: 'monospace', fontWeight: '700' }}>KYC-2026-{c.acct.slice(-4)}</span></div>
                <div class="d-row"><span class="d-lbl">Link Valid For</span><span class="d-val">3 days from now</span></div>
              </div>
              <div class="ref-card" style={{ background: '#EBF2FB', marginBottom: '14px', textAlign: 'left' }}>
                <div class="ref-label">WHAT HAPPENS NEXT</div>
                <div style={{ fontSize: '12.5px', color: 'var(--t2)', lineHeight: '1.7' }}>
                  ✓ A VKYC link has been sent to your registered mobile number.<br/>
                  ✓ Click the link at your scheduled time to join your Video KYC session.<br/>
                  ⚠ Please complete VKYC within <strong>3 days</strong> to finalise your KYC submission.<br/>
                  ✓ Keep your PAN card ready for the video session.
                </div>
              </div>
            </div>
          : <div>
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
                  Your details will be verified by the bank within 2–3 working days. You will receive a confirmation SMS and email once approved.
                </div>
              </div>
            </div>
        }
        <button class="btn-accent" style={{ marginTop: '16px' }} onClick={() => downloadAck(c.id, c.name, c.kycType || 'KYC Update')}>
          Download Acknowledgement
        </button>
        <button class="btn-primary" style={{ marginTop: '10px' }} onClick={() => this.reset()}>Back to Home</button>
      </div>
      );
    }

    default: return <div>Unknown screen</div>;
    }
  }
}
