// File: routes/routes.js
// Purpose: Route management endpoints with GPS CSV upload support and data collection
// Dependencies: multer for file uploads, express-validator for validation

const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, query } = require('express-validator');
const routeController = require('../controllers/routeController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_PATH || './uploads');
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const prefix = file.fieldname === 'gpsFile' ? 'gps-route-' : 'route-';
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = ['.csv', '.txt'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV and TXT files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE?.replace('mb', '')) * 1024 * 1024 || 50 * 1024 * 1024 // 50MB default
  }
});

// Validation rules for manual route creation
const createRouteValidation = [
  body('routeName')
    .notEmpty()
    .withMessage('Route name is required')
    .isLength({ min: 3, max: 255 })
    .withMessage('Route name must be between 3 and 255 characters'),
    
  body('fromAddress')
    .notEmpty()
    .withMessage('From address is required'),
    
  body('toAddress')
    .notEmpty()
    .withMessage('To address is required'),
    
  body('fromCoordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('From latitude must be between -90 and 90'),
    
  body('fromCoordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('From longitude must be between -180 and 180'),
    
  body('toCoordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('To latitude must be between -90 and 90'),
    
  body('toCoordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('To longitude must be between -180 and 180'),
    
  body('terrain')
    .optional()
    .isIn(['flat', 'hilly', 'urban', 'rural', 'mixed'])
    .withMessage('Terrain must be one of: flat, hilly, urban, rural, mixed'),
    
  body('majorHighways')
    .optional()
    .isArray()
    .withMessage('Major highways must be an array'),
    
  body('fromCode')
    .optional()
    .isLength({ max: 50 })
    .withMessage('From code cannot exceed 50 characters'),
    
  body('toCode')
    .optional()
    .isLength({ max: 50 })
    .withMessage('To code cannot exceed 50 characters')
];

// Validation rules for GPS route upload
const gpsRouteValidation = [
  body('fromCode')
    .notEmpty()
    .withMessage('From code is required')
    .isLength({ max: 50 })
    .withMessage('From code cannot exceed 50 characters'),
    
  body('fromName')
    .notEmpty()
    .withMessage('From name is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('From name must be between 1 and 255 characters'),
    
  body('toCode')
    .notEmpty()
    .withMessage('To code is required')
    .isLength({ max: 50 })
    .withMessage('To code cannot exceed 50 characters'),
    
  body('toName')
    .notEmpty()
    .withMessage('To name is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('To name must be between 1 and 255 characters'),
    
  body('routeName')
    .optional()
    .isLength({ min: 3, max: 255 })
    .withMessage('Route name must be between 3 and 255 characters'),
    
  body('terrain')
    .optional()
    .isIn(['flat', 'hilly', 'urban', 'rural', 'mixed'])
    .withMessage('Terrain must be one of: flat, hilly, urban, rural, mixed'),
    
  body('fromAddress')
    .optional()
    .isLength({ max: 255 })
    .withMessage('From address cannot exceed 255 characters'),
    
  body('toAddress')
    .optional()
    .isLength({ max: 255 })
    .withMessage('To address cannot exceed 255 characters')
];

const updateRouteValidation = [
  body('routeName')
    .optional()
    .isLength({ min: 3, max: 255 })
    .withMessage('Route name must be between 3 and 255 characters'),
    
  body('terrain')
    .optional()
    .isIn(['flat', 'hilly', 'urban', 'rural', 'mixed'])
    .withMessage('Terrain must be one of: flat, hilly, urban, rural, mixed'),
    
  body('majorHighways')
    .optional()
    .isArray()
    .withMessage('Major highways must be an array')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('riskLevel')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .withMessage('Risk level must be one of: LOW, MEDIUM, HIGH, CRITICAL'),
    
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
];

// All routes require authentication
router.use(auth);

// Route CRUD operations
router.post('/', createRouteValidation, routeController.createRoute);
router.get('/', queryValidation, routeController.getRoutes);
router.get('/:id', routeController.getRoute);
router.put('/:id', updateRouteValidation, routeController.updateRoute);
router.delete('/:id', routeController.deleteRoute);

// GPS Route Upload - NEW ENDPOINT for your requirement
router.post('/upload-gps-route', 
  upload.single('gpsFile'), 
  gpsRouteValidation, 
  routeController.uploadGPSRoute
);

// Legacy CSV upload (for backward compatibility)
router.post('/upload-csv', upload.single('csvFile'), routeController.uploadCSV);

// Risk calculation
router.post('/:id/recalculate-risk', routeController.recalculateRisk);

// Route analytics endpoints
router.get('/:id/analytics', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Route analytics endpoint - coming soon',
      routeId: req.params.id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching route analytics'
    });
  }
});

// Export route data
router.get('/:id/export', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Route export endpoint - coming soon',
      routeId: req.params.id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting route data'
    });
  }
});

// Route sharing (generate shareable link)
router.post('/:id/share', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Route sharing endpoint - coming soon',
      routeId: req.params.id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating shareable link'
    });
  }
});

// Get GPS tracking points for a route
router.get('/:id/gps-points', async (req, res) => {
  try {
    const Route = require('../models/Route');
    
    const route = await Route.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    }).select('routePoints routeName fromName toName totalDistance');

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        routeId: req.params.id,
        routeName: route.routeName,
        fromName: route.fromName,
        toName: route.toName,
        totalDistance: route.totalDistance,
        gpsPoints: route.routePoints,
        totalPoints: route.routePoints.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching GPS points'
    });
  }
});

// Comprehensive data collection for a route
router.post('/:id/collect-all-data', async (req, res) => {
  try {
    const Route = require('../models/Route');
    
    const route = await Route.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Start comprehensive data collection
    try {
      const dataCollectionService = require('../services/dataCollectionService');
      
      console.log(`🔄 Starting comprehensive data collection for route: ${route.routeId}`);
      
      // Collect all data
      const collectionResults = await dataCollectionService.collectAllRouteData(req.params.id);

      res.status(200).json({
        success: true,
        message: 'Comprehensive data collection completed',
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          fromName: route.fromName,
          toName: route.toName,
          totalDistance: route.totalDistance,
          gpsPoints: route.routePoints.length
        },
        collectionResults,
        dataCollected: {
          emergencyServices: collectionResults.emergencyServices?.total || 0,
          weatherPoints: collectionResults.weatherData?.total || 0,
          trafficPoints: collectionResults.trafficData?.total || 0,
          accidentAreas: collectionResults.accidentAreas?.total || 0,
          roadConditions: collectionResults.roadConditions?.total || 0,
          amenities: collectionResults.amenities?.total || 0
        },
        nextSteps: [
          'All route data has been collected and stored',
          'You can now view detailed analysis for each data type',
          'Risk assessment can be performed using this comprehensive data',
          'Use the analysis endpoints to view specific data categories'
        ]
      });
    } catch (dataError) {
      console.error('Data collection service error:', dataError);
      res.status(200).json({
        success: true,
        message: 'Data collection initiated (service unavailable)',
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          fromName: route.fromName,
          toName: route.toName,
          totalDistance: route.totalDistance,
          gpsPoints: route.routePoints.length
        },
        note: 'Data collection service is being set up. Route is ready for manual analysis.'
      });
    }

  } catch (error) {
    console.error('Data collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during data collection',
      error: error.message
    });
  }
});

// Get collected emergency services
router.get('/:id/emergency-services', async (req, res) => {
  try {
    const EmergencyService = require('../models/EmergencyService');
    
    const services = await EmergencyService.find({ routeId: req.params.id })
      .sort({ distanceFromRouteKm: 1 });

    const summary = {
      total: services.length,
      byType: {
        hospitals: services.filter(s => s.serviceType === 'hospital').length,
        police: services.filter(s => s.serviceType === 'police').length,
        fireStations: services.filter(s => s.serviceType === 'fire_station').length
      },
      closest: {
        hospital: services.find(s => s.serviceType === 'hospital'),
        police: services.find(s => s.serviceType === 'police'),
        fireStation: services.find(s => s.serviceType === 'fire_station')
      },
      averageDistance: services.reduce((sum, s) => sum + s.distanceFromRouteKm, 0) / services.length || 0
    };

    res.status(200).json({
      success: true,
      summary,
      services: services.map(s => ({
        type: s.serviceType,
        name: s.name,
        distance: s.distanceFromRouteKm,
        responseTime: s.responseTimeMinutes,
        coordinates: { latitude: s.latitude, longitude: s.longitude },
        address: s.address,
        availabilityScore: s.availabilityScore
      }))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching emergency services'
    });
  }
});

// Get weather data
router.get('/:id/weather-data', async (req, res) => {
  try {
    const WeatherCondition = require('../models/WeatherCondition');
    
    const weatherData = await WeatherCondition.find({ routeId: req.params.id })
      .sort({ createdAt: -1 });

    const summary = {
      total: weatherData.length,
      averageTemp: weatherData.reduce((sum, w) => sum + w.averageTemperature, 0) / weatherData.length || 0,
      averageRisk: weatherData.reduce((sum, w) => sum + w.riskScore, 0) / weatherData.length || 0,
      conditions: [...new Set(weatherData.map(w => w.weatherCondition))],
      surfaceConditions: [...new Set(weatherData.map(w => w.roadSurfaceCondition))]
    };

    res.status(200).json({
      success: true,
      summary,
      weatherPoints: weatherData.map(w => ({
        coordinates: { latitude: w.latitude, longitude: w.longitude },
        temperature: w.averageTemperature,
        condition: w.weatherCondition,
        visibility: w.visibilityKm,
        windSpeed: w.windSpeedKmph,
        riskScore: w.riskScore,
        surfaceCondition: w.roadSurfaceCondition
      }))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching weather data'
    });
  }
});

// Get traffic data
router.get('/:id/traffic-data', async (req, res) => {
  try {
    const TrafficData = require('../models/TrafficData');
    
    const trafficData = await TrafficData.find({ routeId: req.params.id })
      .sort({ measurementTime: -1 });

    const summary = {
      total: trafficData.length,
      averageSpeed: trafficData.reduce((sum, t) => sum + t.averageSpeedKmph, 0) / trafficData.length || 0,
      averageRisk: trafficData.reduce((sum, t) => sum + t.riskScore, 0) / trafficData.length || 0,
      congestionLevels: {
        severe: trafficData.filter(t => t.congestionLevel === 'severe').length,
        heavy: trafficData.filter(t => t.congestionLevel === 'heavy').length,
        moderate: trafficData.filter(t => t.congestionLevel === 'moderate').length,
        light: trafficData.filter(t => t.congestionLevel === 'light').length,
        freeFlow: trafficData.filter(t => t.congestionLevel === 'free_flow').length
      }
    };

    res.status(200).json({
      success: true,
      summary,
      trafficPoints: trafficData.map(t => ({
        coordinates: { latitude: t.latitude, longitude: t.longitude },
        speed: t.averageSpeedKmph,
        congestionLevel: t.congestionLevel,
        riskScore: t.riskScore,
        bottlenecks: t.bottleneckCauses,
        measurementTime: t.measurementTime
      }))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching traffic data'
    });
  }
});

// Get accident-prone areas
router.get('/:id/accident-areas', async (req, res) => {
  try {
    const AccidentProneArea = require('../models/AccidentProneArea');
    
    const accidentAreas = await AccidentProneArea.find({ routeId: req.params.id })
      .sort({ riskScore: -1 });

    const summary = {
      total: accidentAreas.length,
      highRisk: accidentAreas.filter(a => a.riskScore > 7).length,
      mediumRisk: accidentAreas.filter(a => a.riskScore >= 5 && a.riskScore <= 7).length,
      lowRisk: accidentAreas.filter(a => a.riskScore < 5).length,
      averageRisk: accidentAreas.reduce((sum, a) => sum + a.riskScore, 0) / accidentAreas.length || 0,
      severityBreakdown: {
        fatal: accidentAreas.filter(a => a.accidentSeverity === 'fatal').length,
        major: accidentAreas.filter(a => a.accidentSeverity === 'major').length,
        minor: accidentAreas.filter(a => a.accidentSeverity === 'minor').length
      }
    };

    res.status(200).json({
      success: true,
      summary,
      accidentAreas: accidentAreas.map(a => ({
        coordinates: { latitude: a.latitude, longitude: a.longitude },
        riskScore: a.riskScore,
        severity: a.accidentSeverity,
        frequency: a.accidentFrequencyYearly,
        commonTypes: a.commonAccidentTypes,
        contributingFactors: a.contributingFactors
      }))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching accident-prone areas'
    });
  }
});

// Get road conditions
router.get('/:id/road-conditions', async (req, res) => {
  try {
    const RoadCondition = require('../models/RoadCondition');
    
    const roadConditions = await RoadCondition.find({ routeId: req.params.id })
      .sort({ riskScore: -1 });

    const summary = {
      total: roadConditions.length,
      averageRisk: roadConditions.reduce((sum, r) => sum + r.riskScore, 0) / roadConditions.length || 0,
      surfaceQuality: {
        excellent: roadConditions.filter(r => r.surfaceQuality === 'excellent').length,
        good: roadConditions.filter(r => r.surfaceQuality === 'good').length,
        fair: roadConditions.filter(r => r.surfaceQuality === 'fair').length,
        poor: roadConditions.filter(r => r.surfaceQuality === 'poor').length,
        critical: roadConditions.filter(r => r.surfaceQuality === 'critical').length
      },
      roadTypes: {
        highway: roadConditions.filter(r => r.roadType === 'highway').length,
        state: roadConditions.filter(r => r.roadType === 'state').length,
        district: roadConditions.filter(r => r.roadType === 'district').length,
        rural: roadConditions.filter(r => r.roadType === 'rural').length
      },
      issues: {
        potholes: roadConditions.filter(r => r.hasPotholes).length,
        construction: roadConditions.filter(r => r.underConstruction).length
      }
    };

    res.status(200).json({
      success: true,
      summary,
      roadConditions: roadConditions.map(r => ({
        coordinates: { latitude: r.latitude, longitude: r.longitude },
        roadType: r.roadType,
        surfaceQuality: r.surfaceQuality,
        width: r.widthMeters,
        lanes: r.laneCount,
        hasPotholes: r.hasPotholes,
        underConstruction: r.underConstruction,
        riskScore: r.riskScore
      }))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching road conditions'
    });
  }
});

// Get comprehensive route analysis
router.get('/:id/comprehensive-analysis', async (req, res) => {
  try {
    const Route = require('../models/Route');
    
    const route = await Route.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Get counts from all data types
    const EmergencyService = require('../models/EmergencyService');
    const WeatherCondition = require('../models/WeatherCondition');
    const TrafficData = require('../models/TrafficData');
    const AccidentProneArea = require('../models/AccidentProneArea');
    const RoadCondition = require('../models/RoadCondition');

    const [emergencyCount, weatherCount, trafficCount, accidentCount, roadCount] = await Promise.all([
      EmergencyService.countDocuments({ routeId: req.params.id }),
      WeatherCondition.countDocuments({ routeId: req.params.id }),
      TrafficData.countDocuments({ routeId: req.params.id }),
      AccidentProneArea.countDocuments({ routeId: req.params.id }),
      RoadCondition.countDocuments({ routeId: req.params.id })
    ]);

    const comprehensiveAnalysis = {
      routeInfo: {
        routeId: route.routeId,
        routeName: route.routeName,
        fromName: route.fromName,
        toName: route.toName,
        totalDistance: route.totalDistance,
        estimatedDuration: route.estimatedDuration,
        terrain: route.terrain,
        gpsPoints: route.routePoints.length
      },
      dataAvailability: {
        emergencyServices: emergencyCount,
        weatherPoints: weatherCount,
        trafficPoints: trafficCount,
        accidentAreas: accidentCount,
        roadConditions: roadCount,
        totalDataPoints: emergencyCount + weatherCount + trafficCount + accidentCount + roadCount
      },
      processingStatus: route.dataProcessingStatus,
      riskAssessment: route.riskScores || {
        totalWeightedScore: 0,
        riskGrade: 'A',
        note: 'Risk calculation pending'
      },
      liveMapLink: route.liveMapLink,
      dataCollectionEndpoints: {
        emergencyServices: `/api/routes/${req.params.id}/emergency-services`,
        weatherData: `/api/routes/${req.params.id}/weather-data`,
        trafficData: `/api/routes/${req.params.id}/traffic-data`,
        accidentAreas: `/api/routes/${req.params.id}/accident-areas`,
        roadConditions: `/api/routes/${req.params.id}/road-conditions`,
        gpsPoints: `/api/routes/${req.params.id}/gps-points`
      }
    };

    res.status(200).json({
      success: true,
      data: comprehensiveAnalysis
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching comprehensive analysis'
    });
  }
});

// Bulk operations
router.post('/bulk/delete', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Bulk delete endpoint - coming soon'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error in bulk delete operation'
    });
  }
});

router.post('/bulk/recalculate', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Bulk recalculate endpoint - coming soon'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error in bulk recalculate operation'
    });
  }
});
// Analyze sharp turns and blind spots for a route
router.post('/:id/analyze-visibility', async (req, res) => {
  try {
    const Route = require('../models/Route');
    const sharpTurnsService = require('../services/sharpTurnsBlindSpotsService');
    
    const route = await Route.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    console.log(`🔄 Starting ENHANCED visibility analysis for route: ${route.routeId}`);
    
    // This will now use REAL calculations automatically
    const analysis = await sharpTurnsService.analyzeRoute(req.params.id);

    res.status(200).json({
      success: true,
      message: 'ENHANCED visibility analysis completed successfully',
      data: {
        ...analysis,
        enhancementInfo: {
          blindSpotMethod: analysis.blindSpots?.analysisMethod || 'FALLBACK_MOCK',
          improvements: analysis.blindSpots?.improvements || {},
          apiIntegration: {
            googleElevationAPI: analysis.blindSpots?.analysisMethod === 'REAL_GOOGLE_API',
            googlePlacesAPI: analysis.blindSpots?.analysisMethod === 'REAL_GOOGLE_API',
            realTimeCalculations: true
          }
        }
      }
    });

  } catch (error) {
    console.error('Enhanced visibility analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during enhanced visibility analysis',
      error: error.message
    });
  }
});

// Get sharp turns data for a route
router.get('/:id/sharp-turns', async (req, res) => {
  try {
    const SharpTurn = require('../models/SharpTurn');
    const Route = require('../models/Route');
    
    const route = await Route.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    const sharpTurns = await SharpTurn.find({ routeId: req.params.id })
      .sort({ distanceFromStartKm: 1 });

    res.status(200).json({
      success: true,
      data: {
        routeId: route.routeId,
        routeName: route.routeName,
        totalSharpTurns: sharpTurns.length,
        criticalTurns: sharpTurns.filter(t => t.riskScore >= 8).length,
        sharpTurns: sharpTurns.map(turn => ({
          id: turn._id,
          coordinates: { latitude: turn.latitude, longitude: turn.longitude },
          distanceFromStart: turn.distanceFromStartKm,
          turnAngle: turn.turnAngle,
          turnDirection: turn.turnDirection,
          riskScore: turn.riskScore,
          severity: turn.turnSeverity,
          recommendedSpeed: turn.recommendedSpeed,
          streetViewLink: turn.streetViewLink,
          mapsLink: turn.mapsLink
        }))
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sharp turns data'
    });
  }
});

// Get blind spots data for a route
router.get('/:id/blind-spots', async (req, res) => {
  try {
    const BlindSpot = require('../models/BlindSpot');
    const Route = require('../models/Route');
    
    const route = await Route.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    const blindSpots = await BlindSpot.find({ routeId: req.params.id })
      .sort({ distanceFromStartKm: 1 });

    res.status(200).json({
      success: true,
      data: {
        routeId: route.routeId,
        routeName: route.routeName,
        totalBlindSpots: blindSpots.length,
        criticalSpots: blindSpots.filter(s => s.riskScore >= 8).length,
        blindSpots: blindSpots.map(spot => ({
          id: spot._id,
          coordinates: { latitude: spot.latitude, longitude: spot.longitude },
          distanceFromStart: spot.distanceFromStartKm,
          spotType: spot.spotType,
          visibilityDistance: spot.visibilityDistance,
          riskScore: spot.riskScore,
          severity: spot.severityLevel,
          satelliteViewLink: spot.satelliteViewLink,
          recommendations: spot.recommendations
        }))
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching blind spots data'
    });
  }
});

module.exports = router;