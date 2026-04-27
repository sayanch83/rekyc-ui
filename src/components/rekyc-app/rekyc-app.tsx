import { Component, h, State } from '@stencil/core';

@Component({ tag: 'rekyc-app', styleUrl: 'rekyc-app.css' })
export class RekycApp {
  @State() role: 'customer' | 'bank' | 'config' = 'customer';
  @State() customerId: string = 'KYC-4528';

  componentWillLoad() {
    const p = window.location.pathname;
    if (p.includes('/bank')) this.role = 'bank';
    else if (p.includes('/config')) this.role = 'config';
    else {
      this.role = 'customer';
      // Read custId from URL if present (legacy ?id= links)
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id') || params.get('custId');
      if (urlId) this.customerId = urlId;
      // ?token= links are handled inside rekyc-customer componentWillLoad
    }
  }

  render() {
    if (this.role === 'bank') return <rekyc-bank />;
    if (this.role === 'config') return <rekyc-config />;
    return <rekyc-customer customerId={this.customerId} />;
  }
}
