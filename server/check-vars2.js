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

  const destructureMatch = content.match(/const\s*\{\s*([^}]+)\s*\}\s*=\s*config/);
  const destructured = destructureMatch
    ? destructureMatch[1].split(',').map(v => v.trim()).filter(Boolean)
    : [];

  // Check each config var - must match as JS identifier, not inside URL strings
  for (const v of configVars) {
    const re = new RegExp('([^a-zA-Z0-9_$])' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-zA-Z0-9_$])', 'g');
    let match;
    let found = false;
    while ((match = re.exec(content)) !== null) {
      // Skip matches inside strings (simple heuristic: not inside quotes)
      const before = content.substring(0, match.index);
      const quotesBefore = (before.match(/'/g) || []).length;
      const dblQuotesBefore = (before.match(/"/g) || []).length;
      const backtickBefore = (before.match(/`/g) || []).length;
      if (quotesBefore % 2 === 0 && dblQuotesBefore % 2 === 0 && backtickBefore % 2 === 0) {
        found = true;
        break;
      }
    }

    if (found && !destructured.includes(v)) {
      console.log(`${file}: "${v}" used but not destructured from config`);
      allOk = false;
    }
  }
}

if (allOk) console.log('All route files have correct destructuring ✓');
