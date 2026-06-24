const express = require('express');
const path = require('path');
const fs = require('fs');

const DIST = require('electron').app?.isPackaged
  ? path.join(process.resourcesPath, 'dist-admin')
  : path.join(__dirname, '..', 'dist-admin');
const REMOTE_HOST = 'foodchain-qpxh.onrender.com';

function proxyToRemote(req, res, prefix) {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const pathname = prefix + (req.url.includes('?') ? req.url.slice(0, req.url.indexOf('?')) : req.url);

  const body = req.body ? JSON.stringify(req.body) : undefined;
  const https = require('https');
  const opts = {
    hostname: REMOTE_HOST,
    port: 443,
    path: pathname + qs,
    method: req.method,
    headers: {
      'Host': REMOTE_HOST,
      'Origin': `https://${REMOTE_HOST}`,
      'Authorization': req.headers.authorization || '',
      'Cookie': req.headers.cookie || '',
    },
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.headers['Content-Length'] = Buffer.byteLength(body);
  }

  const proxyReq = https.request(opts, (proxyRes) => {
    const chunks = [];
    proxyRes.on('data', c => chunks.push(c));
    proxyRes.on('end', () => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'access-control-allow-origin': '*',
      });
      res.end(Buffer.concat(chunks));
    });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) res.status(502).json({ error: 'Bad gateway' });
  });

  if (body) proxyReq.write(body);
  proxyReq.end();
}

module.exports = function createServer(port) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.use('/api', (req, res) => {
    proxyToRemote(req, res, '/api');
  });

  app.use('/uploads', (req, res) => {
    proxyToRemote(req, res, '/uploads');
  });

  app.get(/^\/(?!api).*$/, (req, res, next) => {
    const filePath = path.join(DIST, req.path === '/' ? 'index.html' : req.path);
    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      let content = fs.readFileSync(filePath, 'utf-8');
      if (req.path.endsWith('.html') || req.path === '/' || req.path.endsWith('/')) {
        content = content.replace(
          '</head>',
          `<script>localStorage.setItem('foodchain_api_url','http://localhost:${port}');</script></head>`
        );
      }
      const ext = path.extname(filePath);
      const mime = {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
        '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
      };
      res.type(mime[ext] || 'application/octet-stream');
      return res.send(content);
    }
    next();
  });

  app.get('/*', (req, res) => {
    const indexPath = path.join(DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
      let content = fs.readFileSync(indexPath, 'utf-8');
      content = content.replace(
        '</head>',
        `<script>localStorage.setItem('foodchain_api_url','http://localhost:${port}');</script></head>`
      );
      res.type('text/html').send(content);
    } else {
      res.status(404).send('Not found');
    }
  });

  return app;
};
