/ File: routes/seasonalConditions.js
const express2 = require('express');
const router2 = express2.Router();
const seasonalConditionsController = require('../controllers/seasonalConditionsController');

router2.get('/:routeId/seasonal-conditions', seasonalConditionsController.getSeasonalConditions);
router2.get('/:routeId/weather-analysis', seasonalConditionsController.getWeatherAnalysis);

module.exports = router2;
