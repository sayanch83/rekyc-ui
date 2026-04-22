import { Component, h, State } from '@stencil/core';

@Component({ tag: 'rekyc-app', styleUrl: 'rekyc-app.css' })
export class RekycApp {
  @State() role: 'customer' | 'bank' = 'customer';

  componentWillLoad() {
    const p = window.location.pathname;
    if (p.includes('/bank')) this.role = 'bank';
    else this.role = 'customer';
  }

  render() {
    if (this.role === 'bank') return <rekyc-bank />;
    return <rekyc-customer customerId="KYC-4528" />;
  }
}
