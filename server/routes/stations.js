/**
 * Kitchen Stations API Routes
 */

const stationService = require('../services/station.service');

module.exports = function(app, db, config) {
  const { authenticateToken, requireRole, toCamelCase } = config;

  app.get('/api/stations', authenticateToken, (req, res) => {
    try {
      res.json(stationService.getStations(db, req.tenant_id).map(toCamelCase));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/stations', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      res.json(toCamelCase(stationService.saveStation(db, req.tenant_id, req.body)));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/stations/:id', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      res.json(toCamelCase(stationService.saveStation(db, req.tenant_id, { ...req.body, id: Number(req.params.id) })));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/stations/:id', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      res.json(stationService.deleteStation(db, req.tenant_id, Number(req.params.id)));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/orders/:id/stations', authenticateToken, (req, res) => {
    try {
      const items = stationService.getOrderStationItems(db, req.tenant_id, Number(req.params.id));
      res.json(items.map(toCamelCase));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/orders/:id/split-stations', authenticateToken, requireRole('admin', 'manager', 'waiter'), (req, res) => {
    try {
      const result = stationService.splitOrderByStations(db, req.tenant_id, Number(req.params.id));
      res.json({ success: true, items: result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/orders/:orderId/station-items/:itemId/ready', authenticateToken, requireRole('admin', 'manager', 'waiter', 'chef'), (req, res) => {
    try {
      const result = stationService.markStationReady(db, req.tenant_id, Number(req.params.orderId), Number(req.params.itemId));
      if (result.allReady) {
        db.prepare('UPDATE orders SET status = "ready", updated_at = datetime("now") WHERE id = ?').run(req.params.orderId);
      }
      res.json({ success: true, ...result, stationItem: toCamelCase(result.stationItem) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/station-orders', authenticateToken, (req, res) => {
    try {
      const stationId = req.query.station_id ? Number(req.query.station_id) : null;
      const items = stationService.getPendingStationOrders(db, req.tenant_id, stationId);
      res.json(items.map(toCamelCase));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/dishes/:id/station', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      stationService.setDishStation(db, req.tenant_id, Number(req.params.id), req.body.stationId);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  console.log('[Stations] Routes registered');
};
