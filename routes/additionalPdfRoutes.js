// File: routes/additionalPdfRoutes.js
// Purpose: Additional routes for remaining PDF endpoints

const express = require('express');
const router = express.Router();
const { 
  communicationCoverageController,
  roadQualityEnvironmentalController, 
  terrainTrafficController,
  complianceController 
} = require('../controllers/finalControllersBundle');

// Communication Coverage
router.get('/:routeId/communication-coverage', communicationCoverageController.getCommunicationCoverage);

// Road Quality & Environmental
router.get('/:routeId/road-quality', roadQualityEnvironmentalController.getRoadQuality);
router.get('/:routeId/environmental-risks', roadQualityEnvironmentalController.getEnvironmentalRisks);

// Terrain & Traffic  
router.get('/:routeId/terrain-analysis', terrainTrafficController.getTerrainAnalysis);
router.get('/:routeId/traffic-analysis', terrainTrafficController.getTrafficAnalysis);

// Compliance
router.get('/:routeId/compliance-requirements', complianceController.getComplianceRequirements);

module.exports = router;

// ============================================================================

// File: server.js (UPDATED - Add new routes)
// Add these lines to your existing server.js after the other route imports:

/*
// ✅ NEW: PDF Data Routes for Journey Risk Report
try {
  const pdfDataRoutes = require('./routes/pdfDataRoutes');
  app.use('/api/routes', pdfDataRoutes);
  console.log('✅ PDF Data routes loaded');
} catch (error) {
  console.error('❌ Error loading PDF data routes:', error.message);
}

try {
  const additionalPdfRoutes = require('./routes/additionalPdfRoutes');
  app.use('/api/routes', additionalPdfRoutes);
  console.log('✅ Additional PDF routes loaded');
} catch (error) {
  console.error('❌ Error loading additional PDF routes:', error.message);
}
*/