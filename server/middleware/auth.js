const jwt = require('jsonwebtoken');
module.exports = function(config) {
  return {
    authenticateToken(req, res, next) {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
      try {
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        const decoded = jwt.verify(token, config.JWT_SECRET);
        req.user = decoded;
        req.tenant_id = decoded.tenantId || decoded.tenant_id;
        next();
      } catch (e) {
        return res.status(401).json({ error: 'Недействительный токен' });
      }
    },
    ensureTenantId(req, res, next) {
      if (req.tenant_id) return next();
      req.tenant_id = req.query?.tenant_id || 1;
      if (typeof req.tenant_id === 'string') req.tenant_id = parseInt(req.tenant_id, 10);
      if (!req.tenant_id || isNaN(req.tenant_id)) req.tenant_id = 1;
      next();
    }
  };
};
