import { Component, h, State } from '@stencil/core';
import { validateLinkToken } from '../../utils/constants';

@Component({ tag: 'rekyc-app', styleUrl: 'rekyc-app.css' })
export class RekycApp {
  @State() role: 'customer' | 'bank' | 'config' = 'customer';
  @State() customerId: string = 'KYC-4528';
  @State() ready = false;

  async componentWillLoad() {
    const p = window.location.pathname;
    if (p.includes('/bank')) { this.role = 'bank'; this.ready = true; return; }
    if (p.includes('/config')) { this.role = 'config'; this.ready = true; return; }

    this.role = 'customer';
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const urlId = params.get('id') || params.get('custId');

    if (token) {
      try {
        const result = await validateLinkToken(token);
        if (result.valid && result.custId) {
          this.customerId = result.custId;
          // Persist custId to localStorage so reopening after completion shows correct customer
          localStorage.setItem(`rekyc_cust_${token.slice(0,8)}`, result.custId);
          localStorage.setItem('rekyc_last_cust_id', result.custId);
        }
        sessionStorage.setItem('rekyc_link_token', token);
        sessionStorage.setItem('rekyc_masked_mobile', result.maskedMobile || '');
        sessionStorage.setItem('rekyc_cust_id', result.custId || '');
      } catch(e) {
        sessionStorage.setItem('rekyc_link_token', token);
        // Token invalid/consumed — try to recover custId from localStorage
        const lastCustId = localStorage.getItem('rekyc_last_cust_id');
        if (lastCustId) {
          this.customerId = lastCustId;
          sessionStorage.setItem('rekyc_cust_id', lastCustId);
        }
      }
      window.history.replaceState({}, '', '/customer');
    } else if (urlId) {
      this.customerId = urlId;
      window.history.replaceState({}, '', '/customer');
    }

    this.ready = true;
  }

  render() {
    if (!this.ready) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0D1F35' }}><div style={{ color: '#fff', opacity: '0.6', fontSize: '14px' }}>Loading...</div></div>;
    if (this.role === 'bank') return <rekyc-bank />;
    if (this.role === 'config') return <rekyc-config />;
    return <rekyc-customer customerId={this.customerId} />;
  }
}
