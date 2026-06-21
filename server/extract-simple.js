/**
 * Simple line-by-line route extraction script.
 * Finds app.METHOD('/path', lines and tracks brace depth to extract handler.
 */
const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8').split('\n');

// Route group configuration
const groups = [
  { file: 'auth.js', patterns: ['/api/auth/', '/api/staff/login', '/api/courier/login', '/api/tenants/'] },
  { file: 'orders.js', patterns: ['/api/orders', '/api/order-splits', '/api/website/orders'] },
  { file: 'menu.js', patterns: ['/api/menu-items', '/api/dishes', '/api/menu-categories', '/api/tables', '/api/categories', '/api/dishes-food-cost'] },
  { file: 'tech-cards.js', patterns: ['/api/tech-card', '/api/tech-cards'] },
  { file: 'inventory.js', patterns: ['/api/inventory-items', '/api/inventory', '/api/stock-item', '/api/stock-items', '/api/forecast', '/api/barcode'] },
  { file: 'couriers.js', patterns: ['/api/courier-guest-chats', '/api/courier/templates', '/api/couriers/', '/api/courier/', '/api/returning-couriers'] },
  { file: 'clients.js', patterns: ['/api/users', '/api/clients', '/api/client-groups', '/api/review-questions', '/api/notifications/', '/api/reviews', '/api/guests/'] },
  { file: 'bookings.js', patterns: ['/api/bookings', '/api/booking'] },
  { file: 'admin.js', patterns: ['/api/admin/'] },
  { file: 'suppliers.js', patterns: ['/api/suppliers', '/api/supplier-portal'] },
  { file: 'finance.js', patterns: ['/api/finance', '/api/dashboard', '/api/reports/', '/api/accounts', '/api/journal', '/api/audit-logs', '/api/documents', '/api/salary', '/api/currency', '/api/wholesale-prices'] },
  { file: 'payments.js', patterns: ['/api/payment-methods', '/api/terminal/pay', '/api/terminal/status', '/api/terminal/cancel'] },
  { file: 'telegram.js', patterns: ['/api/telegram-bot'] },
  { file: 'staff.js', patterns: ['/api/staff', '/api/themes', '/api/staff-chats', '/api/staff-roles', '/api/staff-schedule'] },
  { file: 'aggregator.js', patterns: ['/api/aggregator'] },
  { file: 'loyalty.js', patterns: ['/api/loyalty', '/api/bonuses', '/api/certificates', '/api/discounts', '/api/loyalty-levels', '/api/kpi-targets', '/api/kpi-results', '/api/promocodes', '/api/campaigns', '/api/marketing'] },
  { file: 'branding.js', patterns: ['/api/branding', '/api/site-settings'] },
  { file: 'settings.js', patterns: ['/api/settings', '/api/push-settings', '/api/tenant-mode', '/api/tenant-limits'] },
  { file: 'misc.js', patterns: [] },
];

function matchGroup(routePath) {
  for (const g of groups) {
    if (g.patterns.length === 0) continue;
    for (const p of g.patterns) {
      if (routePath === p || routePath.startsWith(p)) return g;
    }
  }
  return groups.find(g => g.patterns.length === 0);
}

// Parse routes
const routes = [];
let inString = false;
let stringChar = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Match app.METHOD('/path',
  const m = trimmed.match(/^app\.(get|post|put|delete|patch)\('([^']+)'/);
  if (!m) continue;
  
  const method = m[1];
  const routePath = m[2];
  const startLine = i;
  
  // Now find where this handler ends by tracking braces
  let braceDepth = 0;
  let parenDepth = 0;
  let bodyStarted = false;
  let inStr = false, strChar = null;
  let inBlockComment = false;
  let endLine = -1;
  
  for (let j = i; j < lines.length; j++) {
    const l = lines[j];
    for (let k = 0; k < l.length; k++) {
      const ch = l[k];
      const next = k + 1 < l.length ? l[k+1] : '';
      const prev = k > 0 ? l[k-1] : '';
      
      // Block comment handling (takes priority over strings)
      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          k++; // skip the '/'
        }
        continue;
      }
      
      // Single-line comment
      if (!inStr && ch === '/' && next === '/') {
        break; // skip rest of line
      }
      // Block comment start
      if (!inStr && ch === '/' && next === '*') {
        inBlockComment = true;
        k++; // skip the '*'
        continue;
      }
      
      // String tracking
      if (!inStr) {
        if ((ch === "'" || ch === '"' || ch === '`') && prev !== '\\') {
          inStr = true;
          strChar = ch;
        }
      } else if (ch === strChar && prev !== '\\') {
        inStr = false;
        strChar = null;
        continue;
      }
      
      if (inStr) continue;
      
      // Depth tracking
      if (ch === '(') { parenDepth++; }
      else if (ch === ')') { parenDepth--; bodyStarted = true; }
      else if (ch === '{') { braceDepth++; if (!bodyStarted) bodyStarted = true; }
      else if (ch === '}') { braceDepth--; }
    }
    
    // Handler ends when braceDepth === 0 and parenDepth === 0
    if (bodyStarted && braceDepth === 0 && parenDepth === 0) {
      endLine = j;
      break;
    }
  }

  if (endLine === -1) {
    console.log(`WARNING: Could not find end for ${method} ${routePath} at line ${startLine+1}`);
    continue;
  }

  const handlerLines = lines.slice(i, endLine + 1);
  const group = matchGroup(routePath);
  
  routes.push({
    method, routePath, startLine, endLine,
    code: handlerLines.join('\n'),
    file: group.file,
  });
}

console.log(`Found ${routes.length} route handlers`);

// Stats
const counts = {};
for (const r of routes) {
  counts[r.file] = (counts[r.file] || 0) + 1;
}
for (const [f, c] of Object.entries(counts).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${f}: ${c}`);
}

// Write route files
const fileGroups = {};
for (const r of routes) {
  if (!fileGroups[r.file]) fileGroups[r.file] = [];
  fileGroups[r.file].push(r);
}

function detectInCode(code, patterns) {
  return Object.entries(patterns)
    .filter(([, re]) => re.test(code))
    .map(([name]) => name);
}

const configPatterns = {
  io: /\bio\.\w+\(/,
  JWT_SECRET: /\bJWT_SECRET\b/,
  PORTAL_SYNC_KEY: /\bPORTAL_SYNC_KEY\b/,
  upload: /\bupload\./,
  broadcast: /\bbroadcast\b/,
  safeError: /\bsafeError\b/,
  toCamelCase: /\btoCamelCase\b/,
  toCamelCaseArray: /\btoCamelCaseArray\b/,
  getOrderFull: /\bgetOrderFull\b/,
  emitOrderUpdate: /\bemitOrderUpdate\b/,
  STATUS_CHAIN: /\bSTATUS_CHAIN\b/,
  STATUS_LABELS: /\bSTATUS_LABELS\b/,
  validateTransition: /\bvalidateTransition\b/,
  getLoyaltySettings: /\bgetLoyaltySettings\b/,
  getGuestBonusInfo: /\bgetGuestBonusInfo\b/,
  checkRoleLimit: /\bcheckRoleLimit\b/,
  getRoleLimit: /\bgetRoleLimit\b/,
  emailService: /\bemailService\b/,
  aggregatorIntegration: /\baggregatorIntegration\b/,
  tenantStorage: /\btenantStorage\b/,
  supplierPortal: /\bsupplierPortal\b/,
  authenticateToken: /\bauthenticateToken\b/,
  ensureTenantId: /\bensureTenantId\b/,
  uploadBranding: /\buploadBranding\b/,
  uploadSiteImage: /\buploadSiteImage\b/,
  uploadChat: /\buploadChat\b/,
  uploadStaffChat: /\buploadStaffChat\b/,
  uploadAppImage: /\buploadAppImage\b/,
  authenticateBrandingUpload: /\bauthenticateBrandingUpload\b/,
};

const builtinPatterns = {
  path: /\bpath\./,
  fs: /\bfs\./,
  crypto: /\bcrypto\./,
  http: /\bhttp\./,
  bcrypt: /\bbcrypt\./,
  jwt: /\bjwt\./,
  speakeasy: /\bspeakeasy\./,
  multer: /\bmulter\b/,
};

for (const [file, routeList] of Object.entries(fileGroups)) {
  const filePath = path.join(__dirname, 'routes', file);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const combinedCode = routeList.map(r => r.code).join('\n');

  const configVars = detectInCode(combinedCode, configPatterns);
  const builtins = detectInCode(combinedCode, builtinPatterns);

  let content = '';
  for (const b of builtins) {
    if (b === 'path') content += `const path = require('path');\n`;
    else if (b === 'fs') content += `const fs = require('fs');\n`;
    else if (b === 'crypto') content += `const crypto = require('crypto');\n`;
    else if (b === 'http') content += `const http = require('http');\n`;
    else if (b === 'bcrypt') content += `const bcrypt = require('bcrypt');\n`;
    else if (b === 'jwt') content += `const jwt = require('jsonwebtoken');\n`;
    else if (b === 'speakeasy') content += `const speakeasy = require('speakeasy');\n`;
    else if (b === 'multer') content += `const multer = require('multer');\n`;
  }

  content += `\nmodule.exports = function(app, db, config) {\n`;
  content += `  const { ${configVars.join(', ')} } = config;\n\n`;
  content += combinedCode;
  if (!content.endsWith('\n')) content += '\n';
  content += `};`;

  // Remove old file if exists, then write
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Created routes/${file} (${routeList.length} routes)`);
}

// Save mapping
fs.writeFileSync(path.join(__dirname, 'route-mapping.json'), JSON.stringify(
  routes.map(r => ({ line: r.startLine + 1, method: r.method, path: r.routePath, file: r.file })),
  null, 2
));
console.log(`\nTotal: ${routes.length} routes extracted`);
