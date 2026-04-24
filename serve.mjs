import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.join(__dirname, 'www');
const PORT = process.env.PORT || 3333;
const API_URL = process.env.API_URL || 'http://localhost:4000';

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  let url = req.url.split('?')[0];

  // All HTML routes serve index.html - rekyc-app router handles /bank vs /customer
  if (url === '/' || url === '/customer' || url === '/customer/' ||
      url === '/bank' || url === '/bank/') {
    return serveHtml(res, path.join(WWW, 'index.html'));
  }

  // Static files
  const fp = path.join(WWW, url);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    return serveStatic(res, fp);
  }

  // Fallback to index.html for SPA
  serveHtml(res, path.join(WWW, 'index.html'));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Re-KYC Frontend → port ${PORT}`);
  console.log(`  Customer: /customer`);
  console.log(`  Bank:     /bank`);
  console.log(`  API_URL:  ${API_URL}`);
  console.log(`  WWW dir:  ${WWW}`);
  console.log(`  WWW exists: ${fs.existsSync(WWW)}`);
  console.log(`  index.html exists: ${fs.existsSync(path.join(WWW, 'index.html'))}`);
  // List build dir
  const buildDir = path.join(WWW, 'build');
  if (fs.existsSync(buildDir)) {
    console.log(`  build/ files: ${fs.readdirSync(buildDir).join(', ')}`);
  } else {
    console.log(`  build/ dir MISSING`);
  }
});

function serveHtml(res, fp) {
  try {
    let html = fs.readFileSync(fp, 'utf-8');

    // Replace API URL placeholder
    html = html.replace(/%%API_URL%%/g, API_URL);

    // Dynamically find the hashed CSS file Stencil generated
    const buildDir = path.join(WWW, 'build');
    const buildFiles = fs.readdirSync(buildDir);
    const hashedCss = buildFiles.find(f => f.startsWith('p-') && f.endsWith('.css'));

    // Inject Stencil assets before </head> if not already present
    if (!html.includes('rekyc.esm.js')) {
      const cssLink = hashedCss ? `<link rel="stylesheet" href="/build/${hashedCss}">` : '';
      const inject = `${cssLink}
  <script type="module" src="/build/rekyc.esm.js"></script>
  <script nomodule src="/build/rekyc.js"></script>`;
      html = html.replace('</head>', `  ${inject}\n</head>`);
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
  } catch {
    res.writeHead(404); res.end('Not Found');
  }
}
