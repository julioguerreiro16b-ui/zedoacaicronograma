const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const handler = require('../api/records.js');
const root = path.resolve(__dirname, '..');
const files = new Set(['index.html','schedule-core.js','sync-store.js','app.js','cronograma_para_imprimir.html','cronograma_para_imprimir.pdf']);
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/records') return handler(req, res);
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!files.has(file)) { res.writeHead(404); res.end('Não encontrado'); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.pdf') ? 'application/pdf' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(root, file)));
}).listen(3000, '127.0.0.1', () => console.log('Painel em http://localhost:3000'));
