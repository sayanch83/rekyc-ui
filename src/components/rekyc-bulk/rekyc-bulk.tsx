import { Component, h, State } from '@stencil/core';
import { API } from '../../utils/constants';

interface UploadRow { name: string; mobile: string; email: string; acct: string; relationship: string; zone: string; due: string; risk: string; }
interface ErrorRow extends UploadRow { error: string; row: number; }
interface ResultRow extends UploadRow { id: string; status: 'created' | 'duplicate' | 'error'; error?: string; }

@Component({ tag: 'rekyc-bulk', styleUrl: 'rekyc-bulk.css', shadow: false })
export class ReKycBulk {
  @State() step: 'upload' | 'preview' | 'processing' | 'done' = 'upload';
  @State() rows: UploadRow[] = [];
  @State() results: ResultRow[] = [];
  @State() errors: ErrorRow[] = [];
  @State() processing = false;
  @State() fileName = '';
  @State() dragOver = false;

  get created() { return this.results.filter(r => r.status === 'created').length; }
  get duplicates() { return this.results.filter(r => r.status === 'duplicate').length; }
  get failed() { return this.results.filter(r => r.status === 'error').length; }

  async parseFile(file: File) {
    this.fileName = file.name;
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_'));

    const idx = (name: string) => headers.findIndex(h => h.includes(name));
    const nameIdx    = idx('name');
    const mobileIdx  = idx('mobile') >= 0 ? idx('mobile') : idx('phone');
    const emailIdx   = idx('email');
    const acctIdx    = idx('acct') >= 0 ? idx('acct') : idx('account');
    const relIdx     = idx('relation') >= 0 ? idx('relation') : idx('type');
    const zoneIdx    = idx('zone');
    const dueIdx     = idx('due');
    const riskIdx    = idx('risk');

    const rows: UploadRow[] = [];
    const errors: ErrorRow[] = [];

    lines.slice(1).forEach((line, i) => {
      if (!line.trim()) return;
      const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g,''));
      const row: UploadRow = {
        name: cols[nameIdx] || '',
        mobile: cols[mobileIdx] || '',
        email: cols[emailIdx] || '',
        acct: cols[acctIdx] || '',
        relationship: cols[relIdx] || 'Savings Account',
        zone: cols[zoneIdx] || 'West',
        due: cols[dueIdx] || '30 Apr 2026',
        risk: cols[riskIdx] || 'Low',
      };

      const rowErrors = [];
      if (!row.name) rowErrors.push('Name missing');
      if (!row.mobile || !/^\+?91?\d{10}$/.test(row.mobile.replace(/\s/g,''))) rowErrors.push('Invalid mobile');
      if (!row.acct) rowErrors.push('Account number missing');

      if (rowErrors.length) errors.push({ ...row, error: rowErrors.join('; '), row: i + 2 });
      else rows.push(row);
    });

    this.rows = rows;
    this.errors = errors;
    if (rows.length > 0 || errors.length > 0) this.step = 'preview';
  }

  async processUpload() {
    this.step = 'processing';
    this.processing = true;
    const results: ResultRow[] = [];

    // Fetch existing customers to check duplicates
    const existingResp = await fetch(`${API}/api/customers`);
    const existing: any[] = await existingResp.json();
    const existingAccts = new Set(existing.map(c => c.acct));
    const existingMobiles = new Set(existing.map(c => c.mobile?.replace(/\D/g,'')));

    for (const row of this.rows) {
      const mobileDigits = row.mobile.replace(/\D/g,'');
      const acctClean = row.acct.replace(/\D/g,'').slice(-4);

      // Check duplicate
      if (existingAccts.has(`XXXX${acctClean}`) || existingAccts.has(row.acct)) {
        results.push({ ...row, id: '', status: 'duplicate', error: `Account ${row.acct} already exists in dashboard` });
        continue;
      }
      if (existingMobiles.has(mobileDigits)) {
        results.push({ ...row, id: '', status: 'duplicate', error: `Mobile number already registered for another customer` });
        continue;
      }

      // Create new customer record
      try {
        const newId = `KYC-${Date.now().toString().slice(-4)}${Math.floor(Math.random()*1000)}`;
        const mobileFormatted = `+91 ${mobileDigits.slice(-10)}`;
        const validRisks = ['Low','Medium','High'];
        const riskVal = validRisks.includes(row.risk) ? row.risk : 'Low';
        const payload = {
          id: newId, name: row.name, acct: `XXXX${acctClean}`,
          mobile: mobileFormatted, email: row.email,
          dob: '', pan: 'PENDING', aadhaar: 'PENDING',
          constitution: 'Individual', relationship: row.relationship,
          address: '', zone: row.zone, city: '', assignedTo: null,
          due: row.due, status: 'Link Generated', kycType: null, risk: riskVal,
          docsOnFile: [], reminders: [{ ch: 'System', date: new Date().toLocaleDateString('en-IN'), status: 'Record created via bulk upload' }],
          linkActive: true, linkExpiry: row.due + ', 11:59 PM',
          source: null, agent: null, completedDate: null, agentGeo: null,
          documents: [], panStep: null, poiStep: null, poaStep: null, vkycStep: null,
        };
        const r = await fetch(`${API}/api/customers/bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (r.ok) {
          results.push({ ...row, id: newId, status: 'created' });
          // Fix 3: Send SMS link automatically after record is created
          fetch(`${API}/api/customers/${newId}/regen-link`, { method: 'POST' })
            .catch(() => {}); // fire-and-forget — don't block on SMS failure
        } else {
          results.push({ ...row, id: '', status: 'error', error: 'API error creating record' });
        }
      } catch(e) {
        results.push({ ...row, id: '', status: 'error', error: 'Network error' });
      }
    }

    // Add validation errors as error rows
    this.errors.forEach(e => results.push({ ...e, id: '', status: 'error' }));

    this.results = results;
    this.processing = false;
    this.step = 'done';
  }

  downloadErrorReport() {
    const errorRows = this.results.filter(r => r.status !== 'created');
    if (errorRows.length === 0) return;
    const csv = [
      'Row,Name,Mobile,Account,Relationship,Zone,Risk,Status,Error',
      ...errorRows.map((r, i) => `${i+1},"${r.name}","${r.mobile}","${r.acct}","${r.relationship}","${r.zone}","${r.risk || 'Low'}","${r.status}","${r.error || ''}"`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rekyc-upload-errors-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  downloadTemplate() {
    const csv = 'Name,Mobile,Email,Account Number,Relationship Type,Zone,Due Date,Risk\nRajesh Kumar,+919876543210,rajesh@email.com,XXXX1234,Savings Account,West,30 Apr 2026,Low';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rekyc-bulk-upload-template.csv';
    a.click();
  }

  render() {
    return (
      <div class="bulk-wrap">
        <div class="bulk-header">
          <div>
            <div class="bulk-title">Bulk Re-KYC Upload</div>
            <div class="bulk-sub">Upload customer list to generate Re-KYC records</div>
          </div>
          <button class="bulk-template-btn" onClick={() => this.downloadTemplate()}>
            ⬇ Download Template
          </button>
        </div>

        {/* Step: Upload */}
        {this.step === 'upload' && (
          <div class="bulk-body">
            <div class="upload-instructions">
              <div class="inst-title">Required columns in your CSV:</div>
              <div class="inst-cols">
                {['Name *', 'Mobile *', 'Email', 'Account Number *', 'Relationship Type', 'Zone', 'Due Date'].map(c =>
                  <span class={c.includes('*') ? 'col-badge required' : 'col-badge'}>{c}</span>
                )}
              </div>
            </div>
            <label
              class={{ 'drop-zone': true, 'drag-over': this.dragOver }}
              onDragOver={(e: any) => { e.preventDefault(); this.dragOver = true; }}
              onDragLeave={() => this.dragOver = false}
              onDrop={(e: any) => { e.preventDefault(); this.dragOver = false; const f = e.dataTransfer.files[0]; if (f) this.parseFile(f); }}>
              <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                onChange={(e: any) => { const f = e.target.files[0]; if (f) this.parseFile(f); }} />
              <div class="drop-icon">📂</div>
              <div class="drop-title">Drop CSV file here or click to browse</div>
              <div class="drop-sub">Supports .csv files • Max 1000 rows</div>
            </label>
          </div>
        )}

        {/* Step: Preview */}
        {this.step === 'preview' && (
          <div class="bulk-body">
            <div class="preview-summary">
              <div class="ps-item ok"><span class="ps-num">{this.rows.length}</span><span>Valid records</span></div>
              <div class="ps-item err"><span class="ps-num">{this.errors.length}</span><span>Validation errors</span></div>
              <div class="ps-item neutral"><span class="ps-num">{this.rows.length + this.errors.length}</span><span>Total rows</span></div>
              <div class="ps-file">📄 {this.fileName}</div>
            </div>

            {this.errors.length > 0 && (
              <div class="preview-errors">
                <div class="pe-title">⚠ Validation Errors (will be skipped)</div>
                {this.errors.map(e =>
                  <div class="pe-row"><span class="pe-row-num">Row {e.row}</span><span class="pe-name">{e.name || '(empty)'}</span><span class="pe-error">{e.error}</span></div>
                )}
              </div>
            )}

            {this.rows.length > 0 && (
              <div class="preview-table-wrap">
                <div class="pt-title">Records to be created ({this.rows.length})</div>
                <table class="preview-table">
                  <thead><tr><th>Name</th><th>Mobile</th><th>Account</th><th>Relationship</th><th>Zone</th><th>Risk</th><th>Due</th></tr></thead>
                  <tbody>
                    {this.rows.slice(0,10).map(r =>
                      <tr><td>{r.name}</td><td>{r.mobile}</td><td>{r.acct}</td><td>{r.relationship}</td><td>{r.zone}</td><td>{r.risk || 'Low'}</td><td>{r.due}</td></tr>
                    )}
                    {this.rows.length > 10 && <tr><td colSpan={6} class="more-rows">... and {this.rows.length - 10} more rows</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            <div class="preview-actions">
              <button class="bulk-btn-secondary" onClick={() => { this.step = 'upload'; this.rows = []; this.errors = []; }}>← Back</button>
              <button class="bulk-btn-primary" disabled={this.rows.length === 0} onClick={() => this.processUpload()}>
                Create {this.rows.length} Records →
              </button>
            </div>
          </div>
        )}

        {/* Step: Processing */}
        {this.step === 'processing' && (
          <div class="bulk-body bulk-processing">
            <div class="proc-spinner" />
            <div class="proc-title">Creating records...</div>
            <div class="proc-sub">Processing {this.rows.length} customers. Please wait.</div>
          </div>
        )}

        {/* Step: Done */}
        {this.step === 'done' && (
          <div class="bulk-body">
            <div class="done-summary">
              <div class="done-stat ok">
                <div class="done-num">{this.created}</div>
                <div class="done-lbl">Records Created</div>
                <div class="done-desc">Added to dashboard as "Link Generated"</div>
              </div>
              <div class="done-stat warn">
                <div class="done-num">{this.duplicates}</div>
                <div class="done-lbl">Duplicates Skipped</div>
                <div class="done-desc">Already exist in the system</div>
              </div>
              <div class="done-stat err">
                <div class="done-num">{this.failed}</div>
                <div class="done-lbl">Errors</div>
                <div class="done-desc">Could not be processed</div>
              </div>
            </div>

            {(this.duplicates + this.failed) > 0 && (
              <div class="done-errors">
                <div class="de-header">
                  <div class="de-title">Skipped / Error Records</div>
                  <button class="bulk-btn-secondary small" onClick={() => this.downloadErrorReport()}>
                    ⬇ Download Error Report
                  </button>
                </div>
                <table class="preview-table">
                  <thead><tr><th>Name</th><th>Account</th><th>Status</th><th>Reason</th></tr></thead>
                  <tbody>
                    {this.results.filter(r => r.status !== 'created').map(r =>
                      <tr>
                        <td>{r.name}</td>
                        <td>{r.acct}</td>
                        <td><span class={r.status === 'duplicate' ? 'status-dup' : 'status-err'}>{r.status === 'duplicate' ? 'Duplicate' : 'Error'}</span></td>
                        <td class="error-msg">{r.error}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div class="preview-actions">
              <button class="bulk-btn-secondary" onClick={() => { this.step = 'upload'; this.rows = []; this.errors = []; this.results = []; }}>Upload Another File</button>
              {this.created > 0 && <div class="done-note">✓ Refresh the dashboard to see the new records</div>}
            </div>
          </div>
        )}
      </div>
    );
  }
}
