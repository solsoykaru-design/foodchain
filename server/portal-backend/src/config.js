import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5180,http://localhost:4000,https://portal.foodchain.uz,https://admin.foodchain.uz').split(',').map(s => s.trim()),
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'portal.db'),
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5180',
  bcryptRounds: 12,
  mainServerUrl: process.env.MAIN_SERVER_URL || `http://localhost:${process.env.PORT || 4000}`,
  portalSyncKey: process.env.PORTAL_SYNC_KEY,
  payme: {
    merchantId: process.env.PAYME_MERCHANT_ID || 'dev-payme-merchant',
    secretKey: process.env.PAYME_SECRET_KEY || 'dev-payme-secret',
  },
};

// Crash if required env vars are missing
const required = ['JWT_SECRET', 'PORTAL_SYNC_KEY', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} environment variable is not set. Portal will not work correctly.`);
  }
}
