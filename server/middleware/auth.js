const jwt = require('jsonwebtoken');
module.exports = function(config) {
  return {
    authenticateToken(req, res, next) {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
      try {
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
        req.user = decoded;
        req.tenant_id = decoded.tenantId || decoded.tenant_id;
        next();
      } catch (e) {
        return res.status(401).json({ error: 'Недействительный токен' });
      }
    },
    ensureTenantId(req, res, next) {
      if (req.tenant_id) return next();
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
  };
};
