import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.join(__dirname, 'www');
const PORT = process.env.PORT || 3333;
const API_URL = process.env.API_URL || 'http://localhost:4000';

// Firebase public config (safe to expose — these are client-side keys)
const FB = {
  API_KEY:     process.env.FIREBASE_WEB_API_KEY || '',
  AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || '',
  PROJECT_ID:  process.env.FIREBASE_PROJECT_ID  || '',
  SENDER_ID:   process.env.FIREBASE_SENDER_ID   || '',
  APP_ID:      process.env.FIREBASE_APP_ID      || '',
  VAPID_KEY:   process.env.FIREBASE_VAPID_KEY   || '',
};

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

// Firebase service worker content — served dynamically with env vars injected
function firebaseSW() {
  return `importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: "${FB.API_KEY}", authDomain: "${FB.AUTH_DOMAIN}",
  projectId: "${FB.PROJECT_ID}", messagingSenderId: "${FB.SENDER_ID}", appId: "${FB.APP_ID}"
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon-192.png',
    data: payload.data,
  });
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const custId = e.notification.data?.custId;
  e.waitUntil(clients.openWindow(custId ? '/customer?id=' + custId : '/customer'));
});`;
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Serve Firebase service worker with injected config
  if (url === '/firebase-messaging-sw.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/' });
    res.end(firebaseSW());
    return;
  }

  if (url === '/' || url === '/customer' || url === '/customer/' ||
      url === '/bank' || url === '/bank/') {
    return serveHtml(res, path.join(WWW, 'index.html'));
  }

  const fp = path.join(WWW, url);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return serveStatic(res, fp);
  serveHtml(res, path.join(WWW, 'index.html'));

}).listen(PORT, '0.0.0.0', () => {
  console.log(`Re-KYC Frontend → port ${PORT}`);
  console.log(`  API_URL:     ${API_URL}`);
  console.log(`  Firebase:    ${FB.PROJECT_ID ? 'configured' : 'not configured'}`);
  const buildDir = path.join(WWW, 'build');
  if (fs.existsSync(buildDir)) console.log(`  build/ files: ${fs.readdirSync(buildDir).join(', ')}`);
});

function serveHtml(res, fp) {
  try {
    let html = fs.readFileSync(fp, 'utf-8');
    html = html.replace(/%%API_URL%%/g, API_URL);
    // Inject Firebase public config
    html = html.replace('window.__REKYC_API__', `
      window.__FIREBASE_API_KEY__ = '${FB.API_KEY}';
      window.__FIREBASE_AUTH_DOMAIN__ = '${FB.AUTH_DOMAIN}';
      window.__FIREBASE_PROJECT_ID__ = '${FB.PROJECT_ID}';
      window.__FIREBASE_SENDER_ID__ = '${FB.SENDER_ID}';
      window.__FIREBASE_APP_ID__ = '${FB.APP_ID}';
      window.__FIREBASE_VAPID_KEY__ = '${FB.VAPID_KEY}';
      window.__REKYC_API__`);

    const buildDir = path.join(WWW, 'build');
    const buildFiles = fs.readdirSync(buildDir);
    const hashedCss = buildFiles.find(f => f.startsWith('p-') && f.endsWith('.css'));
    if (!html.includes('rekyc.esm.js')) {
      const cssLink = hashedCss ? `<link rel="stylesheet" href="/build/${hashedCss}">` : '';
      html = html.replace('</head>', `  ${cssLink}\n  <script type="module" src="/build/rekyc.esm.js"></script>\n  <script nomodule src="/build/rekyc.js"></script>\n</head>`);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } catch (e) {
    console.error('serveHtml error:', e.message);
    res.writeHead(404); res.end('Not Found');
  }
}

function serveStatic(res, fp) {
  const ext = path.extname(fp);
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(fp);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not Found'); }
}

