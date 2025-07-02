// File: routes/sharpTurnsBlindSpots.js
// Purpose: REST API endpoints for sharp turns and blind spots analysis

const express = require('express');
const { auth } = require('../middleware/auth');
const sharpTurnsService = require('../services/sharpTurnsBlindSpotsService');
const SharpTurn = require('../models/SharpTurn');
const BlindSpot = require('../models/BlindSpot');
const Route = require('../models/Route');

const router = express.Router();

// All routes require authentication
router.use(auth);

// ============================================================================
// SHARP TURNS ENDPOINTS
// ============================================================================

// Analyze route for sharp turns
router.post('/routes/:routeId/analyze-sharp-turns', async (req, res) => {
  try {
    const { routeId } = req.params;
    
    // Verify route ownership
    const route = await Route.findOne({
      _id: routeId,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    console.log(`🔄 Starting sharp turns analysis for route: ${route.routeId}`);
    
    // Run sharp turns analysis
    const analysis = await sharpTurnsService.analyzeRoute(routeId);
    
    res.status(200).json({
      success: true,
      message: 'Sharp turns analysis completed successfully',
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          totalDistance: route.totalDistance,
          gpsPoints: route.routePoints.length
        },
        sharpTurns: analysis.sharpTurns,
        blindSpots: analysis.blindSpots,
        summary: analysis.summary,
        analysisDate: analysis.analysisDate
      }
    });

  } catch (error) {
    console.error('Sharp turns analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during sharp turns analysis',
      error: error.message
    });
  }
});

// Get all sharp turns for a route
router.get('/routes/:routeId/sharp-turns', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { includeImages = 'false', riskLevel = 'all' } = req.query;
    
    // Verify route ownership
    const route = await Route.findOne({
      _id: routeId,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Build query filter
    let filter = { routeId };
    if (riskLevel !== 'all') {
      const riskMapping = {
        'low': { $lt: 4 },
        'medium': { $gte: 4, $lt: 6 },
        'high': { $gte: 6, $lt: 8 },
        'critical': { $gte: 8 }
      };
      if (riskMapping[riskLevel]) {
        filter.riskScore = riskMapping[riskLevel];
      }
    }

    let query = SharpTurn.find(filter).sort({ distanceFromStartKm: 1 });
    
    // Exclude image data if not requested to reduce response size
    if (includeImages === 'false') {
      query = query.select('-streetViewImage -mapImage');
    }

    const sharpTurns = await query;

    // Get analysis summary
    const analysisResults = await SharpTurn.getRouteSharpTurnsAnalysis(routeId);
    const summary = analysisResults[0] || {
      totalTurns: 0,
      avgRiskScore: 0,
      maxRiskScore: 0,
      criticalTurns: 0,
      highRiskTurns: 0,
      severityBreakdown: { hairpin: 0, sharp: 0, moderate: 0, gentle: 0 }
    };

    res.status(200).json({
      success: true,
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          fromName: route.fromName,
          toName: route.toName,
          totalDistance: route.totalDistance
        },
        summary: {
          totalSharpTurns: summary.totalTurns,
          averageRiskScore: Math.round(summary.avgRiskScore * 100) / 100,
          maxRiskScore: summary.maxRiskScore,
          criticalTurns: summary.criticalTurns,
          highRiskTurns: summary.highRiskTurns,
          severityBreakdown: summary.severityBreakdown
        },
        sharpTurns: sharpTurns.map(turn => ({
          id: turn._id,
          coordinates: {
            latitude: turn.latitude,
            longitude: turn.longitude
          },
          distanceFromStart: turn.distanceFromStartKm,
          turnAngle: turn.turnAngle,
          turnDirection: turn.turnDirection,
          turnRadius: turn.turnRadius,
          recommendedSpeed: turn.recommendedSpeed,
          riskScore: turn.riskScore,
          severity: turn.turnSeverity,
          riskCategory: turn.riskCategory,
          streetViewLink: turn.streetViewLink,
          mapsLink: turn.mapsLink,
          ...(includeImages === 'true' && {
            streetViewImage: turn.streetViewImage,
            mapImage: turn.mapImage
          }),
          safetyFeatures: {
            guardrails: turn.guardrails,
            warningSigns: turn.warningSigns,
            lighting: turn.lightingAvailable
          },
          environmentalFactors: {
            visibility: turn.visibility,
            roadSurface: turn.roadSurface,
            bankingAngle: turn.bankingAngle,
            elevation: turn.elevation
          }
        }))
      }
    });

  } catch (error) {
    console.error('Get sharp turns error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sharp turns data',
      error: error.message
    });
  }
});

// Get specific sharp turn details with full image data
router.get('/sharp-turns/:turnId', async (req, res) => {
  try {
    const { turnId } = req.params;
    
    const sharpTurn = await SharpTurn.findById(turnId);
    if (!sharpTurn) {
      return res.status(404).json({
        success: false,
        message: 'Sharp turn not found'
      });
    }

    // Verify route ownership
    const route = await Route.findOne({
      _id: sharpTurn.routeId,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        sharpTurn: {
          id: sharpTurn._id,
          routeInfo: {
            routeId: route.routeId,
            routeName: route.routeName
          },
          location: {
            latitude: sharpTurn.latitude,
            longitude: sharpTurn.longitude,
            distanceFromStart: sharpTurn.distanceFromStartKm,
            elevation: sharpTurn.elevation
          },
          turnCharacteristics: {
            angle: sharpTurn.turnAngle,
            direction: sharpTurn.turnDirection,
            radius: sharpTurn.turnRadius,
            severity: sharpTurn.turnSeverity,
            bankingAngle: sharpTurn.bankingAngle
          },
          speedRecommendations: {
            recommended: sharpTurn.recommendedSpeed,
            approach: sharpTurn.approachSpeed
          },
          riskAssessment: {
            score: sharpTurn.riskScore,
            category: sharpTurn.riskCategory,
            confidence: sharpTurn.confidence
          },
          visualData: {
            streetViewImage: sharpTurn.streetViewImage,
            mapImage: sharpTurn.mapImage,
            streetViewLink: sharpTurn.streetViewLink,
            mapsLink: sharpTurn.mapsLink
          },
          environmentalFactors: {
            visibility: sharpTurn.visibility,
            roadSurface: sharpTurn.roadSurface,
            lighting: sharpTurn.lightingAvailable
          },
          safetyFeatures: {
            guardrails: sharpTurn.guardrails,
            warningSigns: sharpTurn.warningSigns
          },
          analysisData: {
            method: sharpTurn.analysisMethod,
            confidence: sharpTurn.confidence,
            lastUpdated: sharpTurn.lastUpdated
          }
        }
      }
    });

  } catch (error) {
    console.error('Get sharp turn details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sharp turn details',
      error: error.message
    });
  }
});

// ============================================================================
// BLIND SPOTS ENDPOINTS  
// ============================================================================

// Get all blind spots for a route
router.get('/routes/:routeId/blind-spots', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { includeImages = 'false', spotType = 'all', riskLevel = 'all' } = req.query;
    
    // Verify route ownership
    const route = await Route.findOne({
      _id: routeId,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Build query filter
    let filter = { routeId };
    if (spotType !== 'all') {
      filter.spotType = spotType;
    }
    if (riskLevel !== 'all') {
      const riskMapping = {
        'low': { $lt: 4 },
        'medium': { $gte: 4, $lt: 6 },
        'high': { $gte: 6, $lt: 8 },
        'critical': { $gte: 8 }
      };
      if (riskMapping[riskLevel]) {
        filter.riskScore = riskMapping[riskLevel];
      }
    }

    let query = BlindSpot.find(filter).sort({ distanceFromStartKm: 1 });
    
    // Exclude image data if not requested
    if (includeImages === 'false') {
      query = query.select('-streetViewImages -aerialImage');
    }

    // File: routes/sharpTurnsBlindSpots.js - Part 2
// Purpose: Blind Spots REST API endpoints (continuation)

    const blindSpots = await query;

    // Get analysis summary
    const analysisResults = await BlindSpot.getRouteBlindSpotsAnalysis(routeId);
    const summary = analysisResults[0] || {
      totalBlindSpots: 0,
      avgRiskScore: 0,
      maxRiskScore: 0,
      criticalSpots: 0,
      typeBreakdown: { crest: 0, curve: 0, intersection: 0, obstruction: 0 },
      avgVisibilityDistance: 0,
      poorVisibilitySpots: 0
    };

    res.status(200).json({
      success: true,
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          fromName: route.fromName,
          toName: route.toName,
          totalDistance: route.totalDistance
        },
        summary: {
          totalBlindSpots: summary.totalBlindSpots,
          averageRiskScore: Math.round(summary.avgRiskScore * 100) / 100,
          maxRiskScore: summary.maxRiskScore,
          criticalSpots: summary.criticalSpots,
          typeBreakdown: summary.typeBreakdown,
          averageVisibilityDistance: Math.round(summary.avgVisibilityDistance * 100) / 100,
          poorVisibilitySpots: summary.poorVisibilitySpots
        },
        blindSpots: blindSpots.map(spot => ({
          id: spot._id,
          coordinates: {
            latitude: spot.latitude,
            longitude: spot.longitude
          },
          distanceFromStart: spot.distanceFromStartKm,
          spotType: spot.spotType,
          visibilityDistance: spot.visibilityDistance,
          visibilityCategory: spot.visibilityCategory,
          obstructionHeight: spot.obstructionHeight,
          riskScore: spot.riskScore,
          severityLevel: spot.severityLevel,
          satelliteViewLink: spot.satelliteViewLink,
          streetViewLinks: spot.streetViewLinks,
          ...(includeImages === 'true' && {
            streetViewImages: spot.streetViewImages,
            aerialImage: spot.aerialImage
          }),
          roadGeometry: spot.roadGeometry,
          vegetation: spot.vegetation,
          structures: spot.structures,
          safetyMeasures: {
            warningSignsPresent: spot.warningSignsPresent,
            mirrorInstalled: spot.mirrorInstalled,
            speedLimit: spot.speedLimit
          },
          recommendations: spot.recommendations
        }))
      }
    });

  } catch (error) {
    console.error('Get blind spots error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blind spots data',
      error: error.message
    });
  }
});

// Get specific blind spot details with full image data
router.get('/blind-spots/:spotId', async (req, res) => {
  try {
    const { spotId } = req.params;
    
    const blindSpot = await BlindSpot.findById(spotId);
    if (!blindSpot) {
      return res.status(404).json({
        success: false,
        message: 'Blind spot not found'
      });
    }

    // Verify route ownership
    const route = await Route.findOne({
      _id: blindSpot.routeId,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        blindSpot: {
          id: blindSpot._id,
          routeInfo: {
            routeId: route.routeId,
            routeName: route.routeName
          },
          location: {
            latitude: blindSpot.latitude,
            longitude: blindSpot.longitude,
            distanceFromStart: blindSpot.distanceFromStartKm
          },
          characteristics: {
            spotType: blindSpot.spotType,
            visibilityDistance: blindSpot.visibilityDistance,
            visibilityCategory: blindSpot.visibilityCategory,
            obstructionHeight: blindSpot.obstructionHeight,
            severityLevel: blindSpot.severityLevel
          },
          riskAssessment: {
            score: blindSpot.riskScore,
            confidence: blindSpot.confidence
          },
          visualData: {
            streetViewImages: blindSpot.streetViewImages,
            aerialImage: blindSpot.aerialImage,
            streetViewLinks: blindSpot.streetViewLinks,
            satelliteViewLink: blindSpot.satelliteViewLink
          },
          environmentalFactors: {
            roadGeometry: blindSpot.roadGeometry,
            vegetation: blindSpot.vegetation,
            structures: blindSpot.structures
          },
          safetyMeasures: {
            warningSignsPresent: blindSpot.warningSignsPresent,
            mirrorInstalled: blindSpot.mirrorInstalled,
            speedLimit: blindSpot.speedLimit
          },
          recommendations: blindSpot.recommendations,
          analysisData: {
            method: blindSpot.analysisMethod,
            confidence: blindSpot.confidence,
            lastUpdated: blindSpot.lastUpdated
          }
        }
      }
    });

  } catch (error) {
    console.error('Get blind spot details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blind spot details',
      error: error.message
    });
  }
});

// ============================================================================
// COMBINED ANALYSIS ENDPOINTS
// ============================================================================

// Get combined sharp turns and blind spots analysis for a route
router.get('/routes/:routeId/visibility-analysis', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { includeImages = 'false' } = req.query;
    
    // Verify route ownership
    const route = await Route.findOne({
      _id: routeId,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Get both sharp turns and blind spots
    const [sharpTurns, blindSpots] = await Promise.all([
      SharpTurn.find({ routeId }).sort({ distanceFromStartKm: 1 }),
      BlindSpot.find({ routeId }).sort({ distanceFromStartKm: 1 })
    ]);

    // Calculate combined risk assessment
    const combinedRiskPoints = [];
    
    // Add sharp turns as risk points
    sharpTurns.forEach(turn => {
      combinedRiskPoints.push({
        type: 'sharp_turn',
        id: turn._id,
        coordinates: { latitude: turn.latitude, longitude: turn.longitude },
        distanceFromStart: turn.distanceFromStartKm,
        riskScore: turn.riskScore,
        severity: turn.turnSeverity,
        angle: turn.turnAngle,
        direction: turn.turnDirection,
        recommendedSpeed: turn.recommendedSpeed,
        streetViewLink: turn.streetViewLink,
        mapsLink: turn.mapsLink
      });
    });

    // Add blind spots as risk points
    blindSpots.forEach(spot => {
      combinedRiskPoints.push({
        type: 'blind_spot',
        id: spot._id,
        coordinates: { latitude: spot.latitude, longitude: spot.longitude },
        distanceFromStart: spot.distanceFromStartKm,
        riskScore: spot.riskScore,
        severity: spot.severityLevel,
        spotType: spot.spotType,
        visibilityDistance: spot.visibilityDistance,
        obstructionHeight: spot.obstructionHeight,
        satelliteViewLink: spot.satelliteViewLink,
        recommendations: spot.recommendations
      });
    });

    // Sort combined points by distance
    combinedRiskPoints.sort((a, b) => a.distanceFromStart - b.distanceFromStart);

    // Calculate overall route visibility risk
    const allRiskScores = combinedRiskPoints.map(point => point.riskScore);
    const avgRiskScore = allRiskScores.length > 0 ? 
      allRiskScores.reduce((sum, score) => sum + score, 0) / allRiskScores.length : 0;
    const maxRiskScore = allRiskScores.length > 0 ? Math.max(...allRiskScores) : 0;
    const criticalPoints = combinedRiskPoints.filter(point => point.riskScore >= 8).length;
    const highRiskPoints = combinedRiskPoints.filter(point => point.riskScore >= 6 && point.riskScore < 8).length;

    // Generate route-level recommendations
    const routeRecommendations = this.generateRouteVisibilityRecommendations(
      sharpTurns.length, 
      blindSpots.length, 
      avgRiskScore, 
      criticalPoints
    );

    res.status(200).json({
      success: true,
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          fromName: route.fromName,
          toName: route.toName,
          totalDistance: route.totalDistance,
          terrain: route.terrain
        },
        overallAssessment: {
          averageRiskScore: Math.round(avgRiskScore * 100) / 100,
          maxRiskScore: maxRiskScore,
          totalRiskPoints: combinedRiskPoints.length,
          criticalPoints: criticalPoints,
          highRiskPoints: highRiskPoints,
          riskDensity: Math.round((combinedRiskPoints.length / route.totalDistance) * 100) / 100, // Points per km
          overallRiskLevel: this.determineOverallRiskLevel(avgRiskScore, criticalPoints, combinedRiskPoints.length)
        },
        breakdown: {
          sharpTurns: {
            total: sharpTurns.length,
            critical: sharpTurns.filter(t => t.riskScore >= 8).length,
            avgRiskScore: sharpTurns.length > 0 ? 
              Math.round((sharpTurns.reduce((sum, t) => sum + t.riskScore, 0) / sharpTurns.length) * 100) / 100 : 0
          },
          blindSpots: {
            total: blindSpots.length,
            critical: blindSpots.filter(s => s.riskScore >= 8).length,
            avgRiskScore: blindSpots.length > 0 ? 
              Math.round((blindSpots.reduce((sum, s) => sum + s.riskScore, 0) / blindSpots.length) * 100) / 100 : 0
          }
        },
        riskPoints: combinedRiskPoints,
        routeRecommendations: routeRecommendations,
        analysisDate: new Date()
      }
    });

  } catch (error) {
    console.error('Get visibility analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching visibility analysis',
      error: error.message
    });
  }
});

// Generate street view images for all risk points
router.post('/routes/:routeId/generate-street-view-images', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { forceRegenerate = false } = req.body;
    
    // Verify route ownership
    const route = await Route.findOne({
      _id: routeId,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    console.log(`🖼️ Starting street view image generation for route: ${route.routeId}`);

    const results = {
      sharpTurns: { processed: 0, updated: 0, errors: 0 },
      blindSpots: { processed: 0, updated: 0, errors: 0 }
    };

    // Process sharp turns
    const sharpTurns = await SharpTurn.find({ routeId });
    for (const turn of sharpTurns) {
      results.sharpTurns.processed++;
      
      try {
        // Skip if images already exist and not forcing regeneration
        if (!forceRegenerate && turn.streetViewImage && turn.mapImage) {
          continue;
        }

        const visualData = await sharpTurnsService.captureSharpTurnVisuals(
          { latitude: turn.latitude, longitude: turn.longitude },
          { direction: turn.turnDirection, angle: turn.turnAngle }
        );

        if (visualData.streetView || visualData.mapImage) {
          await SharpTurn.findByIdAndUpdate(turn._id, {
            streetViewImage: visualData.streetView,
            mapImage: visualData.mapImage,
            lastUpdated: new Date()
          });
          results.sharpTurns.updated++;
        }

      } catch (error) {
        console.error(`Failed to update images for sharp turn ${turn._id}:`, error);
        results.sharpTurns.errors++;
      }
    }

    // Process blind spots
    const blindSpots = await BlindSpot.find({ routeId });
    for (const spot of blindSpots) {
      results.blindSpots.processed++;
      
      try {
        // Skip if images already exist and not forcing regeneration
        if (!forceRegenerate && spot.streetViewImages && spot.streetViewImages.length > 0) {
          continue;
        }

        const visualData = await sharpTurnsService.captureBlindSpotVisuals(
          { latitude: spot.latitude, longitude: spot.longitude },
          spot.spotType
        );

        if (visualData.streetViewImages.length > 0 || visualData.aerialImage) {
          await BlindSpot.findByIdAndUpdate(spot._id, {
            streetViewImages: visualData.streetViewImages,
            aerialImage: visualData.aerialImage,
            lastUpdated: new Date()
          });
          results.blindSpots.updated++;
        }

      } catch (error) {
        console.error(`Failed to update images for blind spot ${spot._id}:`, error);
        results.blindSpots.errors++;
      }
    }

    console.log(`✅ Street view image generation completed for route ${route.routeId}`);

    res.status(200).json({
      success: true,
      message: 'Street view image generation completed',
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName
        },
        results: results,
        summary: {
          totalProcessed: results.sharpTurns.processed + results.blindSpots.processed,
          totalUpdated: results.sharpTurns.updated + results.blindSpots.updated,
          totalErrors: results.sharpTurns.errors + results.blindSpots.errors
        }
      }
    });

  } catch (error) {
    console.error('Generate street view images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating street view images',
      error: error.message
    });
  }
});

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

// Delete sharp turns and blind spots data for a route
router.delete('/routes/:routeId/visibility-data', async (req, res) => {
  try {
    const { routeId } = req.params;
    
    // Verify route ownership
    const route = await Route.findOne({
      _id: routeId,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Delete all sharp turns and blind spots for the route
    const [deletedTurns, deletedSpots] = await Promise.all([
      SharpTurn.deleteMany({ routeId }),
      BlindSpot.deleteMany({ routeId })
    ]);

    console.log(`🗑️ Deleted visibility data for route ${route.routeId}: ${deletedTurns.deletedCount} turns, ${deletedSpots.deletedCount} spots`);

    res.status(200).json({
      success: true,
      message: 'Visibility data deleted successfully',
      data: {
        deletedSharpTurns: deletedTurns.deletedCount,
        deletedBlindSpots: deletedSpots.deletedCount
      }
    });

  } catch (error) {
    console.error('Delete visibility data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting visibility data',
      error: error.message
    });
  }
});

// Get route visibility statistics
router.get('/routes/:routeId/visibility-stats', async (req, res) => {
  try {
    const { routeId } = req.params;
    
    // Verify route ownership
    const route = await Route.findOne({
      _id: routeId,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Get statistics from database aggregations
    const [sharpTurnStats, blindSpotStats] = await Promise.all([
      SharpTurn.getRouteSharpTurnsAnalysis(routeId),
      BlindSpot.getRouteBlindSpotsAnalysis(routeId)
    ]);

    const turnStats = sharpTurnStats[0] || {};
    const spotStats = blindSpotStats[0] || {};

    res.status(200).json({
      success: true,
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          totalDistance: route.totalDistance
        },
        sharpTurns: {
          total: turnStats.totalTurns || 0,
          averageRiskScore: Math.round((turnStats.avgRiskScore || 0) * 100) / 100,
          maxRiskScore: turnStats.maxRiskScore || 0,
          critical: turnStats.criticalTurns || 0,
          high: turnStats.highRiskTurns || 0,
          severityBreakdown: turnStats.severityBreakdown || {},
          density: route.totalDistance > 0 ? 
            Math.round(((turnStats.totalTurns || 0) / route.totalDistance) * 100) / 100 : 0
        },
        blindSpots: {
          total: spotStats.totalBlindSpots || 0,
          averageRiskScore: Math.round((spotStats.avgRiskScore || 0) * 100) / 100,
          maxRiskScore: spotStats.maxRiskScore || 0,
          critical: spotStats.criticalSpots || 0,
          typeBreakdown: spotStats.typeBreakdown || {},
          averageVisibilityDistance: Math.round((spotStats.avgVisibilityDistance || 0) * 100) / 100,
          poorVisibilitySpots: spotStats.poorVisibilitySpots || 0,
          density: route.totalDistance > 0 ? 
            Math.round(((spotStats.totalBlindSpots || 0) / route.totalDistance) * 100) / 100 : 0
        },
        combined: {
          totalRiskPoints: (turnStats.totalTurns || 0) + (spotStats.totalBlindSpots || 0),
          criticalPoints: (turnStats.criticalTurns || 0) + (spotStats.criticalSpots || 0),
          overallRiskDensity: route.totalDistance > 0 ? 
            Math.round((((turnStats.totalTurns || 0) + (spotStats.totalBlindSpots || 0)) / route.totalDistance) * 100) / 100 : 0
        }
      }
    });

  } catch (error) {
    console.error('Get visibility stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching visibility statistics',
      error: error.message
    });
  }
});

// ============================================================================
// HELPER METHODS
// ============================================================================

function generateRouteVisibilityRecommendations(sharpTurnsCount, blindSpotsCount, avgRiskScore, criticalPoints) {
  const recommendations = [];

  if (criticalPoints > 0) {
    recommendations.push({
      priority: 'critical',
      category: 'route_planning',
      recommendation: `CRITICAL: ${criticalPoints} high-risk visibility points identified - consider alternative route or convoy travel`
    });
  }

  if (sharpTurnsCount > 10) {
    recommendations.push({
      priority: 'high',
      category: 'driving',
      recommendation: `Route contains ${sharpTurnsCount} sharp turns - reduce speed and maintain extra following distance`
    });
  }

  if (blindSpotsCount > 5) {
    recommendations.push({
      priority: 'high',
      category: 'safety',
      recommendation: `${blindSpotsCount} blind spots identified - use horn/signals when approaching limited visibility areas`
    });
  }

  if (avgRiskScore > 6) {
    recommendations.push({
      priority: 'medium',
      category: 'preparation',
      recommendation: 'High overall visibility risk - ensure vehicle headlights and signals are functioning properly'
    });
  }

  // General recommendations
  recommendations.push(
    {
      priority: 'medium',
      category: 'timing',
      recommendation: 'Avoid night travel through areas with poor visibility'
    },
    {
      priority: 'low',
      category: 'equipment',
      recommendation: 'Carry emergency signaling equipment (flares, reflectors, horns)'
    }
  );

  return recommendations;
}

function determineOverallRiskLevel(avgRiskScore, criticalPoints, totalPoints) {
  if (criticalPoints > 3 || avgRiskScore >= 8) return 'CRITICAL';
  if (criticalPoints > 1 || avgRiskScore >= 6) return 'HIGH';
  if (totalPoints > 10 || avgRiskScore >= 4) return 'MEDIUM';
  return 'LOW';
}

module.exports = router;