// File: routes/pdfDataRoutes.js (FIXED VERSION)
// Purpose: Main integration routes for PDF data endpoints with proper imports

const express = require('express');
const router = express.Router();

// Import all controllers with proper error handling
let routeBasicInfoController, riskFactorsController, highRiskZonesController;
let seasonalConditionsController, emergencyServicesController;
let communicationCoverageController, roadQualityController, terrainTrafficController, complianceController;

try {
  routeBasicInfoController = require('../controllers/routeBasicInfoController');
} catch (error) {
  console.error('❌ Error loading routeBasicInfoController:', error.message);
}

try {
  riskFactorsController = require('../controllers/riskFactorsController');
} catch (error) {
  console.error('❌ Error loading riskFactorsController:', error.message);
}

try {
  highRiskZonesController = require('../controllers/highRiskZonesController');
} catch (error) {
  console.error('❌ Error loading highRiskZonesController:', error.message);
}

try {
  seasonalConditionsController = require('../controllers/seasonalConditionsController');
} catch (error) {
  console.error('❌ Error loading seasonalConditionsController:', error.message);
}

try {
  emergencyServicesController = require('../controllers/emergencyServicesController');
} catch (error) {
  console.error('❌ Error loading emergencyServicesController:', error.message);
}

// Import the bundled controllers for additional endpoints
try {
  const controllerBundle = require('../controllers/finalControllersBundle');
  communicationCoverageController = controllerBundle.communicationCoverageController;
  roadQualityController = controllerBundle.roadQualityEnvironmentalController;
  terrainTrafficController = controllerBundle.terrainTrafficController;
  complianceController = controllerBundle.complianceController;
} catch (error) {
  console.error('❌ Error loading controller bundle:', error.message);
}

// ============================================================================
// BASIC ROUTE INFORMATION ENDPOINTS
// ============================================================================

// Basic Route Information
if (routeBasicInfoController) {
  router.get('/:routeId/basic-info', routeBasicInfoController.getBasicInfo);
  router.get('/:routeId/safety-measures', routeBasicInfoController.getSafetyMeasures);
  console.log('✅ Basic route info endpoints registered');
} else {
  router.get('/:routeId/basic-info', (req, res) => {
    res.status(503).json({ success: false, message: 'Basic info controller not available' });
  });
  router.get('/:routeId/safety-measures', (req, res) => {
    res.status(503).json({ success: false, message: 'Safety measures controller not available' });
  });
}

// ============================================================================
// RISK ANALYSIS ENDPOINTS
// ============================================================================

// Risk Factor Analysis  
if (riskFactorsController) {
  router.get('/:routeId/risk-factors', riskFactorsController.getRiskFactors);
  console.log('✅ Risk factors endpoints registered');
} else {
  router.get('/:routeId/risk-factors', (req, res) => {
    res.status(503).json({ success: false, message: 'Risk factors controller not available' });
  });
}

// High Risk Zones & Critical Points
if (highRiskZonesController) {
  router.get('/:routeId/high-risk-zones', highRiskZonesController.getHighRiskZones);
  router.get('/:routeId/critical-points', highRiskZonesController.getCriticalPoints);
  console.log('✅ High risk zones endpoints registered');
} else {
  router.get('/:routeId/high-risk-zones', (req, res) => {
    res.status(503).json({ success: false, message: 'High risk zones controller not available' });
  });
  router.get('/:routeId/critical-points', (req, res) => {
    res.status(503).json({ success: false, message: 'Critical points controller not available' });
  });
}

// ============================================================================
// WEATHER & SEASONAL ANALYSIS ENDPOINTS
// ============================================================================

// Seasonal Conditions & Weather
if (seasonalConditionsController) {
  router.get('/:routeId/seasonal-conditions', seasonalConditionsController.getSeasonalConditions);
  router.get('/:routeId/weather-analysis', seasonalConditionsController.getWeatherAnalysis);
  console.log('✅ Seasonal conditions endpoints registered');
} else {
  router.get('/:routeId/seasonal-conditions', (req, res) => {
    res.status(503).json({ success: false, message: 'Seasonal conditions controller not available' });
  });
  router.get('/:routeId/weather-analysis', (req, res) => {
    res.status(503).json({ success: false, message: 'Weather analysis controller not available' });
  });
}

// ============================================================================
// EMERGENCY SERVICES ENDPOINTS (ALL TYPES)
// ============================================================================

if (emergencyServicesController) {
  // Main emergency services endpoint
  router.get('/:routeId/emergency-services', emergencyServicesController.getEmergencyServices);
  
  // Specific emergency service types
  router.get('/:routeId/medical-facilities', emergencyServicesController.getMedicalFacilities);
  router.get('/:routeId/police-stations', emergencyServicesController.getPoliceStations);
  router.get('/:routeId/fire-stations', emergencyServicesController.getFireStations);
  router.get('/:routeId/fuel-stations', emergencyServicesController.getFuelStations);
  router.get('/:routeId/educational-institutions', emergencyServicesController.getEducationalInstitutions);
  router.get('/:routeId/food-rest-stops', emergencyServicesController.getFoodRestStops);
  router.get('/:routeId/emergency-contacts', emergencyServicesController.getEmergencyContacts);
  
  console.log('✅ Emergency services endpoints registered (8 endpoints)');
} else {
  // Fallback endpoints
  const emergencyEndpoints = [
    'emergency-services', 'medical-facilities', 'police-stations', 'fire-stations',
    'fuel-stations', 'educational-institutions', 'food-rest-stops', 'emergency-contacts'
  ];
  
  emergencyEndpoints.forEach(endpoint => {
    router.get(`/:routeId/${endpoint}`, (req, res) => {
      res.status(503).json({ 
        success: false, 
        message: `Emergency services controller not available for ${endpoint}` 
      });
    });
  });
}

// ============================================================================
// INFRASTRUCTURE & COMMUNICATION ENDPOINTS
// ============================================================================

// Communication Coverage
if (communicationCoverageController && communicationCoverageController.getCommunicationCoverage) {
  router.get('/:routeId/communication-coverage', communicationCoverageController.getCommunicationCoverage);
  console.log('✅ Communication coverage endpoints registered');
} else {
  router.get('/:routeId/communication-coverage', (req, res) => {
    res.status(503).json({ 
      success: false, 
      message: 'Communication coverage controller not available',
      troubleshooting: [
        'Check that finalControllersBundle.js exists',
        'Verify communicationCoverageController is properly exported',
        'Ensure all required models are available'
      ]
    });
  });
  console.warn('⚠️  Communication coverage controller not loaded');
}

// Road Quality & Environmental
if (roadQualityController) {
  router.get('/:routeId/road-quality', roadQualityController.getRoadQuality);
  router.get('/:routeId/environmental-risks', roadQualityController.getEnvironmentalRisks);
  console.log('✅ Road quality endpoints registered');
} else {
  router.get('/:routeId/road-quality', (req, res) => {
    res.status(503).json({ success: false, message: 'Road quality controller not available' });
  });
  router.get('/:routeId/environmental-risks', (req, res) => {
    res.status(503).json({ success: false, message: 'Environmental risks controller not available' });
  });
}

// Terrain & Traffic  
if (terrainTrafficController) {
  router.get('/:routeId/terrain-analysis', terrainTrafficController.getTerrainAnalysis);
  router.get('/:routeId/traffic-analysis', terrainTrafficController.getTrafficAnalysis);
  console.log('✅ Terrain & traffic endpoints registered');
} else {
  router.get('/:routeId/terrain-analysis', (req, res) => {
    res.status(503).json({ success: false, message: 'Terrain analysis controller not available' });
  });
  router.get('/:routeId/traffic-analysis', (req, res) => {
    res.status(503).json({ success: false, message: 'Traffic analysis controller not available' });
  });
}

// Compliance
if (complianceController) {
  router.get('/:routeId/compliance-requirements', complianceController.getComplianceRequirements);
  console.log('✅ Compliance endpoints registered');
} else {
  router.get('/:routeId/compliance-requirements', (req, res) => {
    res.status(503).json({ success: false, message: 'Compliance controller not available' });
  });
}

// ============================================================================
// DEBUGGING & HEALTH CHECK ENDPOINT
// ============================================================================

router.get('/pdf-data-health', (req, res) => {
  const controllerStatus = {
    routeBasicInfo: !!routeBasicInfoController,
    riskFactors: !!riskFactorsController,
    highRiskZones: !!highRiskZonesController,
    seasonalConditions: !!seasonalConditionsController,
    emergencyServices: !!emergencyServicesController,
    communicationCoverage: !!(communicationCoverageController && communicationCoverageController.getCommunicationCoverage),
    roadQuality: !!roadQualityController,
    terrainTraffic: !!terrainTrafficController,
    compliance: !!complianceController
  };
  
  const availableEndpoints = Object.keys(controllerStatus).filter(key => controllerStatus[key]);
  const unavailableEndpoints = Object.keys(controllerStatus).filter(key => !controllerStatus[key]);
  
  res.json({
    success: true,
    message: 'PDF Data Routes Health Check',
    controllerStatus,
    summary: {
      available: availableEndpoints.length,
      unavailable: unavailableEndpoints.length,
      total: Object.keys(controllerStatus).length
    },
    availableEndpoints,
    unavailableEndpoints,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
