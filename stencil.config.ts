import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'rekyc',
  globalStyle: 'src/global/app.css',
  outputTargets: [
    { type: 'www', serviceWorker: null, baseUrl: '/', copy: [{ src: 'pages' }] },
  ],
  devServer: { reloadStrategy: 'hmr' },
};
