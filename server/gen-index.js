/**
 * Generates refactored index.js by:
 * 1. Removing inline route handlers
 * 2. Hoisting late-defined variables that routes need
 * 3. Inserting require() calls for each route group in order
 * 4. Building a config object with all dependencies
 */
const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8').split('\n');
const mapping = JSON.parse(fs.readFileSync(path.join(__dirname, 'route-mapping.json'), 'utf8'));

// Build route ranges (0-indexed) grouped by file
const fileRoutes = {};
for (const r of mapping) {
  const f = r.file;
  if (!fileRoutes[f]) fileRoutes[f] = [];
  fileRoutes[f].push(r);
}

// For each route, we need start/end line from the original extraction
// Re-extract them to be sure (the mapping has line, not endLine)
// We'll use the extract-simple approach inline here
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

// Get all route ranges grouped by file, sorted by position
const routesByFile = {};
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  const m = trimmed.match(/^app\.(get|post|put|delete|patch)\('([^']+)'/);
  if (!m) continue;
  const path2 = m[2];
  // Find matching route in mapping
  const found = mapping.find(r => r.line === i + 1 && r.method === m[1] && r.path === path2);
  if (!found) continue;
  const endIdx = findHandlerEnd(i, lines);
  if (endIdx === -1) {
    console.log('ERROR: Cannot find end for ' + m[1] + ' ' + path2 + ' at line ' + (i+1));
    continue;
  }
  if (!routesByFile[found.file]) routesByFile[found.file] = [];
  routesByFile[found.file].push({ start: i, end: endIdx });
}

// Sorted unique first occurrence of each file
const firstRoutes = Object.entries(routesByFile)
  .map(([file, routes]) => ({ file, first: routes.sort((a,b) => a.start - b.start)[0] }))
  .sort((a, b) => a.first.start - b.first.start);

// Build set of all lines that are inside any route handler
const routeLineSet = new Set();
for (const routes of Object.values(routesByFile)) {
  for (const { start, end } of routes) {
    for (let i = start; i <= end; i++) routeLineSet.add(i);
  }
}

// Collect all variable names used by route files (from their config destructuring)
const configVarSet = new Set();
const routeDir = path.join(__dirname, 'routes');
if (fs.existsSync(routeDir)) {
  for (const file of fs.readdirSync(routeDir)) {
    if (!file.endsWith('.js')) continue;
    const content = fs.readFileSync(path.join(routeDir, file), 'utf8');
    const m = content.match(/const\s*\{\s*([^}]+)\s*\}\s*=\s*config/);
    if (m) {
      m[1].split(',').map(v => v.trim()).filter(Boolean).forEach(v => configVarSet.add(v));
    }
  }
}

console.log('Config variables needed by routes:');
console.log([...configVarSet].join(', '));

// Also find where each config variable is defined in the original index
// This helps us hoist them
const varDefs = {};
for (const v of configVarSet) {
  for (let i = 0; i < lines.length; i++) {
    const re = new RegExp('\\b(const|let|var|function)\\s+' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    if (re.test(lines[i])) {
      varDefs[v] = { line: i, text: lines[i].trim() };
      break;
    }
  }
  if (!varDefs[v]) {
    // Check for module import pattern
    for (let i = 0; i < Math.min(lines.length, 50); i++) {
      const re = new RegExp('\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (re.test(lines[i]) && lines[i].includes('require')) {
        varDefs[v] = { line: i, text: lines[i].trim() };
        break;
      }
    }
  }
}

console.log('\nVariable definitions:');
for (const [v, def] of Object.entries(varDefs).sort((a,b) => a[1].line - b[1].line)) {
  console.log('  ' + v + ': line ' + (def.line+1) + ' - ' + def.text.substring(0, 100));
}
for (const v of configVarSet) {
  if (!varDefs[v]) console.log('  NOT FOUND: ' + v);
}
