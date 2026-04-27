import { Component, h, State } from '@stencil/core';

@Component({ tag: 'rekyc-app', styleUrl: 'rekyc-app.css' })
export class RekycApp {
  @State() role: 'customer' | 'bank' | 'config' = 'customer';

  componentWillLoad() {
    const p = window.location.pathname;
    if (p.includes('/bank')) this.role = 'bank';
    else if (p.includes('/config')) this.role = 'config';
    else this.role = 'customer';
  }

  render() {
    if (this.role === 'bank') return <rekyc-bank />;
    if (this.role === 'config') return <rekyc-config />;
    return <rekyc-customer customerId="KYC-4528" />;
  }
}
