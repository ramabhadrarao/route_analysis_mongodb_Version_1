// File: server.js (UPDATED VERSION WITH PDF DATA ROUTES)
// Purpose: Complete HPCL Journey Risk Management Server with PDF Data Routes

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hpcl_journey_risk', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// ============================================================================
// EXISTING ROUTES (Keep all existing functionality)
// ============================================================================

// Import routes with error handling
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
}

try {
  const routeRoutes = require('./routes/routes');
  app.use('/api/routes', routeRoutes);
  console.log('✅ Route routes loaded');
} catch (error) {
  console.error('❌ Error loading route routes:', error.message);
}

try {
  const riskRoutes = require('./routes/risk');
  app.use('/api/risk', riskRoutes);
  console.log('✅ Risk routes loaded');
} catch (error) {
  console.error('❌ Error loading risk routes:', error.message);
}

try {
  const dashboardRoutes = require('./routes/dashboard');
  app.use('/api/dashboard', dashboardRoutes);
  console.log('✅ Dashboard routes loaded');
} catch (error) {
  console.error('❌ Error loading dashboard routes:', error.message);
}

try {
  const sharpTurnsRoutes = require('./routes/sharpTurnsBlindSpots');
  app.use('/api/visibility', sharpTurnsRoutes);
  console.log('✅ Sharp turns & blind spots routes loaded');
} catch (error) {
  console.error('❌ Error loading sharp turns routes:', error.message);
}

try {
  const networkCoverageRoutes = require('./routes/networkCoverage');
  app.use('/api/network-coverage', networkCoverageRoutes);
  console.log('✅ Network coverage routes loaded');
} catch (error) {
  console.error('❌ Error loading network coverage routes:', error.message);
}

// EXISTING: Sharp Turn Image Routes (legacy)
try {
  const sharpTurnImageRoutes = require('./routes/sharpTurnImageDownloader');
  app.use('/api/sharp-turn-images', sharpTurnImageRoutes);
  console.log('✅ Sharp turn image download routes loaded');
} catch (error) {
  console.error('❌ Error loading sharp turn image routes:', error.message);
}

// Enhanced Visibility Image Downloader (Sharp Turns + Blind Spots)
try {
  const visibilityImageRoutes = require('./routes/visibilityImageDownloader');
  app.use('/api/visibility-images', visibilityImageRoutes);
  console.log('✅ Enhanced visibility image downloader routes loaded');
} catch (error) {
  console.error('❌ Error loading visibility image routes:', error.message);
}

try {
  const enhancedRoadConditionsRoutes = require('./routes/enhancedRoadConditions');
  app.use('/api/enhanced-road-conditions', enhancedRoadConditionsRoutes);
  console.log('✅ Enhanced road conditions routes loaded');
} catch (error) {
  console.error('❌ Error loading enhanced road conditions routes:', error.message);
}

try {
  const pdfRoutes = require('./routes/pdfGeneration');
  app.use('/api/pdf', pdfRoutes);
  console.log('✅ HPCL PDF generation routes loaded');
} catch (error) {
  console.error('❌ Error loading PDF routes:', error.message);
}
// 1. Route Basic Info Routes
try {
  const routeBasicInfoRoutes = require('./routes/routeBasicInfo');
  app.use('/api/routes', routeBasicInfoRoutes);
  console.log('✅ Route basic info routes loaded');
} catch (error) {
  console.error('❌ Error loading route basic info routes:', error.message);
}

// 2. Risk Factors Routes
try {
  const riskFactorsRoutes = require('./routes/riskFactors');
  app.use('/api/routes', riskFactorsRoutes);
  console.log('✅ Risk factors routes loaded');
} catch (error) {
  console.error('❌ Error loading risk factors routes:', error.message);
}

// 3. High Risk Zones Routes
try {
  const highRiskZonesRoutes = require('./routes/highRiskZones');
  app.use('/api/routes', highRiskZonesRoutes);
  console.log('✅ High risk zones routes loaded');
} catch (error) {
  console.error('❌ Error loading high risk zones routes:', error.message);
}

// 4. Emergency Services Routes
try {
  const emergencyServicesRoutes = require('./routes/emergencyServices');
  app.use('/api/routes', emergencyServicesRoutes);
  console.log('✅ Emergency services routes loaded');
} catch (error) {
  console.error('❌ Error loading emergency services routes:', error.message);
}

// 5. Seasonal Conditions Routes
try {
  const seasonalConditionsRoutes = require('./routes/seasonalConditions');
  app.use('/api/routes', seasonalConditionsRoutes);
  console.log('✅ Seasonal conditions routes loaded');
} catch (error) {
  console.error('❌ Error loading seasonal conditions routes:', error.message);
}

// 6. Communication Coverage Routes
try {
  const communicationCoverageRoutes = require('./routes/communicationCoverage');
  app.use('/api/routes', communicationCoverageRoutes);
  console.log('✅ Communication coverage routes loaded');
} catch (error) {
  console.error('❌ Error loading communication coverage routes:', error.message);
}

// 7. Compliance Routes
try {
  const complianceRoutes = require('./routes/compliance');
  app.use('/api/routes', complianceRoutes);
  console.log('✅ Compliance routes loaded');
} catch (error) {
  console.error('❌ Error loading compliance routes:', error.message);
}

// 8. Terrain & Traffic Routes
try {
  const terrainTrafficRoutes = require('./routes/terrainTraffic');
  app.use('/api/routes', terrainTrafficRoutes);
  console.log('✅ Terrain & traffic routes loaded');
} catch (error) {
  console.error('❌ Error loading terrain & traffic routes:', error.message);
}

// 9. Weather Analysis Routes
try {
  const weatherAnalysisRoutes = require('./routes/weatherAnalysis');
  app.use('/api/routes', weatherAnalysisRoutes);
  console.log('✅ Weather analysis routes loaded');
} catch (error) {
  console.error('❌ Error loading weather analysis routes:', error.message);
}
// ============================================================================
// ✅ NEW: PDF DATA ROUTES FOR JOURNEY RISK REPORT
// ============================================================================

// Main PDF Data Routes - Core endpoints for PDF generation
try {
  const pdfDataRoutes = require('./routes/pdfDataRoutes');
  app.use('/api/routes', pdfDataRoutes);
  console.log('✅ PDF Data routes loaded');
  console.log('   📊 Basic route info, risk factors, high-risk zones');
  console.log('   🌦️  Seasonal conditions, weather analysis');
  console.log('   🚑 Emergency services (medical, police, fire, fuel, educational)');
} catch (error) {
  console.error('❌ Error loading PDF data routes:', error.message);
}

// Additional PDF Routes - Specialized analysis endpoints
try {
  const additionalPdfRoutes = require('./routes/additionalPdfRoutes');
  app.use('/api/routes', additionalPdfRoutes);
  console.log('✅ Additional PDF routes loaded');
  console.log('   📡 Communication coverage analysis');
  console.log('   🛣️  Road quality & environmental risks');
  console.log('   🏔️  Terrain & traffic analysis');
  console.log('   📋 Compliance requirements');
} catch (error) {
  console.error('❌ Error loading additional PDF routes:', error.message);
}

// Static file serving for downloaded images
app.use('/downloads', express.static('downloads'));

// ============================================================================
// HEALTH CHECK ENDPOINT (UPDATED)
// ============================================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'connected',
      networkCoverage: 'available',
      visibilityImages: 'available',
      pdfDataRoutes: 'available', // ✅ NEW
      emergencyServices: 'available', // ✅ NEW
      riskAnalysis: 'available' // ✅ NEW
    }
  });
});

// ============================================================================
// ROOT ENDPOINT (UPDATED WITH NEW API ENDPOINTS)
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    message: 'HPCL Journey Risk Management System API',
    version: '3.0.0', // ✅ Updated version for PDF data routes
    endpoints: {
      // Existing endpoints
      auth: '/api/auth',
      routes: '/api/routes',
      risk: '/api/risk',
      dashboard: '/api/dashboard',
      visibility: '/api/visibility',
      networkCoverage: '/api/network-coverage',
      enhancedRoadConditions: '/api/enhanced-road-conditions',
      sharpTurnImages: '/api/sharp-turn-images',
      visibilityImages: '/api/visibility-images',
      pdf: '/api/pdf',
      health: '/health'
    },
    
    // ✅ NEW: PDF Data Endpoints for Journey Risk Report
    pdfDataEndpoints: {
      // Basic Route Information
      basicInfo: 'GET /api/routes/:routeId/basic-info',
      safetyMeasures: 'GET /api/routes/:routeId/safety-measures',
      
      // Risk Analysis
      riskFactors: 'GET /api/routes/:routeId/risk-factors',
      highRiskZones: 'GET /api/routes/:routeId/high-risk-zones',
      criticalPoints: 'GET /api/routes/:routeId/critical-points',
      
      // Weather & Seasonal Analysis
      seasonalConditions: 'GET /api/routes/:routeId/seasonal-conditions',
      weatherAnalysis: 'GET /api/routes/:routeId/weather-analysis',
      
      // Emergency Services (All Types)
      emergencyServices: 'GET /api/routes/:routeId/emergency-services',
      medicalFacilities: 'GET /api/routes/:routeId/medical-facilities',
      policeStations: 'GET /api/routes/:routeId/police-stations',
      fireStations: 'GET /api/routes/:routeId/fire-stations',
      fuelStations: 'GET /api/routes/:routeId/fuel-stations',
      educationalInstitutions: 'GET /api/routes/:routeId/educational-institutions',
      foodRestStops: 'GET /api/routes/:routeId/food-rest-stops',
      emergencyContacts: 'GET /api/routes/:routeId/emergency-contacts',
      
      // Infrastructure & Analysis
      communicationCoverage: 'GET /api/routes/:routeId/communication-coverage',
      roadQuality: 'GET /api/routes/:routeId/road-quality',
      environmentalRisks: 'GET /api/routes/:routeId/environmental-risks',
      terrainAnalysis: 'GET /api/routes/:routeId/terrain-analysis',
      trafficAnalysis: 'GET /api/routes/:routeId/traffic-analysis',
      complianceRequirements: 'GET /api/routes/:routeId/compliance-requirements'
    },
    
    // Enhanced Visibility Image Endpoints (Existing)
    visibilityImageEndpoints: {
      downloadAllImages: 'POST /api/visibility-images/routes/:routeId/download-all-images',
      downloadSharpTurns: 'POST /api/visibility-images/routes/:routeId/download-sharp-turns',
      downloadBlindSpots: 'POST /api/visibility-images/routes/:routeId/download-blind-spots',
      getImageStatus: 'GET /api/visibility-images/routes/:routeId/image-status',
      syncDatabase: 'POST /api/visibility-images/routes/:routeId/sync-database',
      deleteAllImages: 'DELETE /api/visibility-images/routes/:routeId/delete-all-images',
      getDownloadReport: 'GET /api/visibility-images/routes/:routeId/download-report'
    },
    
    // Network Coverage Endpoints (Existing)
    networkCoverageEndpoints: {
      analyzeRoute: 'POST /api/network-coverage/routes/:routeId/analyze',
      getOverview: 'GET /api/network-coverage/routes/:routeId/overview',
      getDeadZones: 'GET /api/network-coverage/routes/:routeId/dead-zones',
      getCriticalDeadZones: 'GET /api/network-coverage/routes/:routeId/critical-dead-zones',
      getOperatorCoverage: 'GET /api/network-coverage/routes/:routeId/operator/:operator',
      compareOperators: 'GET /api/network-coverage/routes/:routeId/operator-comparison',
      getStatistics: 'GET /api/network-coverage/routes/:routeId/statistics',
      checkExists: 'GET /api/network-coverage/routes/:routeId/exists',
      deleteData: 'DELETE /api/network-coverage/routes/:routeId'
    },
    
    // Enhanced Road Conditions Endpoints (Existing)
    enhancedRoadConditionsEndpoints: {
      analyzeRoute: 'POST /api/enhanced-road-conditions/routes/:routeId/analyze',
      getOverview: 'GET /api/enhanced-road-conditions/routes/:routeId/overview',
      getSegments: 'GET /api/enhanced-road-conditions/routes/:routeId/segments',
      getRiskAssessment: 'GET /api/enhanced-road-conditions/routes/:routeId/risk-assessment',
      getRecommendations: 'GET /api/enhanced-road-conditions/routes/:routeId/recommendations',
      compareRoutes: 'GET /api/enhanced-road-conditions/routes/:routeId/compare',
      checkApiStatus: 'GET /api/enhanced-road-conditions/api-status',
      deleteData: 'DELETE /api/enhanced-road-conditions/routes/:routeId'
    }
  });
});

// ============================================================================
// ERROR HANDLERS
// ============================================================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    availableEndpoints: [
      '/api/auth',
      '/api/routes', 
      '/api/risk',
      '/api/dashboard',
      '/api/visibility',
      '/api/network-coverage',
      '/api/enhanced-road-conditions',
      '/api/sharp-turn-images',
      '/api/visibility-images',
      '/api/pdf',
      '/health'
    ],
    newPdfEndpoints: [
      '/api/routes/:routeId/basic-info',
      '/api/routes/:routeId/risk-factors',
      '/api/routes/:routeId/high-risk-zones',
      '/api/routes/:routeId/emergency-services',
      '/api/routes/:routeId/communication-coverage'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================================
// START SERVER WITH UPDATED CONSOLE OUTPUT
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 HPCL Journey Risk Management Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Available API Endpoints:');
  console.log('├── Authentication: /api/auth');
  console.log('├── Routes: /api/routes');
  console.log('├── Risk Assessment: /api/risk');
  console.log('├── Dashboard: /api/dashboard');
  console.log('├── Visibility Analysis: /api/visibility');
  console.log('├── Network Coverage: /api/network-coverage');
  console.log('├── Enhanced Road Conditions: /api/enhanced-road-conditions');
  console.log('├── Sharp Turn Images (Legacy): /api/sharp-turn-images');
  console.log('├── Visibility Images (Enhanced): /api/visibility-images');
  console.log('├── PDF Generation: /api/pdf');
  console.log('└── Health Check: /health');
  console.log('');
  console.log('🆕 NEW: PDF Data Routes for Journey Risk Report');
  console.log('├── 📊 Basic Info: /api/routes/:routeId/basic-info');
  console.log('├── ⚠️  Risk Factors: /api/routes/:routeId/risk-factors');
  console.log('├── 🚨 High-Risk Zones: /api/routes/:routeId/high-risk-zones');
  console.log('├── 🌦️  Seasonal Conditions: /api/routes/:routeId/seasonal-conditions');
  console.log('├── 🚑 Emergency Services: /api/routes/:routeId/emergency-services');
  console.log('├── 🏥 Medical Facilities: /api/routes/:routeId/medical-facilities');
  console.log('├── 👮 Police Stations: /api/routes/:routeId/police-stations');
  console.log('├── 🚒 Fire Stations: /api/routes/:routeId/fire-stations');
  console.log('├── ⛽ Fuel Stations: /api/routes/:routeId/fuel-stations');
  console.log('├── 🏫 Educational Institutions: /api/routes/:routeId/educational-institutions');
  console.log('├── 📡 Communication Coverage: /api/routes/:routeId/communication-coverage');
  console.log('├── 🛣️  Road Quality: /api/routes/:routeId/road-quality');
  console.log('├── 🌍 Environmental Risks: /api/routes/:routeId/environmental-risks');
  console.log('├── 🏔️  Terrain Analysis: /api/routes/:routeId/terrain-analysis');
  console.log('├── 🚦 Traffic Analysis: /api/routes/:routeId/traffic-analysis');
  console.log('└── 📋 Compliance Requirements: /api/routes/:routeId/compliance-requirements');
  console.log('');
  console.log('🎯 QUICK TEST COMMANDS:');
  console.log(`curl http://localhost:${PORT}/api/routes/YOUR_ROUTE_ID/basic-info`);
  console.log(`curl http://localhost:${PORT}/api/routes/YOUR_ROUTE_ID/risk-factors`);
  console.log(`curl http://localhost:${PORT}/api/routes/YOUR_ROUTE_ID/emergency-services`);
  console.log('');
  console.log('📚 Full API Documentation: Check the comprehensive API docs for data structures');
  console.log('🔄 All endpoints support JSON response format for PDF generation integration');
});

module.exports = app;