const fs = require('fs');
const path = require('path');

const routeDir = path.join(__dirname, 'routes');
const configVars = ['JWT_SECRET','PORTAL_SYNC_KEY','safeError','io','upload','toCamelCase',
  'toCamelCaseArray','STATUS_CHAIN','STATUS_LABELS','validateTransition','emitOrderUpdate',
  'getOrderFull','getRoleLimit','checkRoleLimit','getLoyaltySettings','getGuestBonusInfo',
  'uploadBranding','uploadSiteImage','uploadChat','uploadStaffChat','uploadAppImage',
  'authenticateBrandingUpload','csvUpload','broadcast','aggregatorIntegration',
  'supplierPortal','emailService'];

let allOk = true;

for (const file of fs.readdirSync(routeDir)) {
  if (!file.endsWith('.js')) continue;
  const content = fs.readFileSync(path.join(routeDir, file), 'utf8');

  // Find what's destructured from config
  const destructureMatch = content.match(/const\s*\{\s*([^}]+)\s*\}\s*=\s*config/);
  const destructured = destructureMatch
    ? destructureMatch[1].split(',').map(v => v.trim()).filter(Boolean)
    : [];

  // Find all identifiers used in the file (simple regex approximation)
  const usedVars = new Set();
  for (const v of configVars) {
    const re = new RegExp('\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
    if (re.test(content)) usedVars.add(v);
  }

  // Check each used var is destructured
  for (const v of usedVars) {
    if (!destructured.includes(v)) {
      console.log(`${file}: missing destructure of "${v}"`);
      allOk = false;
    }
  }
}

if (allOk) console.log('All route files have correct destructuring ✓');
