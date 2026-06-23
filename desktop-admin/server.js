const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');

const DIST = path.join(__dirname, '..', 'dist-admin');
const REMOTE_HOST = 'foodchain-qpxh.onrender.com';

function proxyReq(req, res) {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const pathname = '/api' + (req.url.includes('?') ? req.url.slice(0, req.url.indexOf('?')) : req.url);

  const body = JSON.stringify(req.body || {});
  const opts = {
    hostname: REMOTE_HOST,
    port: 443,
    path: pathname + qs,
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Host': REMOTE_HOST,
      'Origin': `https://${REMOTE_HOST}`,
      'Authorization': req.headers.authorization || '',
      'Cookie': req.headers.cookie || '',
    },
  };

  const proxyReq = https.request(opts, (proxyRes) => {
    const chunks = [];
    proxyRes.on('data', c => chunks.push(c));
    proxyRes.on('end', () => {
      const data = Buffer.concat(chunks);
      const contentType = proxyRes.headers['content-type'] || '';
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'access-control-allow-origin': '*',
      });
      res.end(data);
    });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) res.status(502).json({ error: 'Bad gateway' });
  });

  proxyReq.write(body);
  proxyReq.end();
}

module.exports = function createServer(port) {
  const app = express();

  app.use(express.json());

  app.use('/api', (req, res) => {
    proxyReq(req, res);
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
