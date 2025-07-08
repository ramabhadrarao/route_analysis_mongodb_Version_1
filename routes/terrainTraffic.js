// File: routes/terrainTraffic.js
const express7 = require('express');
const router7 = express7.Router(); 

router7.get('/:routeId/terrain-analysis', terrainTrafficController.getTerrainAnalysis);
router7.get('/:routeId/traffic-analysis', terrainTrafficController.getTrafficAnalysis);

module.exports = router7;