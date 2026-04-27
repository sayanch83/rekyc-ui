// ── API base URL ──
// At runtime, serve.mjs injects window.__REKYC_API__ via the HTML.
// Falls back to same-origin /api (when API is co-hosted) or localhost for dev.
export const API = (typeof window !== 'undefined' && (window as any).__REKYC_API__)
  || 'http://localhost:4000';

// ── Types ──
export interface DocOnFile {
  name: string;
  meta: string;
  valid: boolean;
}

export interface KycStep {
  status: string;
  date: string | null;
  type?: string;
  mode?: string;
}

export interface AgentGeo {
  time: string;
  location: string;
  distance: string;
  distanceOk: boolean;
}

export interface UploadedDoc {
  id: string;
  name: string;
  fileName: string;
  size: string;
  uploadedBy: string;
  uploadDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewDate: string | null;
  rejectReason: string | null;
  fileId: string | null;
}

export interface Reminder {
  ch: string;
  date: string;
  status: string;
}

export interface Customer {
  id: string;
  name: string;
  acct: string;
  mobile: string;
  email: string;
  dob: string;
  pan: string;
  aadhaar: string;
  constitution: string;
  address: string;
  due: string;
  status: string;
  kycType: string | null;
  relationship?: string;
  zone?: string;
  city?: string;
  assignedTo?: string | null;
  panStep?: KycStep | null;
  poiStep?: KycStep | null;
  poaStep?: KycStep | null;
  vkycStep?: KycStep | null;
  agentGeo?: AgentGeo | null;
  docsOnFile: DocOnFile[];
  reminders: Reminder[];
  linkActive: boolean;
  linkExpiry: string | null;
  source: string | null;
  agent: { name: string; date: string } | null;
  completedDate: string | null;
  documents: UploadedDoc[];
}

// ── API calls ──
export async function fetchCustomers(): Promise<Customer[]> {
  const r = await fetch(`${API}/api/customers`);
  return r.json();
}

export async function fetchCustomer(id: string): Promise<Customer> {
  const r = await fetch(`${API}/api/customers/${id}`);
  return r.json();
}

export async function updateCustomer(id: string, body: Partial<Customer>): Promise<Customer> {
  const r = await fetch(`${API}/api/customers/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function uploadDocument(custId: string, file: File, docName: string, uploadedBy = 'Customer'): Promise<UploadedDoc> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('docName', docName);
  fd.append('uploadedBy', uploadedBy);
  const r = await fetch(`${API}/api/customers/${custId}/documents`, { method: 'POST', body: fd });
  return r.json();
}

export async function reviewDocument(custId: string, docId: string, action: 'approve' | 'reject', reason = '', reviewer = 'Bank Officer'): Promise<UploadedDoc> {
  const r = await fetch(`${API}/api/customers/${custId}/documents/${docId}/review`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason, reviewer }),
  });
  return r.json();
}

export async function sendOtp(mobile: string): Promise<{ ok: boolean; via?: string; hint?: string; error?: string }> {
  try {
    const r = await fetch(`${API}/api/otp/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile }),
    });
    return r.json();
  } catch(e) { return { ok: false, error: 'Network error' }; }
}

export async function verifyOtp(mobile: string, otp: string): Promise<{ ok: boolean; error?: string; attemptsLeft?: number; expired?: boolean; locked?: boolean }> {
  try {
    const r = await fetch(`${API}/api/otp/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, otp }),
    });
    const data = await r.json();
    if (!r.ok) return data;
    return data;
  } catch(e) { return { ok: false, error: 'Network error' }; }
}

export async function saveFcmToken(custId: string, token: string): Promise<void> {
  await fetch(`${API}/api/customers/${custId}/fcm-token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

export async function regenLink(custId: string): Promise<Customer> {
  const r = await fetch(`${API}/api/customers/${custId}/regen-link`, { method: 'POST' });
  return r.json();
}

export function fileUrl(fileId: string): string {
  return `${API}/api/files/${fileId}`;
}

// ── Consent items for self-declaration ──
export const CONSENT_ITEMS = [
  'I declare that the personal information, address, and identity documents currently on file are true, correct, and up-to-date.',
  'I understand that providing false information is an offence under PMLA 2002 and may lead to account closure or legal action.',
  'I consent to the bank verifying my KYC details with UIDAI, NSDL, and other relevant authorities.',
];

// ── KYC reason checkboxes ──
export const KYC_REASONS = [
  { key: 'doc_expiry', label: 'KYC document validity expiring soon', sub: 'Document nearing expiry or needs renewal' },
  { key: 'identity', label: 'Name / identity details changed', sub: 'Legal name change, gender update, etc.' },
  { key: 'constitution', label: 'Constitution type changed', sub: 'Individual to sole proprietor, HUF, etc.' },
];

// ── Firebase config (public keys — safe to expose in frontend) ──
// Set these as %%FIREBASE_*%% placeholders — serve.mjs replaces them at runtime
export const FIREBASE_CONFIG = {
  apiKey: typeof window !== 'undefined' ? (window as any).__FIREBASE_API_KEY__ || '' : '',
  authDomain: typeof window !== 'undefined' ? (window as any).__FIREBASE_AUTH_DOMAIN__ || '' : '',
  projectId: typeof window !== 'undefined' ? (window as any).__FIREBASE_PROJECT_ID__ || '' : '',
  messagingSenderId: typeof window !== 'undefined' ? (window as any).__FIREBASE_SENDER_ID__ || '' : '',
  appId: typeof window !== 'undefined' ? (window as any).__FIREBASE_APP_ID__ || '' : '',
};

export function firebaseConfigured(): boolean {
  return !!(FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.apiKey);
}
