// File: routes/riskFactors.js
// Purpose: Routes for risk factor analysis

const express = require('express');
const router = express.Router();
const riskFactorsController = require('../controllers/riskFactorsController');

// GET /api/routes/:routeId/risk-factors
router.get('/:routeId/risk-factors', riskFactorsController.getRiskFactors);

module.exports = router;