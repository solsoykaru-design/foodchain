# FoodChain Infrastructure Setup Guide
## Run as root on the production server

### 1. Firewall (UFW)
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 2. SSL Certificate (Let's Encrypt)
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d foodchain.example.com
# Auto-renewal is configured automatically
certbot renew --dry-run
```

### 3. Node.js (if not installed)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install nodejs
```

### 4. PM2 (process manager)
```bash
npm install -g pm2
cd /path/to/foodchain/server
pm2 start index.js --name foodchain -i max
pm2 save
pm2 startup
```

### 5. PostgreSQL migration (future)
When migrating from SQLite to PostgreSQL:
1. Install PostgreSQL: `apt install postgresql postgresql-contrib`
2. Create database user: 
   ```sql
   CREATE USER foodchain WITH PASSWORD 'strong-password-here';
   CREATE DATABASE foodchain OWNER foodchain;
   ```
3. Use `pgloader` to migrate SQLite data:
   ```bash
   apt install pgloader
   pgloader sqlite:///path/to/foodchain.db postgresql://foodchain:password@localhost/foodchain
   ```
4. Update `server/index.js` to use `better-sqlite3` → `pg` driver

### 6. Fail2ban (SSH + web protection)
```bash
apt install fail2ban
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
systemctl restart fail2ban
```

### 7. Regular backups
```bash
# Install to cron: crontab -e
# Daily backup at 3am:
0 3 * * * cp /path/to/server/foodchain.db /backups/foodchain-$(date +\%Y\%m\%d).db
# Encrypt with GPG:
0 3 * * * gpg --encrypt --recipient admin@example.com /backups/foodchain-$(date +\%Y\%m\%d).db
# Keep 30 days, delete older:
0 5 * * * find /backups -name "foodchain-*.db*" -mtime +30 -delete
```

### 8. Monitoring
```bash
# Quick health check endpoint (add to express):
# GET /api/health → { status: "ok", uptime: process.uptime() }

# Monitor with PM2:
pm2 monit

# Or use monit:
apt install monit
# Configure /etc/monit/monitrc to watch foodchain process
