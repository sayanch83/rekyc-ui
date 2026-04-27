import { Component, h, State } from '@stencil/core';
import { validateLinkToken } from '../../utils/constants';

@Component({ tag: 'rekyc-app', styleUrl: 'rekyc-app.css' })
export class RekycApp {
  @State() role: 'customer' | 'bank' | 'config' = 'customer';
  @State() customerId: string = 'KYC-4528';
  @State() linkToken: string = '';
  @State() ready = false; // don't render until token resolved

  async componentWillLoad() {
    const p = window.location.pathname;
    if (p.includes('/bank')) {
      this.role = 'bank';
      this.ready = true;
      return;
    }
    if (p.includes('/config')) {
      this.role = 'config';
      this.ready = true;
      return;
    }

    this.role = 'customer';
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const urlId = params.get('id') || params.get('custId');

    if (token) {
      // Resolve token → custId HERE at the router level
      // so the correct customerId is passed as Prop when component first mounts
      this.linkToken = token;
      try {
        const result = await validateLinkToken(token);
        if (result.valid && result.custId) {
          this.customerId = result.custId;
        }
      } catch(e) {
        // Network error — component will handle gracefully
      }
    } else if (urlId) {
      this.customerId = urlId;
    }

    this.ready = true;
  }

  render() {
    if (!this.ready) return <div class="loading" />;
    if (this.role === 'bank') return <rekyc-bank />;
    if (this.role === 'config') return <rekyc-config />;
    // Pass resolved customerId and linkToken as Props — component gets correct values from mount
    return <rekyc-customer customerId={this.customerId} linkToken={this.linkToken} />;
  }
}
