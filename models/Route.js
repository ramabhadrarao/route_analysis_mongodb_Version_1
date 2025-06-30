// File: models/Route.js
// Purpose: Enhanced route schema with GPS upload support

const mongoose = require('mongoose');

// Route Points Sub-schema
const routePointSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  pointOrder: {
    type: Number,
    required: true
  },
  elevation: Number,
  address: String,
  distanceFromStart: Number, // in km
  distanceToEnd: Number // in km
}, { _id: false });

// Risk Scores Sub-schema
const riskScoreSchema = new mongoose.Schema({
  roadConditions: { type: Number, default: 0 },
  accidentProne: { type: Number, default: 0 },
  sharpTurns: { type: Number, default: 0 },
  blindSpots: { type: Number, default: 0 },
  twoWayTraffic: { type: Number, default: 0 },
  trafficDensity: { type: Number, default: 0 },
  weatherConditions: { type: Number, default: 0 },
  emergencyServices: { type: Number, default: 0 },
  networkCoverage: { type: Number, default: 0 },
  amenities: { type: Number, default: 0 },
  securityIssues: { type: Number, default: 0 },
  totalWeightedScore: { type: Number, default: 0 },
  riskGrade: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'F'],
    default: 'A'
  },
  calculatedAt: { type: Date, default: Date.now }
}, { _id: false });

// Main Route Schema
const routeSchema = new mongoose.Schema({
  routeId: {
    type: String,
    unique: true
    // Removed required: true - will be auto-generated
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  routeName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Origin Details
  fromAddress: {
    type: String,
    required: true
  },
  fromCode: String,
  fromName: String,
  fromCoordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  
  // Destination Details
  toAddress: {
    type: String,
    required: true
  },
  toCode: String,
  toName: String,
  toCoordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  
  // Route Details
  totalDistance: {
    type: Number,
    required: true
  }, // in km
  estimatedDuration: {
    type: Number,
    required: true
  }, // in minutes
  
  // Route Points (waypoints along the route)
  routePoints: [routePointSchema],
  
  // Major highways/roads
  majorHighways: [String],
  
  // Terrain type
  terrain: {
    type: String,
    enum: ['flat', 'hilly', 'urban', 'rural', 'mixed'],
    default: 'mixed'
  },
  
  // Risk Assessment
  riskScores: riskScoreSchema,
  
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW'
  },
  
  // Route Status
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  
  // Data Processing Status
  dataProcessingStatus: {
    roadConditions: { type: Boolean, default: false },
    accidentData: { type: Boolean, default: false },
    weatherData: { type: Boolean, default: false },
    trafficData: { type: Boolean, default: false },
    emergencyServices: { type: Boolean, default: false },
    amenities: { type: Boolean, default: false },
    networkCoverage: { type: Boolean, default: false },
    securityData: { type: Boolean, default: false }
  },
  
  // Live Map Link
  liveMapLink: String,
  
  // Additional metadata
  metadata: {
    uploadSource: {
      type: String,
      enum: ['csv', 'manual', 'api', 'gps_csv'], // Added 'gps_csv' to enum
      default: 'manual'
    },
    originalFileName: String,
    processingNotes: [String],
    lastCalculated: Date,
    calculationVersion: { type: String, default: '1.0' },
    gpsTrackingPoints: Number, // Number of GPS points
    trackingAccuracy: String   // Accuracy indicator
  }
  
}, {
  timestamps: true
});

// Indexes
routeSchema.index({ routeId: 1 });
routeSchema.index({ userId: 1 });
routeSchema.index({ 'fromCoordinates.latitude': 1, 'fromCoordinates.longitude': 1 });
routeSchema.index({ 'toCoordinates.latitude': 1, 'toCoordinates.longitude': 1 });
routeSchema.index({ riskLevel: 1 });
routeSchema.index({ status: 1 });
routeSchema.index({ createdAt: -1 });

// Generate route ID before save
routeSchema.pre('save', function(next) {
  if (!this.routeId) {
    this.routeId = 'RT' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  }
  next();
});

// Method to calculate risk level based on total score
routeSchema.methods.calculateRiskLevel = function() {
  const score = this.riskScores?.totalWeightedScore || 0;
  if (score >= 8) return 'CRITICAL';
  if (score >= 6) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  return 'LOW';
};

// Method to generate live map link
routeSchema.methods.generateLiveMapLink = function() {
  const from = `${this.fromCoordinates.latitude},${this.fromCoordinates.longitude}`;
  const to = `${this.toCoordinates.latitude},${this.toCoordinates.longitude}`;
  
  // Google Maps link with waypoints
  let link = `https://www.google.com/maps/dir/${from}/${to}`;
  
  if (this.routePoints && this.routePoints.length > 2) {
    // Add some intermediate points for better route visualization
    const samplePoints = [];
    const step = Math.floor(this.routePoints.length / 10); // Sample every 10th point
    
    for (let i = step; i < this.routePoints.length - step; i += step) {
      samplePoints.push(`${this.routePoints[i].latitude},${this.routePoints[i].longitude}`);
      if (samplePoints.length >= 8) break; // Google Maps limit
    }
    
    if (samplePoints.length > 0) {
      link = `https://www.google.com/maps/dir/${from}/${samplePoints.join('/')}/${to}`;
    }
  }
  
  this.liveMapLink = link;
  return link;
};

// Method to update processing status
routeSchema.methods.updateProcessingStatus = function(type, status) {
  this.dataProcessingStatus[type] = status;
  return this.save();
};

// Method to check if all data is processed
routeSchema.methods.isFullyProcessed = function() {
  return Object.values(this.dataProcessingStatus).every(status => status === true);
};

// Virtual for completion percentage
routeSchema.virtual('processingCompletion').get(function() {
  const total = Object.keys(this.dataProcessingStatus).length;
  const completed = Object.values(this.dataProcessingStatus).filter(status => status === true).length;
  return Math.round((completed / total) * 100);
});

// Transform JSON output
routeSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});
// Comprehensive data collection for a route
router.post('/:id/collect-all-data', async (req, res) => {
    try {
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

module.exports = mongoose.model('Route', routeSchema);