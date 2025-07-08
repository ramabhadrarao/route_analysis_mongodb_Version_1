
// File: routes/highRiskZones.js
const express = require('express');
const router = express.Router();
const highRiskZonesController = require('../controllers/highRiskZonesController');

router.get('/:routeId/high-risk-zones', highRiskZonesController.getHighRiskZones);
router.get('/:routeId/critical-points', highRiskZonesController.getCriticalPoints);

module.exports = router;