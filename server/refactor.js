const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8').split('\n');
const mapping = JSON.parse(fs.readFileSync(path.join(__dirname, 'route-mapping.json'), 'utf8'));

// Find end of route handler
function findHandlerEnd(startIdx, codeLines) {
  let braceDepth = 0, parenDepth = 0, bodyStarted = false;
  let inStr = false, strChar = null, inBlockComment = false;

  for (let j = startIdx; j < codeLines.length; j++) {
    const l = codeLines[j];
    for (let k = 0; k < l.length; k++) {
      const ch = l[k];
      const next = k + 1 < l.length ? l[k+1] : '';
      const prev = k > 0 ? l[k-1] : '';

      if (inBlockComment) {
        if (ch === '*' && next === '/') { inBlockComment = false; k++; }
        continue;
      }
      if (!inStr && ch === '/' && next === '/') break;
      if (!inStr && ch === '/' && next === '*') { inBlockComment = true; k++; continue; }

      if (!inStr) {
        if ((ch === "'" || ch === '"' || ch === '`') && prev !== '\\') { inStr = true; strChar = ch; }
      } else if (ch === strChar && prev !== '\\') { inStr = false; strChar = null; continue; }
      if (inStr) continue;

      if (ch === '(') parenDepth++;
      else if (ch === ')') { parenDepth--; bodyStarted = true; }
      else if (ch === '{') { braceDepth++; if (!bodyStarted) bodyStarted = true; }
      else if (ch === '}') braceDepth--;
    }
    if (bodyStarted && braceDepth === 0 && parenDepth === 0) return j;
  }
  return -1;
}

// Find route handler ranges
const ranges = [];
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  const m = trimmed.match(/^app\.(get|post|put|delete|patch)\('([^']+)'/);
  if (!m) continue;
  const p = m[2];
  const found = mapping.find(r => r.line === i + 1 && r.method === m[1] && r.path === p);
  if (!found) continue;
  const endIdx = findHandlerEnd(i, lines);
  if (endIdx !== -1) ranges.push({ start: i, end: endIdx });
}

// Build route file order by first occurrence
const routeFiles = {};
for (const r of mapping) {
  if (!routeFiles[r.file]) routeFiles[r.file] = r.line;
}
const sortedFiles = Object.entries(routeFiles).sort((a, b) => a[1] - b[1]).map(e => e[0]);

// Build set of lines to remove
const removeSet = new Set();
for (const { start, end } of ranges) {
  for (let i = start; i <= end; i++) removeSet.add(i);
}

// Generate new index.js
const result = [];
let insertedRequire = false;

for (let i = 0; i < lines.length; i++) {
  // Only check for the server.listen line to insert requires before it
  if (!insertedRequire && lines[i].includes('server.listen(PORT')) {
    result.push('');
    result.push('// ─── Route modules (extracted for maintainability) ──────');
    result.push('const config = {');
    result.push('  JWT_SECRET, PORTAL_SYNC_KEY, safeError, io, upload,');
    result.push('  toCamelCase, toCamelCaseArray,');
    result.push('  STATUS_CHAIN, STATUS_LABELS, validateTransition, emitOrderUpdate, getOrderFull,');
    result.push('  getRoleLimit, checkRoleLimit,');
    result.push('  getLoyaltySettings, getGuestBonusInfo,');
    result.push('  uploadBranding, uploadSiteImage, uploadChat, uploadStaffChat, uploadAppImage,');
    result.push('  authenticateBrandingUpload,');
    result.push('  broadcast,');
    result.push('  aggregatorIntegration, supplierPortal, emailService,');
    result.push('};');
    result.push('');
    for (const file of sortedFiles) {
      result.push(`require('./routes/${file}')(app, db, config);`);
    }
    result.push('');
    insertedRequire = true;
  }

  if (removeSet.has(i)) continue;
  result.push(lines[i]);
}

fs.writeFileSync(path.join(__dirname, 'index.refactored.js'), result.join('\n'), 'utf8');
console.log('Generated index.refactored.js');
console.log('Original lines: ' + lines.length);
console.log('New lines: ' + result.length);
console.log('Removed route handlers: ' + ranges.length);
console.log('Route files: ' + sortedFiles.join(', '));
