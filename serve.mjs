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

  if (url === '/bank' || url === '/bank/') {
    return serveHtml(res, path.join(WWW, 'pages', 'bank.html'));
  }
  if (url === '/' || url === '/customer' || url === '/customer/') {
    return serveHtml(res, path.join(WWW, 'index.html'));
  }

  const fp = path.join(WWW, url);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    return serveStatic(res, fp);
  }

  serveHtml(res, path.join(WWW, 'index.html'));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Re-KYC Frontend → port ${PORT}`);
  console.log(`  Customer: /customer`);
  console.log(`  Bank:     /bank`);
  console.log(`  API_URL:  ${API_URL}`);
});

function serveHtml(res, fp) {
  try {
    let html = fs.readFileSync(fp, 'utf-8');
    html = html.replace(/%%API_URL%%/g, API_URL);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } catch {
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
