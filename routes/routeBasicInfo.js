// File: routes/routeBasicInfo.js
// Purpose: Routes for basic route information

const express = require('express');
const router = express.Router();
const routeBasicInfoController = require('../controllers/routeBasicInfoController');

// GET /api/routes/:routeId/basic-info
router.get('/:routeId/basic-info', routeBasicInfoController.getBasicInfo);

// GET /api/routes/:routeId/safety-measures
router.get('/:routeId/safety-measures', routeBasicInfoController.getSafetyMeasures);

module.exports = router;