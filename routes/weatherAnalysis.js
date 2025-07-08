// File: routes/weatherAnalysis.js  
const express5 = require('express');
const router5 = express5.Router();

router5.get('/:routeId/weather-analysis', weatherAnalysisController.getWeatherAnalysis);

module.exports = router5;