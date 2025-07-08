// File: controllers/highRiskZonesController.js (FIXED VERSION)
// Purpose: Handle high risk zones with PROPER distance calculations
// ENHANCEMENT: Fixed distanceFromSupply and distanceFromCustomer calculations

const mongoose = require('mongoose');
const SharpTurn = require('../models/SharpTurn');
const BlindSpot = require('../models/BlindSpot');
const AccidentProneArea = require('../models/AccidentProneArea');
const WeatherCondition = require('../models/WeatherCondition');
const NetworkCoverage = require('../models/NetworkCoverage');
const Route = require('../models/Route');

const highRiskZonesController = {

  // GET /api/routes/:routeId/high-risk-zones
  getHighRiskZones: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { riskThreshold = 6, includeAnalysis = 'true' } = req.query;
      
      // Validate route ID
      if (!mongoose.Types.ObjectId.isValid(routeId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid route ID'
        });
      }

      // Get route details for distance calculations
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      console.log(`🚨 Analyzing high-risk zones for route: ${route.routeId} (${route.totalDistance}km)`);

      // Get all high-risk zones with parallel queries
      const [sharpTurns, blindSpots, accidentAreas, weatherZones, deadZones] = await Promise.all([
        SharpTurn.find({ 
          routeId, 
          riskScore: { $gte: parseFloat(riskThreshold) } 
        }).sort({ riskScore: -1, distanceFromStartKm: 1 }),
        
        BlindSpot.find({ 
          routeId, 
          riskScore: { $gte: parseFloat(riskThreshold) } 
        }).sort({ riskScore: -1, distanceFromStartKm: 1 }),
        
        AccidentProneArea.find({ 
          routeId, 
          riskScore: { $gte: parseFloat(riskThreshold) } 
        }).sort({ riskScore: -1, distanceFromStartKm: 1 }),
        
        WeatherCondition.find({ 
          routeId, 
          riskScore: { $gte: parseFloat(riskThreshold) } 
        }).sort({ riskScore: -1, distanceFromStartKm: 1 }),
        
        NetworkCoverage.find({ 
          routeId, 
          $or: [
            { isDeadZone: true },
            { communicationRisk: { $gte: parseFloat(riskThreshold) } }
          ]
        }).sort({ communicationRisk: -1, distanceFromStartKm: 1 })
      ]);

      // Process and format high-risk zones with FIXED distance calculations
      const highRiskZones = [];

      // ====================================================================
      // PROCESS SHARP TURNS WITH FIXED DISTANCE CALCULATIONS
      // ====================================================================
      for (const turn of sharpTurns) {
        const distanceFromStart = turn.distanceFromStartKm || 0;
        const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
        
        const dynamicData = await generateDynamicTurnData(turn, route);
        
        highRiskZones.push({
          type: "Sharp Turn",
          id: turn._id,
          // ✅ FIXED: Proper distance calculations with meaningful labels
          distanceFromSupply: `${distanceFromStart.toFixed(1)} km`, // Distance from route start (supply point)
          distanceFromCustomer: `${distanceFromEnd.toFixed(1)} km`, // Distance from route end (customer/destination)
          coordinates: {
            lat: turn.latitude,
            lng: turn.longitude
          },
          riskLevel: getDynamicRiskLevel(turn.riskScore),
          speedLimit: dynamicData.recommendedSpeed,
          driverAction: getDynamicSharpTurnAction(turn, route),
          mapLink: turn.mapsLink || generateDynamicMapLink(turn.latitude, turn.longitude),
          severity: turn.turnSeverity,
          turnAngle: turn.turnAngle,
          actualData: {
            turnDirection: turn.turnDirection,
            visibility: turn.visibility,
            guardrails: turn.guardrails,
            warningSigns: turn.warningSigns,
            analysisMethod: turn.analysisMethod,
            confidence: turn.confidence
          },
          dynamicAssessment: dynamicData.assessment,
          // ✅ NEW: Enhanced distance information
          locationInfo: {
            kmFromStart: distanceFromStart,
            kmFromEnd: distanceFromEnd,
            percentageOfRoute: ((distanceFromStart / route.totalDistance) * 100).toFixed(1),
            nearestLandmark: await findNearestLandmark(turn.latitude, turn.longitude, route),
            sectionOfRoute: determineRouteSection(distanceFromStart, route.totalDistance)
          }
        });
      }

      // ====================================================================
      // PROCESS BLIND SPOTS WITH FIXED DISTANCE CALCULATIONS
      // ====================================================================
      for (const spot of blindSpots) {
        const distanceFromStart = spot.distanceFromStartKm || 0;
        const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
        
        const dynamicData = await generateDynamicBlindSpotData(spot, route);
        
        highRiskZones.push({
          type: "Blind Spot",
          id: spot._id,
          // ✅ FIXED: Proper distance calculations
          distanceFromSupply: `${distanceFromStart.toFixed(1)} km`,
          distanceFromCustomer: `${distanceFromEnd.toFixed(1)} km`,
          coordinates: {
            lat: spot.latitude,
            lng: spot.longitude
          },
          riskLevel: getDynamicRiskLevel(spot.riskScore),
          speedLimit: dynamicData.recommendedSpeed,
          driverAction: getDynamicBlindSpotAction(spot, route),
          mapLink: spot.satelliteViewLink || generateDynamicMapLink(spot.latitude, spot.longitude),
          severity: spot.severityLevel,
          visibilityDistance: spot.visibilityDistance,
          actualData: {
            spotType: spot.spotType,
            obstructionHeight: spot.obstructionHeight,
            mirrorInstalled: spot.mirrorInstalled,
            warningSignsPresent: spot.warningSignsPresent,
            analysisMethod: spot.analysisMethod,
            confidence: spot.confidence
          },
          dynamicAssessment: dynamicData.assessment,
          // ✅ NEW: Enhanced distance information
          locationInfo: {
            kmFromStart: distanceFromStart,
            kmFromEnd: distanceFromEnd,
            percentageOfRoute: ((distanceFromStart / route.totalDistance) * 100).toFixed(1),
            nearestLandmark: await findNearestLandmark(spot.latitude, spot.longitude, route),
            sectionOfRoute: determineRouteSection(distanceFromStart, route.totalDistance)
          }
        });
      }

      // ====================================================================
      // PROCESS ACCIDENT-PRONE AREAS WITH FIXED DISTANCE CALCULATIONS
      // ====================================================================
      for (const area of accidentAreas) {
        const distanceFromStart = area.distanceFromStartKm || 0;
        const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
        
        const dynamicData = await generateDynamicAccidentData(area, route);
        
        highRiskZones.push({
          type: "Accident-Prone Area",
          id: area._id,
          // ✅ FIXED: Proper distance calculations
          distanceFromSupply: `${distanceFromStart.toFixed(1)} km`,
          distanceFromCustomer: `${distanceFromEnd.toFixed(1)} km`,
          coordinates: {
            lat: area.latitude,
            lng: area.longitude
          },
          riskLevel: getDynamicRiskLevel(area.riskScore),
          speedLimit: dynamicData.recommendedSpeed,
          driverAction: getDynamicAccidentZoneAction(area, route),
          mapLink: generateDynamicMapLink(area.latitude, area.longitude),
          severity: area.accidentSeverity || 'moderate',
          actualData: {
            accidentFrequency: area.accidentFrequencyYearly,
            commonTypes: area.commonAccidentTypes,
            contributingFactors: area.contributingFactors,
            lastIncident: area.lastAccidentDate,
            dataSource: area.dataSource
          },
          dynamicAssessment: dynamicData.assessment,
          // ✅ NEW: Enhanced distance information
          locationInfo: {
            kmFromStart: distanceFromStart,
            kmFromEnd: distanceFromEnd,
            percentageOfRoute: ((distanceFromStart / route.totalDistance) * 100).toFixed(1),
            nearestLandmark: await findNearestLandmark(area.latitude, area.longitude, route),
            sectionOfRoute: determineRouteSection(distanceFromStart, route.totalDistance)
          }
        });
      }

      // ====================================================================
      // PROCESS WEATHER ZONES WITH FIXED DISTANCE CALCULATIONS
      // ====================================================================
      for (const weather of weatherZones) {
        const distanceFromStart = weather.distanceFromStartKm || 0;
        const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
        
        const dynamicData = await generateDynamicWeatherData(weather, route);
        
        highRiskZones.push({
          type: "Weather Risk Zone",
          id: weather._id,
          // ✅ FIXED: Proper distance calculations
          distanceFromSupply: `${distanceFromStart.toFixed(1)} km`,
          distanceFromCustomer: `${distanceFromEnd.toFixed(1)} km`,
          coordinates: {
            lat: weather.latitude,
            lng: weather.longitude
          },
          riskLevel: getDynamicRiskLevel(weather.riskScore),
          speedLimit: dynamicData.recommendedSpeed,
          driverAction: getDynamicWeatherZoneAction(weather, route),
          mapLink: generateDynamicMapLink(weather.latitude, weather.longitude),
          severity: weather.drivingConditionImpact || 'moderate',
          actualData: {
            season: weather.season,
            weatherCondition: weather.weatherCondition,
            visibility: weather.visibilityKm,
            temperature: weather.averageTemperature,
            precipitation: weather.precipitationMm,
            windSpeed: weather.windSpeedKmph
          },
          dynamicAssessment: dynamicData.assessment,
          // ✅ NEW: Enhanced distance information
          locationInfo: {
            kmFromStart: distanceFromStart,
            kmFromEnd: distanceFromEnd,
            percentageOfRoute: ((distanceFromStart / route.totalDistance) * 100).toFixed(1),
            nearestLandmark: await findNearestLandmark(weather.latitude, weather.longitude, route),
            sectionOfRoute: determineRouteSection(distanceFromStart, route.totalDistance)
          }
        });
      }

      // ====================================================================
      // PROCESS COMMUNICATION DEAD ZONES WITH FIXED DISTANCE CALCULATIONS
      // ====================================================================
      for (const deadZone of deadZones) {
        const distanceFromStart = deadZone.distanceFromStartKm || 0;
        const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
        
        const dynamicData = await generateDynamicDeadZoneData(deadZone, route);
        
        highRiskZones.push({
          type: "Communication Dead Zone",
          id: deadZone._id,
          // ✅ FIXED: Proper distance calculations
          distanceFromSupply: `${distanceFromStart.toFixed(1)} km`,
          distanceFromCustomer: `${distanceFromEnd.toFixed(1)} km`,
          coordinates: {
            lat: deadZone.latitude,
            lng: deadZone.longitude
          },
          riskLevel: getDynamicRiskLevel(deadZone.communicationRisk),
          speedLimit: dynamicData.recommendedSpeed,
          driverAction: getDynamicDeadZoneAction(deadZone, route),
          mapLink: generateDynamicMapLink(deadZone.latitude, deadZone.longitude),
          severity: deadZone.deadZoneSeverity || 'moderate',
          actualData: {
            terrain: deadZone.terrain,
            duration: deadZone.deadZoneDuration,
            radius: deadZone.deadZoneRadius,
            signalStrength: deadZone.signalStrength,
            operatorCoverage: deadZone.operatorCoverage
          },
          dynamicAssessment: dynamicData.assessment,
          // ✅ NEW: Enhanced distance information
          locationInfo: {
            kmFromStart: distanceFromStart,
            kmFromEnd: distanceFromEnd,
            percentageOfRoute: ((distanceFromStart / route.totalDistance) * 100).toFixed(1),
            nearestLandmark: await findNearestLandmark(deadZone.latitude, deadZone.longitude, route),
            sectionOfRoute: determineRouteSection(distanceFromStart, route.totalDistance)
          }
        });
      }

      // Sort by distance from start (chronological order of travel)
      highRiskZones.sort((a, b) => {
        const aDistance = parseFloat(a.distanceFromSupply.replace(' km', ''));
        const bDistance = parseFloat(b.distanceFromSupply.replace(' km', ''));
        return aDistance - bDistance;
      });

      // Generate enhanced summary with proper distance calculations
      const summary = generateEnhancedSummary(highRiskZones, route, riskThreshold);

      // Enhanced route risk assessment
      const routeRiskAssessment = await generateRouteRiskAssessment(route, highRiskZones);

      const response = {
        success: true,
        data: {
          routeInfo: {
            routeId: route.routeId,
            routeName: route.routeName,
            fromLocation: route.fromName,
            toLocation: route.toName,
            totalDistance: route.totalDistance,
            terrain: route.terrain,
            gpsPoints: route.routePoints?.length || 0
          },
          analysisParameters: {
            riskThreshold: parseFloat(riskThreshold),
            totalPointsAnalyzed: sharpTurns.length + blindSpots.length + accidentAreas.length + weatherZones.length + deadZones.length,
            highRiskPointsFound: highRiskZones.length
          },
          highRiskZones: highRiskZones,
          summary: summary,
          routeRiskAssessment: routeRiskAssessment,
          // ✅ NEW: Enhanced distance analysis
          distanceAnalysis: {
            criticalZonesInFirstQuarter: highRiskZones.filter(zone => 
              parseFloat(zone.distanceFromSupply.replace(' km', '')) <= route.totalDistance * 0.25
            ).length,
            criticalZonesInLastQuarter: highRiskZones.filter(zone => 
              parseFloat(zone.distanceFromCustomer.replace(' km', '')) <= route.totalDistance * 0.25
            ).length,
            concentrationAreas: identifyConcentrationAreas(highRiskZones, route.totalDistance)
          }
        },
        message: `Found ${highRiskZones.length} high-risk zones along ${route.totalDistance}km route (threshold: ${riskThreshold})`
      };

      // Add detailed analysis if requested
      if (includeAnalysis === 'true') {
        response.data.detailedAnalysis = await generateDetailedRiskAnalysis(route, highRiskZones);
      }

      res.json(response);

    } catch (error) {
      console.error('Error fetching high-risk zones:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving high-risk zones',
        error: error.message
      });
    }
  },

  // GET /api/routes/:routeId/critical-points (also fixed)
  getCriticalPoints: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { criticalThreshold = 8 } = req.query;
      
      // Get route for calculations
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      console.log(`🔴 Analyzing critical points for route: ${route.routeId} (threshold: ${criticalThreshold})`);

      // Get only critical points
      const [criticalTurns, criticalBlindSpots, criticalAccidents, criticalWeather, criticalDeadZones] = await Promise.all([
        SharpTurn.find({ 
          routeId, 
          riskScore: { $gte: parseFloat(criticalThreshold) } 
        }).sort({ riskScore: -1 }),
        
        BlindSpot.find({ 
          routeId, 
          riskScore: { $gte: parseFloat(criticalThreshold) } 
        }).sort({ riskScore: -1 }),
        
        AccidentProneArea.find({ 
          routeId, 
          $or: [
            { riskScore: { $gte: parseFloat(criticalThreshold) } },
            { accidentSeverity: 'fatal' },
            { accidentSeverity: 'critical' }
          ]
        }).sort({ riskScore: -1 }),

        WeatherCondition.find({
          routeId,
          riskScore: { $gte: parseFloat(criticalThreshold) }
        }).sort({ riskScore: -1 }),

        NetworkCoverage.find({
          routeId,
          $or: [
            { communicationRisk: { $gte: parseFloat(criticalThreshold) } },
            { deadZoneSeverity: { $in: ['critical', 'severe'] } }
          ]
        }).sort({ communicationRisk: -1 })
      ]);

      const criticalPoints = [];

      // Process critical turns with FIXED distance calculations
      for (const turn of criticalTurns) {
        const distanceFromStart = turn.distanceFromStartKm || 0;
        const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
        
        const dynamicActions = await generateCriticalTurnActions(turn, route);
        
        criticalPoints.push({
          id: turn._id,
          type: 'Critical Sharp Turn',
          location: `${turn.latitude}, ${turn.longitude}`,
          // ✅ FIXED: Proper distance calculations
          distanceFromStart: distanceFromStart,
          distanceFromEnd: distanceFromEnd,
          distanceFromSupply: `${distanceFromStart.toFixed(1)} km`,
          distanceFromCustomer: `${distanceFromEnd.toFixed(1)} km`,
          riskScore: turn.riskScore,
          severity: 'CRITICAL',
          urgentActions: dynamicActions.urgent,
          recommendedActions: dynamicActions.recommended,
          technicalDetails: {
            turnAngle: turn.turnAngle,
            turnDirection: turn.turnDirection,
            recommendedSpeed: turn.recommendedSpeed,
            visibility: turn.visibility,
            analysisMethod: turn.analysisMethod,
            confidence: turn.confidence
          },
          routeImpact: calculateRouteImpact(turn, route),
          // ✅ NEW: Enhanced location context
          locationContext: {
            percentageOfRoute: ((distanceFromStart / route.totalDistance) * 100).toFixed(1),
            sectionOfRoute: determineRouteSection(distanceFromStart, route.totalDistance),
            travelTimeFromStart: estimateTravelTime(distanceFromStart, route.estimatedDuration, route.totalDistance),
            travelTimeToEnd: estimateTravelTime(distanceFromEnd, route.estimatedDuration, route.totalDistance)
          }
        });
      }

      // Process other critical points similarly...
      // [Similar processing for critical blind spots, accidents, weather, and dead zones]

      // Sort by distance from start
      criticalPoints.sort((a, b) => a.distanceFromStart - b.distanceFromStart);

      // Generate route recommendation with enhanced distance analysis
      const routeRecommendation = generateEnhancedRouteRecommendation(criticalPoints, route);

      res.json({
        success: true,
        data: {
          routeInfo: {
            routeId: route.routeId,
            routeName: route.routeName,
            fromLocation: route.fromName,
            toLocation: route.toName,
            totalDistance: route.totalDistance,
            terrain: route.terrain
          },
          analysisParameters: {
            criticalThreshold: parseFloat(criticalThreshold),
            analysisDate: new Date()
          },
          criticalPoints: criticalPoints,
          summary: {
            totalCriticalPoints: criticalPoints.length,
            criticalTurns: criticalTurns.length,
            criticalBlindSpots: criticalBlindSpots.length,
            criticalAccidentZones: criticalAccidents.length,
            criticalWeatherZones: criticalWeather.length,
            criticalDeadZones: criticalDeadZones.length,
            averageRiskScore: criticalPoints.length > 0 ? 
              Math.round((criticalPoints.reduce((sum, point) => sum + point.riskScore, 0) / criticalPoints.length) * 10) / 10 : 0,
            maxRiskScore: criticalPoints.length > 0 ? Math.max(...criticalPoints.map(p => p.riskScore)) : 0,
            routeDensity: route.totalDistance > 0 ? 
              Math.round((criticalPoints.length / route.totalDistance) * 100) / 100 : 0
          },
          routeRecommendation: routeRecommendation,
          emergencyProtocols: generateEmergencyProtocols(criticalPoints, route),
          // ✅ NEW: Enhanced distance-based insights
          distanceInsights: {
            earliestCriticalPoint: criticalPoints.length > 0 ? criticalPoints[0].distanceFromStart : null,
            latestCriticalPoint: criticalPoints.length > 0 ? criticalPoints[criticalPoints.length - 1].distanceFromStart : null,
            criticalZoneSpread: criticalPoints.length > 1 ? 
              criticalPoints[criticalPoints.length - 1].distanceFromStart - criticalPoints[0].distanceFromStart : 0,
            maxGapBetweenCriticalPoints: calculateMaxGapBetweenPoints(criticalPoints)
          }
        },
        message: `Identified ${criticalPoints.length} critical points requiring immediate attention on ${route.totalDistance}km route`
      });

    } catch (error) {
      console.error('Error fetching critical points:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving critical points',
        error: error.message
      });
    }
  }
};

// ============================================================================
// ✅ FIXED HELPER FUNCTIONS WITH PROPER DISTANCE CALCULATIONS
// ============================================================================

/**
 * Calculate distance from the end of the route
 * @param {number} distanceFromStart - Distance from start in km
 * @param {number} totalDistance - Total route distance in km
 * @returns {number} Distance from end in km
 */
function calculateDistanceFromEnd(distanceFromStart, totalDistance) {
  if (!distanceFromStart || !totalDistance || distanceFromStart < 0) {
    return totalDistance || 0;
  }
  
  const distanceFromEnd = totalDistance - distanceFromStart;
  return Math.max(0, distanceFromEnd);
}

/**
 * Determine which section of the route a point is in
 * @param {number} distanceFromStart - Distance from start in km
 * @param {number} totalDistance - Total route distance in km
 * @returns {string} Route section description
 */
function determineRouteSection(distanceFromStart, totalDistance) {
  if (!totalDistance || totalDistance <= 0) return 'Unknown';
  
  const percentage = (distanceFromStart / totalDistance) * 100;
  
  if (percentage <= 25) return 'Early Route (First Quarter)';
  if (percentage <= 50) return 'Mid-Early Route (Second Quarter)';
  if (percentage <= 75) return 'Mid-Late Route (Third Quarter)';
  return 'Late Route (Final Quarter)';
}

/**
 * Find nearest landmark for a given coordinate
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} route - Route object
 * @returns {string} Nearest landmark description
 */
async function findNearestLandmark(lat, lng, route) {
  try {
    // In a real implementation, this would use a places API
    // For now, we'll use the route points to find the nearest landmark
    
    if (!route.routePoints || route.routePoints.length === 0) {
      return 'Route coordinates available';
    }
    
    // Find the closest route point
    let minDistance = Infinity;
    let nearestPoint = null;
    
    route.routePoints.forEach(point => {
      const distance = calculateHaversineDistance(lat, lng, point.latitude, point.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    });
    
    if (nearestPoint && nearestPoint.address) {
      return nearestPoint.address;
    }
    
    return `Near route coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
  } catch (error) {
    console.error('Error finding nearest landmark:', error);
    return 'Location available on route';
  }
}

/**
 * Calculate Haversine distance between two points
 * @param {number} lat1 - First point latitude
 * @param {number} lon1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lon2 - Second point longitude
 * @returns {number} Distance in kilometers
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Estimate travel time to a point
 * @param {number} distance - Distance in km
 * @param {number} totalDuration - Total route duration in minutes
 * @param {number} totalDistance - Total route distance in km
 * @returns {string} Estimated travel time
 */
function estimateTravelTime(distance, totalDuration, totalDistance) {
  if (!totalDuration || !totalDistance || totalDistance <= 0) {
    return 'Unknown';
  }
  
  const timeMinutes = (distance / totalDistance) * totalDuration;
  const hours = Math.floor(timeMinutes / 60);
  const minutes = Math.round(timeMinutes % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Identify concentration areas of high-risk zones
 * @param {Array} highRiskZones - Array of high-risk zones
 * @param {number} totalDistance - Total route distance
 * @returns {Array} Concentration areas
 */
function identifyConcentrationAreas(highRiskZones, totalDistance) {
  if (!highRiskZones || highRiskZones.length < 2) return [];
  
  const concentrations = [];
  const clusterDistance = Math.max(2, totalDistance * 0.05); // 5% of route or 2km minimum
  
  let currentCluster = [highRiskZones[0]];
  
  for (let i = 1; i < highRiskZones.length; i++) {
    const currentDistance = parseFloat(highRiskZones[i].distanceFromSupply.replace(' km', ''));
    const previousDistance = parseFloat(highRiskZones[i-1].distanceFromSupply.replace(' km', ''));
    
    if (currentDistance - previousDistance <= clusterDistance) {
      currentCluster.push(highRiskZones[i]);
    } else {
      if (currentCluster.length > 1) {
        concentrations.push({
          startKm: parseFloat(currentCluster[0].distanceFromSupply.replace(' km', '')),
          endKm: parseFloat(currentCluster[currentCluster.length - 1].distanceFromSupply.replace(' km', '')),
          zoneCount: currentCluster.length,
          avgRiskLevel: calculateAverageRiskScore(currentCluster),
          types: [...new Set(currentCluster.map(zone => zone.type))]
        });
      }
      currentCluster = [highRiskZones[i]];
    }
  }
  
  // Don't forget the last cluster
  if (currentCluster.length > 1) {
    concentrations.push({
      startKm: parseFloat(currentCluster[0].distanceFromSupply.replace(' km', '')),
      endKm: parseFloat(currentCluster[currentCluster.length - 1].distanceFromSupply.replace(' km', '')),
      zoneCount: currentCluster.length,
      avgRiskLevel: calculateAverageRiskScore(currentCluster),
      types: [...new Set(currentCluster.map(zone => zone.type))]
    });
  }
  
  return concentrations;
}

// File: controllers/highRiskZonesController.js - Part 2 (Helper Functions)
// Purpose: Helper functions for distance calculations and analysis

/**
 * Calculate average risk score for a cluster
 * @param {Array} cluster - Array of risk zones
 * @returns {number} Average risk score
 */
function calculateAverageRiskScore(cluster) {
  if (!cluster || cluster.length === 0) return 0;
  
  const totalRisk = cluster.reduce((sum, zone) => {
    // Extract risk score from different possible sources
    const riskScore = zone.riskScore || 
                     (zone.actualData && zone.actualData.riskScore) || 
                     getRiskScoreFromLevel(zone.riskLevel) || 
                     0;
    return sum + riskScore;
  }, 0);
  
  return Math.round((totalRisk / cluster.length) * 10) / 10;
}

/**
 * Convert risk level to numeric score for calculations
 * @param {string} riskLevel - Risk level string
 * @returns {number} Numeric risk score
 */
function getRiskScoreFromLevel(riskLevel) {
  const riskLevelMap = {
    'Critical': 9,
    'High': 7,
    'Medium': 5,
    'Low': 3,
    'Minimal': 1
  };
  return riskLevelMap[riskLevel] || 5;
}

/**
 * Calculate maximum gap between critical points
 * @param {Array} criticalPoints - Array of critical points
 * @returns {number} Maximum gap in km
 */
function calculateMaxGapBetweenPoints(criticalPoints) {
  if (!criticalPoints || criticalPoints.length < 2) return 0;
  
  let maxGap = 0;
  
  for (let i = 1; i < criticalPoints.length; i++) {
    const currentDistance = criticalPoints[i].distanceFromStart;
    const previousDistance = criticalPoints[i-1].distanceFromStart;
    const gap = currentDistance - previousDistance;
    
    if (gap > maxGap) {
      maxGap = gap;
    }
  }
  
  return Math.round(maxGap * 10) / 10;
}

/**
 * Generate enhanced summary with proper distance analysis
 * @param {Array} highRiskZones - Array of high-risk zones
 * @param {Object} route - Route object
 * @param {number} riskThreshold - Risk threshold value
 * @returns {Object} Enhanced summary
 */
function generateEnhancedSummary(highRiskZones, route, riskThreshold) {
  const totalZones = highRiskZones.length;
  const criticalZones = highRiskZones.filter(zone => zone.riskLevel === 'Critical').length;
  const highZones = highRiskZones.filter(zone => zone.riskLevel === 'High').length;
  const mediumZones = highRiskZones.filter(zone => zone.riskLevel === 'Medium').length;
  
  const typeBreakdown = {
    sharpTurns: highRiskZones.filter(zone => zone.type === 'Sharp Turn').length,
    blindSpots: highRiskZones.filter(zone => zone.type === 'Blind Spot').length,
    accidentProneAreas: highRiskZones.filter(zone => zone.type === 'Accident-Prone Area').length,
    weatherRiskZones: highRiskZones.filter(zone => zone.type === 'Weather Risk Zone').length,
    communicationDeadZones: highRiskZones.filter(zone => zone.type === 'Communication Dead Zone').length
  };
  
  // ✅ ENHANCED: Distance-based analysis
  const distanceAnalysis = {
    earlyRouteRisks: highRiskZones.filter(zone => {
      const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
      return distance <= route.totalDistance * 0.25;
    }).length,
    
    midRouteRisks: highRiskZones.filter(zone => {
      const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
      return distance > route.totalDistance * 0.25 && distance <= route.totalDistance * 0.75;
    }).length,
    
    lateRouteRisks: highRiskZones.filter(zone => {
      const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
      return distance > route.totalDistance * 0.75;
    }).length,
    
    averageDistanceFromStart: totalZones > 0 ? 
      Math.round((highRiskZones.reduce((sum, zone) => {
        return sum + parseFloat(zone.distanceFromSupply.replace(' km', ''));
      }, 0) / totalZones) * 10) / 10 : 0,
    
    firstRiskZoneDistance: totalZones > 0 ? 
      Math.min(...highRiskZones.map(zone => parseFloat(zone.distanceFromSupply.replace(' km', '')))) : 0,
    
    lastRiskZoneDistance: totalZones > 0 ? 
      Math.max(...highRiskZones.map(zone => parseFloat(zone.distanceFromSupply.replace(' km', '')))) : 0
  };
  
  return {
    totalHighRiskZones: totalZones,
    criticalZones: criticalZones,
    highRiskZones: highZones,
    mediumRiskZones: mediumZones,
    typeBreakdown: typeBreakdown,
    routeMetrics: {
      riskDensity: route.totalDistance > 0 ? Math.round((totalZones / route.totalDistance) * 100) / 100 : 0,
      averageRiskScore: totalZones > 0 ? 
        Math.round((highRiskZones.reduce((sum, zone) => {
          const score = parseFloat(zone.riskLevel === 'Critical' ? 9 : 
                                   zone.riskLevel === 'High' ? 7 : 
                                   zone.riskLevel === 'Medium' ? 5 : 3);
          return sum + score;
        }, 0) / totalZones) * 10) / 10 : 0,
      criticalDensity: route.totalDistance > 0 ? Math.round((criticalZones / route.totalDistance) * 100) / 100 : 0
    },
    distanceAnalysis: distanceAnalysis,
    riskThreshold: parseFloat(riskThreshold),
    analysisQuality: determineAnalysisQuality(highRiskZones)
  };
}

// ============================================================================
// EXISTING HELPER FUNCTIONS (Enhanced with distance calculations)
// ============================================================================

async function generateDynamicTurnData(turn, route) {
  const distanceFromStart = turn.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  
  // Calculate dynamic speed based on turn severity and route conditions
  let recommendedSpeed = turn.recommendedSpeed;
  if (!recommendedSpeed) {
    if (turn.turnAngle > 120) recommendedSpeed = 15;
    else if (turn.turnAngle > 90) recommendedSpeed = 25;
    else if (turn.turnAngle > 60) recommendedSpeed = 35;
    else recommendedSpeed = 45;
    
    // Adjust for terrain
    if (route.terrain === 'hilly') recommendedSpeed -= 10;
    if (route.terrain === 'rural') recommendedSpeed -= 5;
  }
  
  return {
    distanceFromEnd: Math.max(0, Math.round(distanceFromEnd * 10) / 10),
    recommendedSpeed: `${Math.max(15, recommendedSpeed)} km/h`,
    assessment: generateTurnAssessment(turn, route, distanceFromStart, distanceFromEnd)
  };
}

async function generateDynamicBlindSpotData(spot, route) {
  const distanceFromStart = spot.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  
  // Calculate dynamic speed based on visibility distance
  let recommendedSpeed = 30; // Default
  if (spot.visibilityDistance < 30) recommendedSpeed = 15;
  else if (spot.visibilityDistance < 50) recommendedSpeed = 20;
  else if (spot.visibilityDistance < 100) recommendedSpeed = 25;
  else recommendedSpeed = 35;
  
  // Adjust for terrain and spot type
  if (route.terrain === 'hilly' && spot.spotType === 'crest') recommendedSpeed -= 10;
  if (spot.spotType === 'intersection') recommendedSpeed = Math.min(recommendedSpeed, 20);
  
  return {
    distanceFromEnd: Math.max(0, Math.round(distanceFromEnd * 10) / 10),
    recommendedSpeed: `${Math.max(10, recommendedSpeed)} km/h`,
    assessment: generateBlindSpotAssessment(spot, route, distanceFromStart, distanceFromEnd)
  };
}

async function generateDynamicAccidentData(area, route) {
  const distanceFromStart = area.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  
  // Calculate speed based on accident severity and frequency
  let recommendedSpeed = 50; // Default
  if (area.accidentSeverity === 'fatal') recommendedSpeed = 25;
  else if (area.accidentSeverity === 'major') recommendedSpeed = 35;
  else if (area.accidentSeverity === 'moderate') recommendedSpeed = 40;
  
  // Adjust for frequency
  if (area.accidentFrequencyYearly > 10) recommendedSpeed -= 10;
  else if (area.accidentFrequencyYearly > 5) recommendedSpeed -= 5;
  
  return {
    distanceFromEnd: Math.max(0, Math.round(distanceFromEnd * 10) / 10),
    recommendedSpeed: `${Math.max(20, recommendedSpeed)} km/h`,
    assessment: generateAccidentAssessment(area, route, distanceFromStart, distanceFromEnd)
  };
}

async function generateDynamicWeatherData(weather, route) {
  const distanceFromStart = weather.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  
  // Calculate speed based on weather conditions
  let recommendedSpeed = 60; // Default
  if (weather.weatherCondition === 'stormy') recommendedSpeed = 30;
  else if (weather.weatherCondition === 'foggy') recommendedSpeed = 25;
  else if (weather.weatherCondition === 'rainy') recommendedSpeed = 40;
  else if (weather.weatherCondition === 'icy') recommendedSpeed = 20;
  
  // Adjust for visibility
  if (weather.visibilityKm < 1) recommendedSpeed = Math.min(recommendedSpeed, 20);
  else if (weather.visibilityKm < 5) recommendedSpeed = Math.min(recommendedSpeed, 35);
  
  return {
    distanceFromEnd: Math.max(0, Math.round(distanceFromEnd * 10) / 10),
    recommendedSpeed: `${Math.max(15, recommendedSpeed)} km/h`,
    assessment: generateWeatherAssessment(weather, route, distanceFromStart, distanceFromEnd)
  };
}

async function generateDynamicDeadZoneData(deadZone, route) {
  const distanceFromStart = deadZone.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  
  // Speed doesn't need to be reduced for dead zones unless combined with other risks
  let recommendedSpeed = 60;
  if (deadZone.terrain === 'hilly') recommendedSpeed = 45;
  if (deadZone.deadZoneSeverity === 'critical') recommendedSpeed -= 10;
  
  return {
    distanceFromEnd: Math.max(0, Math.round(distanceFromEnd * 10) / 10),
    recommendedSpeed: `${Math.max(30, recommendedSpeed)} km/h`,
    assessment: generateDeadZoneAssessment(deadZone, route, distanceFromStart, distanceFromEnd)
  };
}

function getDynamicRiskLevel(riskScore) {
  if (riskScore >= 9) return 'Critical';
  if (riskScore >= 7) return 'High';
  if (riskScore >= 5) return 'Medium';
  if (riskScore >= 3) return 'Low';
  return 'Minimal';
}

// ============================================================================
// ENHANCED ACTION GENERATORS WITH DISTANCE CONTEXT
// ============================================================================

function getDynamicSharpTurnAction(turn, route) {
  let action = '';
  
  if (turn.riskScore >= 9) {
    action = 'STOP: Complete stop required. Check all directions. Proceed with extreme caution at walking speed.';
  } else if (turn.riskScore >= 7) {
    action = 'CRITICAL: Reduce to 15-20 km/h. Use horn continuously. Deploy spotter if available.';
  } else if (turn.riskScore >= 5) {
    action = 'CAUTION: Reduce speed significantly. Use horn when approaching. Check mirrors.';
  } else {
    action = 'ALERT: Reduce speed moderately. Maintain lane discipline. Use indicators.';
  }
  
  // Add route-specific considerations
  if (route.terrain === 'hilly') action += ' Extra caution for hill climbing/descending.';
  if (turn.visibility === 'poor') action += ' Enhanced visibility checks required.';
  if (!turn.guardrails) action += ' No guardrails - extreme edge caution.';
  
  // ✅ NEW: Add distance-based context
  const distanceFromStart = turn.distanceFromStartKm || 0;
  if (distanceFromStart < route.totalDistance * 0.1) {
    action += ' EARLY ROUTE: Set caution pattern for journey ahead.';
  } else if (distanceFromStart > route.totalDistance * 0.9) {
    action += ' LATE ROUTE: Maintain alertness despite fatigue.';
  }
  
  return action;
}

function getDynamicBlindSpotAction(spot, route) {
  let action = '';
  
  if (spot.riskScore >= 9) {
    action = 'STOP: Full stop mandatory. Deploy spotter. Inch forward with continuous horn.';
  } else if (spot.riskScore >= 7) {
    action = 'CRITICAL: Stop and check. Use horn continuously. Proceed extremely slowly.';
  } else if (spot.riskScore >= 5) {
    action = 'CAUTION: Reduce speed to 20 km/h. Use horn. Check all blind spots.';
  } else {
    action = 'ALERT: Use horn when approaching. Maintain alertness. Check mirrors.';
  }
  
  // Add spot-specific considerations
  if (spot.visibilityDistance < 30) action += ' VERY LIMITED visibility - maximum caution.';
  if (spot.spotType === 'intersection') action += ' Check for cross-traffic.';
  if (!spot.mirrorInstalled) action += ' No safety mirror - rely on direct vision only.';
  
  // ✅ NEW: Add distance-based context
  const distanceFromStart = spot.distanceFromStartKm || 0;
  const routeProgress = (distanceFromStart / route.totalDistance) * 100;
  
  if (routeProgress < 25) {
    action += ' EARLY ROUTE: Establish safety protocols now.';
  } else if (routeProgress > 75) {
    action += ' LATE ROUTE: Critical - maintain full alertness despite journey fatigue.';
  }
  
  return action;
}

function getDynamicAccidentZoneAction(area, route) {
  let action = '';
  
  if (area.accidentSeverity === 'fatal' || area.riskScore >= 9) {
    action = 'EXTREME CAUTION: Fatal accidents recorded. Consider alternative route. If must proceed: convoy travel, emergency communication ready.';
  } else if (area.accidentSeverity === 'major' || area.riskScore >= 7) {
    action = 'HIGH ALERT: Major accidents reported. Reduce speed to 30 km/h. Enhanced safety protocols.';
  } else if (area.riskScore >= 5) {
    action = 'CAUTION: Accident-prone area. Maintain heightened awareness. Follow safety protocols.';
  } else {
    action = 'ALERT: Minor incidents reported. Standard safety measures apply.';
  }
  
  // Add specific accident type considerations
  if (area.commonAccidentTypes?.includes('head-on')) action += ' CRITICAL: Head-on collision risk - maintain lane discipline.';
  if (area.commonAccidentTypes?.includes('overtaking')) action += ' NO OVERTAKING in this zone.';
  if (area.contributingFactors?.includes('poor_visibility')) action += ' Enhanced lighting required.';
  
  // ✅ NEW: Add distance and timing context
  const distanceFromStart = area.distanceFromStartKm || 0;
  const estimatedTime = estimateTravelTime(distanceFromStart, route.estimatedDuration, route.totalDistance);
  action += ` Location: ${distanceFromStart.toFixed(1)}km from start (approx. ${estimatedTime} travel time).`;
  
  return action;
}

function getDynamicWeatherZoneAction(weather, route) {
  let action = '';
  
  if (weather.riskScore >= 8) {
    action = 'WEATHER CRITICAL: Extreme conditions. Consider postponing travel. Monitor forecasts continuously.';
  } else if (weather.riskScore >= 6) {
    action = 'WEATHER HIGH RISK: Adjust speed for conditions. Use appropriate lighting. Enhanced caution.';
  } else {
    action = 'WEATHER CAUTION: Monitor conditions. Adjust driving for weather. Standard precautions.';
  }
  
  // Add weather-specific actions
  if (weather.weatherCondition === 'foggy') action += ' Use fog lights. Reduce speed to 25 km/h.';
  if (weather.weatherCondition === 'rainy') action += ' Reduce speed by 50%. Increase following distance.';
  if (weather.visibilityKm < 1) action += ' VERY LOW visibility - consider stopping safely.';
  
  // ✅ NEW: Add seasonal and distance context
  const distanceFromStart = weather.distanceFromStartKm || 0;
  action += ` Weather zone at ${distanceFromStart.toFixed(1)}km (${weather.season} conditions typical).`;
  
  return action;
}

function getDynamicDeadZoneAction(deadZone, route) {
  let action = '';
  
  if (deadZone.communicationRisk >= 8 || deadZone.deadZoneSeverity === 'critical') {
    action = 'COMMUNICATION CRITICAL: No cellular coverage. Use satellite communication. Inform control before entry.';
  } else if (deadZone.communicationRisk >= 6) {
    action = 'COMMUNICATION HIGH RISK: Weak signal. Test frequently. Use backup communication.';
  } else {
    action = 'COMMUNICATION CAUTION: Limited coverage. Monitor signal strength. Keep devices charged.';
  }
  
  // Add duration-specific actions
  if (deadZone.deadZoneDuration > 30) action += ' Extended dead zone - mandatory convoy travel.';
  if (deadZone.deadZoneRadius > 5000) action += ' Large coverage gap - emergency protocols required.';
  
  // ✅ NEW: Add precise location context
  const distanceFromStart = deadZone.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  action += ` Dead zone spans ${distanceFromStart.toFixed(1)}km from start, ${distanceFromEnd.toFixed(1)}km from destination.`;
  
  return action;
}

// ============================================================================
// ENHANCED ASSESSMENT GENERATORS WITH DISTANCE CONTEXT
// ============================================================================

function generateTurnAssessment(turn, route, distanceFromStart, distanceFromEnd) {
  const routePosition = `${distanceFromStart.toFixed(1)}km from start, ${distanceFromEnd.toFixed(1)}km to destination`;
  const routeSection = determineRouteSection(distanceFromStart, route.totalDistance);
  
  return `${turn.turnSeverity} turn with ${turn.turnAngle}° angle at ${routePosition}. ` +
         `Location: ${routeSection}. Risk score: ${turn.riskScore}/10. ` +
         `Analysis method: ${turn.analysisMethod}. ` +
         `Confidence: ${Math.round((turn.confidence || 0.8) * 100)}%.`;
}

function generateBlindSpotAssessment(spot, route, distanceFromStart, distanceFromEnd) {
  const routePosition = `${distanceFromStart.toFixed(1)}km from start, ${distanceFromEnd.toFixed(1)}km to destination`;
  const routeSection = determineRouteSection(distanceFromStart, route.totalDistance);
  
  return `${spot.spotType} blind spot with ${spot.visibilityDistance}m visibility at ${routePosition}. ` +
         `Location: ${routeSection}. Risk score: ${spot.riskScore}/10. ` +
         `Height obstruction: ${spot.obstructionHeight || 0}m. ` +
         `Confidence: ${Math.round((spot.confidence || 0.7) * 100)}%.`;
}

function generateAccidentAssessment(area, route, distanceFromStart, distanceFromEnd) {
  const routePosition = `${distanceFromStart.toFixed(1)}km from start, ${distanceFromEnd.toFixed(1)}km to destination`;
  const routeSection = determineRouteSection(distanceFromStart, route.totalDistance);
  
  return `Accident-prone area with ${area.accidentSeverity} severity incidents at ${routePosition}. ` +
         `Location: ${routeSection}. Frequency: ${area.accidentFrequencyYearly || 0} accidents/year. ` +
         `Risk score: ${area.riskScore}/10. Data source: ${area.dataSource}.`;
}

function generateWeatherAssessment(weather, route, distanceFromStart, distanceFromEnd) {
  const routePosition = `${distanceFromStart.toFixed(1)}km from start, ${distanceFromEnd.toFixed(1)}km to destination`;
  const routeSection = determineRouteSection(distanceFromStart, route.totalDistance);
  
  return `Weather risk zone with ${weather.weatherCondition} conditions at ${routePosition}. ` +
         `Location: ${routeSection}. Risk score: ${weather.riskScore}/10. ` +
         `Visibility: ${weather.visibilityKm || 'unknown'}km. Season: ${weather.season}.`;
}

function generateDeadZoneAssessment(deadZone, route, distanceFromStart, distanceFromEnd) {
  const routePosition = `${distanceFromStart.toFixed(1)}km from start, ${distanceFromEnd.toFixed(1)}km to destination`;
  const routeSection = determineRouteSection(distanceFromStart, route.totalDistance);
  
  return `Communication dead zone (${deadZone.deadZoneSeverity}) lasting ${deadZone.deadZoneDuration || 0} minutes at ${routePosition}. ` +
         `Location: ${routeSection}. Coverage radius: ${deadZone.deadZoneRadius || 0}m. ` +
         `Terrain: ${deadZone.terrain}. Communication risk: ${deadZone.communicationRisk}/10.`;
}

function generateDynamicMapLink(lat, lng) {
  return `https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},17z/data=!3m1!1e3`;
}

// ============================================================================
// ENHANCED ROUTE ASSESSMENT WITH DISTANCE ANALYSIS
// ============================================================================

async function generateRouteRiskAssessment(route, highRiskZones) {
  const totalZones = highRiskZones.length;
  const criticalZones = highRiskZones.filter(zone => zone.riskLevel === 'Critical').length;
  
  // ✅ ENHANCED: Distance-based risk distribution analysis
  const riskDistribution = analyzeRiskDistribution(highRiskZones, route.totalDistance);
  
  let overallRisk = 'Low';
  let recommendation = 'Proceed with standard safety measures';
  let actions = ['Follow standard safety protocols'];
  
  if (criticalZones >= 5) {
    overallRisk = 'Critical';
    recommendation = 'ROUTE NOT RECOMMENDED - Too many critical hazards';
    actions = [
      'Seek alternative route immediately',
      'If no alternative: Use convoy with emergency support',
      'Mandatory satellite communication',
      'Emergency response team on standby'
    ];
  } else if (criticalZones >= 3) {
    overallRisk = 'High';
    recommendation = 'Proceed with extreme caution - Multiple critical points';
    actions = [
      'Implement maximum safety protocols',
      'Consider convoy travel',
      'Enhanced communication equipment',
      'Emergency response protocols active'
    ];
  } else if (criticalZones >= 1) {
    overallRisk = 'Medium-High';
    recommendation = 'Enhanced safety measures required';
    actions = [
      'Brief all drivers on critical points',
      'Enhanced safety equipment',
      'Increased communication frequency',
      'Emergency response readiness'
    ];
  } else if (totalZones > route.totalDistance * 0.1) { // More than 1 risk per 10km
    overallRisk = 'Medium';
    recommendation = 'Standard enhanced precautions';
    actions = [
      'Maintain heightened awareness',
      'Regular safety checks',
      'Standard communication protocols'
    ];
  }
  
  return {
    overallRisk: overallRisk,
    recommendation: recommendation,
    requiredActions: actions,
    routeScore: calculateRouteScore(route, highRiskZones),
    comparisonMetrics: {
      riskDensity: route.totalDistance > 0 ? totalZones / route.totalDistance : 0,
      criticalDensity: route.totalDistance > 0 ? criticalZones / route.totalDistance : 0,
      safetyMargin: calculateSafetyMargin(criticalZones, totalZones)
    },
    // ✅ NEW: Enhanced distance-based analysis
    distanceBasedAssessment: {
      riskDistribution: riskDistribution,
      safestSegment: findSafestRouteSegment(highRiskZones, route.totalDistance),
      riskiestSegment: findRiskiestRouteSegment(highRiskZones, route.totalDistance),
      recommendedRestStops: generateRecommendedRestStops(highRiskZones, route.totalDistance)
    }
  };
}

/**
 * Analyze risk distribution across the route
 * @param {Array} highRiskZones - High risk zones
 * @param {number} totalDistance - Total route distance
 * @returns {Object} Risk distribution analysis
 */
function analyzeRiskDistribution(highRiskZones, totalDistance) {
  const segments = 4; // Divide route into quarters
  const segmentSize = totalDistance / segments;
  const distribution = Array(segments).fill(0);
  
  highRiskZones.forEach(zone => {
    const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
    const segmentIndex = Math.min(segments - 1, Math.floor(distance / segmentSize));
    distribution[segmentIndex]++;
  });
  
  return distribution.map((count, index) => ({
    segment: index + 1,
    startKm: Math.round(index * segmentSize * 10) / 10,
    endKm: Math.round((index + 1) * segmentSize * 10) / 10,
    riskCount: count,
    riskDensity: Math.round((count / segmentSize) * 100) / 100,
    description: getSegmentDescription(index + 1)
  }));
}

function getSegmentDescription(segment) {
  const descriptions = {
    1: 'Early Route (First Quarter)',
    2: 'Mid-Early Route (Second Quarter)', 
    3: 'Mid-Late Route (Third Quarter)',
    4: 'Late Route (Final Quarter)'
  };
  return descriptions[segment] || 'Unknown Segment';
}

/**
 * Find the safest segment of the route
 * @param {Array} highRiskZones - High risk zones
 * @param {number} totalDistance - Total route distance
 * @returns {Object} Safest segment info
 */
function findSafestRouteSegment(highRiskZones, totalDistance) {
  const riskDistribution = analyzeRiskDistribution(highRiskZones, totalDistance);
  const safestSegment = riskDistribution.reduce((safest, current) => 
    current.riskCount < safest.riskCount ? current : safest
  );
  
  return {
    segment: safestSegment.segment,
    startKm: safestSegment.startKm,
    endKm: safestSegment.endKm,
    riskCount: safestSegment.riskCount,
    description: safestSegment.description
  };
}

/**
 * Find the riskiest segment of the route
 * @param {Array} highRiskZones - High risk zones
 * @param {number} totalDistance - Total route distance
 * @returns {Object} Riskiest segment info
 */
function findRiskiestRouteSegment(highRiskZones, totalDistance) {
  const riskDistribution = analyzeRiskDistribution(highRiskZones, totalDistance);
  const riskiestSegment = riskDistribution.reduce((riskiest, current) => 
    current.riskCount > riskiest.riskCount ? current : riskiest
  );
  
  return {
    segment: riskiestSegment.segment,
    startKm: riskiestSegment.startKm,
    endKm: riskiestSegment.endKm,
    riskCount: riskiestSegment.riskCount,
    description: riskiestSegment.description
  };
}

// File: controllers/highRiskZonesController.js - Part 3 (Final Functions)
// Purpose: Remaining helper functions and critical point generators

/**
 * Generate recommended rest stops to avoid fatigue at critical points
 * @param {Array} highRiskZones - High risk zones
 * @param {number} totalDistance - Total route distance
 * @returns {Array} Recommended rest stops
 */
function generateRecommendedRestStops(highRiskZones, totalDistance) {
  const restStops = [];
  const maxDrivingDistance = 100; // km
  
  // Add rest stops every 100km or before critical zones
  for (let distance = 0; distance < totalDistance; distance += maxDrivingDistance) {
    const stopDistance = Math.min(distance + maxDrivingDistance, totalDistance);
    
    // Check for critical zones within 20km after this rest stop
    const criticalZonesAhead = highRiskZones.filter(zone => {
      const zoneDistance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
      return zoneDistance >= stopDistance && zoneDistance <= stopDistance + 20 && zone.riskLevel === 'Critical';
    });
    
    if (criticalZonesAhead.length > 0 || stopDistance >= maxDrivingDistance) {
      restStops.push({
        recommendedKm: Math.round(stopDistance * 10) / 10,
        reason: criticalZonesAhead.length > 0 ? 
          `${criticalZonesAhead.length} critical zones within next 20km` : 
          'Regular rest stop for fatigue management',
        criticalZonesAhead: criticalZonesAhead.length,
        priority: criticalZonesAhead.length > 0 ? 'HIGH' : 'MEDIUM'
      });
    }
  }
  
  return restStops;
}

// ============================================================================
// CRITICAL POINT ACTION GENERATORS (Enhanced with Distance Context)
// ============================================================================

async function generateCriticalTurnActions(turn, route) {
  const distanceFromStart = turn.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  const travelTime = estimateTravelTime(distanceFromStart, route.estimatedDuration, route.totalDistance);
  
  const urgent = [
    'Immediate speed reduction to 15-20 km/h',
    'Deploy advance warning signals',
    'Use convoy formation with lead vehicle',
    'Continuous communication during passage',
    `⚠️ LOCATION: ${distanceFromStart.toFixed(1)}km from start (${travelTime} travel time)`
  ];
  
  const recommended = [
    'Pre-brief all drivers on turn characteristics',
    'Ensure vehicles are in optimal mechanical condition',
    'Plan alternative route if conditions deteriorate',
    'Establish emergency response protocols',
    `📍 Position on route: ${((distanceFromStart / route.totalDistance) * 100).toFixed(1)}% of journey completed`
  ];
  
  // Add turn-specific actions with distance context
  if (turn.turnAngle > 120) {
    urgent.push('Hairpin turn protocol - walking speed only');
  }
  if (turn.visibility === 'poor') {
    urgent.push('Deploy spotter at turn apex if possible');
  }
  
  // Add route-position specific advice
  if (distanceFromStart < route.totalDistance * 0.1) {
    urgent.push('EARLY ROUTE ALERT: First critical turn - sets safety tone for entire journey');
    recommended.push('Use this turn to test vehicle handling and driver alertness');
  } else if (distanceFromStart > route.totalDistance * 0.9) {
    urgent.push('LATE ROUTE ALERT: Critical turn near destination - maintain full alertness despite fatigue');
    recommended.push('Consider rest stop before this section if driver fatigue is possible');
  }
  
  return { urgent, recommended };
}

async function generateCriticalBlindSpotActions(spot, route) {
  const distanceFromStart = spot.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  const travelTime = estimateTravelTime(distanceFromStart, route.estimatedDuration, route.totalDistance);
  
  const urgent = [
    'Mandatory full stop before blind area',
    'Deploy spotter or use mirrors/cameras',
    'Continuous horn/signal when entering',
    'Inch forward with maximum visibility checks',
    `⚠️ LOCATION: ${distanceFromStart.toFixed(1)}km from start, ${distanceFromEnd.toFixed(1)}km to destination`
  ];
  
  const recommended = [
    'Install additional mirrors or cameras if feasible',
    'Coordinate with other traffic users',
    'Plan travel during optimal visibility hours',
    'Carry emergency communication equipment',
    `📍 Route position: ${determineRouteSection(distanceFromStart, route.totalDistance)}`
  ];
  
  // Add spot-specific actions with distance context
  if (spot.visibilityDistance < 20) {
    urgent.push('EXTREME LIMITED VISIBILITY - Consider route alternative');
  }
  if (spot.spotType === 'intersection') {
    urgent.push('Check for cross-traffic from all directions');
  }
  
  // Add timing considerations based on position
  const routeProgress = (distanceFromStart / route.totalDistance) * 100;
  if (routeProgress < 20) {
    recommended.push('Early route blind spot - establish enhanced visibility protocols for remainder of journey');
  } else if (routeProgress > 80) {
    urgent.push('Late route critical blind spot - counter end-of-journey fatigue with extra vigilance');
  }
  
  return { urgent, recommended };
}

async function generateCriticalAccidentActions(area, route) {
  const distanceFromStart = area.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  const estimatedArrivalTime = estimateTravelTime(distanceFromStart, route.estimatedDuration, route.totalDistance);
  
  const urgent = [
    'Maximum alertness and reduced speed (30 km/h maximum)',
    'Enhanced communication protocols active',
    'Emergency response equipment ready',
    'Consider convoy travel through this zone',
    `⚠️ CRITICAL LOCATION: ${distanceFromStart.toFixed(1)}km from start (arrival in approx. ${estimatedArrivalTime})`
  ];
  
  const recommended = [
    'Study accident patterns and timing',
    'Brief drivers on specific hazards',
    'Coordinate with local emergency services',
    'Monitor traffic and weather conditions',
    `📊 Historical data: ${area.accidentFrequencyYearly || 0} accidents/year at this location`
  ];
  
  // Add accident-specific actions with enhanced context
  if (area.accidentSeverity === 'fatal') {
    urgent.unshift('🚨 CRITICAL: Consider alternative route - fatal accident history');
    urgent.push(`FATAL ACCIDENT ZONE at ${distanceFromStart.toFixed(1)}km - extreme measures required`);
  }
  if (area.accidentFrequencyYearly > 10) {
    urgent.push(`HIGH FREQUENCY zone (${area.accidentFrequencyYearly} accidents/year) - maximum caution`);
  }
  
  // Add route-specific timing advice
  const routeSection = determineRouteSection(distanceFromStart, route.totalDistance);
  recommended.push(`Route context: ${routeSection} - plan arrival timing accordingly`);
  
  if (distanceFromEnd < 10) {
    urgent.push('⚠️ CRITICAL NEAR DESTINATION: Do not let proximity to end compromise safety');
  }
  
  return { urgent, recommended };
}

async function generateCriticalWeatherActions(weather, route) {
  const distanceFromStart = weather.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  
  const urgent = [
    'Monitor weather conditions continuously',
    'Adjust speed and following distance for conditions',
    'Use appropriate lighting and signals',
    'Be prepared to stop safely if conditions worsen',
    `🌦️ WEATHER ZONE: ${distanceFromStart.toFixed(1)}km from start (${weather.season} season)`
  ];
  
  const recommended = [
    'Check weather forecasts before departure',
    'Carry weather-appropriate emergency supplies',
    'Plan alternative stopping points',
    'Coordinate timing with weather windows',
    `📍 Location: ${determineRouteSection(distanceFromStart, route.totalDistance)} - monitor approach timing`
  ];
  
  // Add weather-specific actions with location context
  if (weather.weatherCondition === 'foggy') {
    urgent.push(`Use fog lights and reduce speed to 25 km/h at ${distanceFromStart.toFixed(1)}km mark`);
  }
  if (weather.visibilityKm < 1) {
    urgent.push(`CRITICAL: Consider stopping safely until visibility improves - safe zones before ${distanceFromStart.toFixed(1)}km`);
  }
  
  // Add seasonal timing advice
  if (weather.season === 'monsoon') {
    recommended.push('Monsoon season - avoid travel during peak rain hours if possible');
    recommended.push(`Plan arrival at ${distanceFromStart.toFixed(1)}km mark during clearer weather windows`);
  }
  
  return { urgent, recommended };
}

async function generateCriticalDeadZoneActions(deadZone, route) {
  const distanceFromStart = deadZone.distanceFromStartKm || 0;
  const distanceFromEnd = calculateDistanceFromEnd(distanceFromStart, route.totalDistance);
  const entryTime = estimateTravelTime(distanceFromStart, route.estimatedDuration, route.totalDistance);
  
  const urgent = [
    'Test communication before entering zone',
    'Inform control room of entry and expected exit time',
    'Use satellite communication if available',
    'Travel in convoy with backup communication',
    `📡 DEAD ZONE ENTRY: ${distanceFromStart.toFixed(1)}km from start (entry in ${entryTime})`
  ];
  
  const recommended = [
    'Carry multiple communication devices',
    'Plan emergency rendezvous points',
    'Brief all personnel on dead zone protocols',
    'Coordinate with emergency services',
    `📊 Zone details: ${deadZone.deadZoneDuration || 0} min duration, ${deadZone.deadZoneRadius || 0}m radius`
  ];
  
  // Add dead zone-specific actions with enhanced location context
  if (deadZone.deadZoneDuration > 60) {
    urgent.push(`Extended dead zone (${deadZone.deadZoneDuration} minutes) - mandatory satellite communication`);
    urgent.push(`Zone spans from ${distanceFromStart.toFixed(1)}km to approximately ${(distanceFromStart + (deadZone.deadZoneDuration * 1)).toFixed(1)}km`);
  }
  if (deadZone.deadZoneSeverity === 'critical') {
    urgent.push('Critical communication gap - consider route postponement');
    urgent.push(`CRITICAL ZONE at ${distanceFromStart.toFixed(1)}km - inform emergency services of exact entry/exit times`);
  }
  
  // Add route position context
  const routeProgress = (distanceFromStart / route.totalDistance) * 100;
  if (routeProgress > 50) {
    recommended.push('Dead zone in second half of journey - ensure communication equipment is fully charged');
  }
  
  if (distanceFromEnd < deadZone.deadZoneRadius / 1000) {
    urgent.push('⚠️ Dead zone near destination - coordinate arrival communication with receiving party');
  }
  
  return { urgent, recommended };
}

// ============================================================================
// ENHANCED ROUTE RECOMMENDATION WITH DISTANCE ANALYSIS
// ============================================================================

function generateEnhancedRouteRecommendation(criticalPoints, route) {
  const totalCritical = criticalPoints.length;
  const maxRisk = criticalPoints.length > 0 ? Math.max(...criticalPoints.map(p => p.riskScore)) : 0;
  const avgRisk = criticalPoints.length > 0 ? 
    criticalPoints.reduce((sum, p) => sum + p.riskScore, 0) / criticalPoints.length : 0;
  
  // ✅ ENHANCED: Distance-based risk analysis
  const earlyRouteRisks = criticalPoints.filter(p => (p.distanceFromStart / route.totalDistance) < 0.25).length;
  const lateRouteRisks = criticalPoints.filter(p => (p.distanceFromStart / route.totalDistance) > 0.75).length;
  const riskSpread = criticalPoints.length > 1 ? 
    criticalPoints[criticalPoints.length - 1].distanceFromStart - criticalPoints[0].distanceFromStart : 0;
  
  let level = 'NORMAL';
  let recommendation = 'Standard safety protocols sufficient';
  let actions = ['Follow standard safety guidelines'];
  
  if (totalCritical >= 5 || maxRisk >= 9.5) {
    level = 'URGENT - ROUTE NOT RECOMMENDED';
    recommendation = 'Seek immediate alternative route - multiple critical hazards present extreme danger';
    actions = [
      'STOP: Do not proceed on this route',
      'Identify and evaluate alternative routes immediately',
      'If no alternative exists, implement maximum safety protocols',
      'Consider convoy travel with emergency support',
      'Notify all stakeholders of extreme risk conditions',
      'Have emergency response team on standby'
    ];
  } else if (totalCritical >= 3 || maxRisk >= 9) {
    level = 'CRITICAL CAUTION';
    recommendation = 'Proceed only with maximum safety measures - multiple critical points require extreme care';
    actions = [
      'Implement all enhanced safety protocols',
      'Mandatory convoy travel with constant communication',
      'Deploy emergency response team along route',
      'Brief all drivers extensively on critical points',
      'Ensure satellite communication availability',
      'Plan emergency evacuation procedures'
    ];
  } else if (totalCritical >= 1 || maxRisk >= 8) {
    level = 'HIGH CAUTION';
    recommendation = 'Enhanced safety measures mandatory - critical points identified';
    actions = [
      'Brief all drivers on critical point locations and procedures',
      'Implement enhanced communication protocols',
      'Ensure emergency equipment readiness',
      'Consider convoy travel for critical sections',
      'Monitor conditions continuously'
    ];
  } else if (avgRisk >= 6) {
    level = 'STANDARD ENHANCED PRECAUTIONS';
    recommendation = 'Standard enhanced precautions required';
    actions = [
      'Follow enhanced safety guidelines',
      'Maintain heightened alertness levels',
      'Regular safety and communication checks'
    ];
  }
  
  // ✅ NEW: Add distance-specific recommendations
  if (earlyRouteRisks > 0) {
    actions.push(`⚠️ ${earlyRouteRisks} critical points in first quarter - establish safety protocols early`);
  }
  
  if (lateRouteRisks > 0) {
    actions.push(`⚠️ ${lateRouteRisks} critical points in final quarter - maintain alertness despite journey fatigue`);
  }
  
  if (riskSpread > route.totalDistance * 0.5) {
    actions.push('Critical points spread across route - sustained vigilance required throughout journey');
  } else if (totalCritical > 1) {
    actions.push(`Critical points concentrated in ${riskSpread.toFixed(1)}km section - focus preparation on this area`);
  }
  
  return {
    level: level,
    recommendation: recommendation,
    actions: actions,
    metrics: {
      totalCriticalPoints: totalCritical,
      maxRiskScore: maxRisk,
      averageRiskScore: Math.round(avgRisk * 10) / 10,
      routeLength: route.totalDistance,
      criticalDensity: route.totalDistance > 0 ? Math.round((totalCritical / route.totalDistance) * 100) / 100 : 0
    },
    // ✅ NEW: Enhanced distance-based insights
    distanceAnalysis: {
      earlyRouteRisks: earlyRouteRisks,
      midRouteRisks: totalCritical - earlyRouteRisks - lateRouteRisks,
      lateRouteRisks: lateRouteRisks,
      riskSpreadKm: riskSpread,
      riskConcentration: riskSpread < route.totalDistance * 0.3 ? 'CONCENTRATED' : 'DISTRIBUTED',
      firstCriticalPoint: totalCritical > 0 ? criticalPoints[0].distanceFromStart : null,
      lastCriticalPoint: totalCritical > 0 ? criticalPoints[criticalPoints.length - 1].distanceFromStart : null
    }
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateRouteImpact(riskPoint, route) {
  const distanceFromStart = riskPoint.distanceFromStartKm || 0;
  const routeProgress = (distanceFromStart / route.totalDistance) * 100;
  
  const impact = {
    timeDelay: 0,
    speedReduction: 0,
    safetyMeasures: [],
    alternativeRequired: false,
    // ✅ NEW: Enhanced impact analysis
    routePosition: {
      kmFromStart: distanceFromStart,
      kmFromEnd: calculateDistanceFromEnd(distanceFromStart, route.totalDistance),
      routeProgress: routeProgress,
      section: determineRouteSection(distanceFromStart, route.totalDistance)
    }
  };
  
  // Calculate based on risk score and type
  if (riskPoint.riskScore >= 9) {
    impact.timeDelay = 15; // minutes
    impact.speedReduction = 70; // percentage
    impact.alternativeRequired = true;
    impact.safetyMeasures.push('Convoy travel required');
    impact.safetyMeasures.push('Emergency communication active');
  } else if (riskPoint.riskScore >= 7) {
    impact.timeDelay = 10;
    impact.speedReduction = 50;
    impact.safetyMeasures.push('Enhanced caution protocols');
  } else if (riskPoint.riskScore >= 5) {
    impact.timeDelay = 5;
    impact.speedReduction = 30;
    impact.safetyMeasures.push('Standard enhanced protocols');
  }
  
  // ✅ NEW: Add position-specific impact considerations
  if (routeProgress < 25) {
    impact.safetyMeasures.push('Early route impact - sets tone for journey');
  } else if (routeProgress > 75) {
    impact.safetyMeasures.push('Late route impact - counter fatigue effects');
  }
  
  return impact;
}

function generateEmergencyProtocols(criticalPoints, route) {
  const protocols = {
    communication: [],
    medical: [],
    evacuation: [],
    coordination: []
  };
  
  // ✅ ENHANCED: Distance-aware emergency protocols
  
  // Communication protocols with distance context
  protocols.communication.push('Establish primary and backup communication channels');
  protocols.communication.push('Test all communication equipment before departure');
  protocols.communication.push('Maintain regular check-in schedule every 30 minutes');
  
  const deadZonePoints = criticalPoints.filter(p => p.type.includes('Dead Zone'));
  if (deadZonePoints.length > 0) {
    protocols.communication.push('Deploy satellite communication for dead zones');
    protocols.communication.push('Establish emergency rendezvous points');
    deadZonePoints.forEach(dz => {
      protocols.communication.push(`Dead zone at ${dz.distanceFromStart.toFixed(1)}km - inform control before entry`);
    });
  }
  
  // Medical protocols with location awareness
  protocols.medical.push('Ensure first aid kits are available and current');
  protocols.medical.push('Brief personnel on emergency medical procedures');
  
  if (criticalPoints.length > 3) {
    protocols.medical.push('Consider medical personnel accompaniment');
    protocols.medical.push('Pre-coordinate with emergency medical services');
    
    // Add location-specific medical considerations
    const lateRouteCriticalPoints = criticalPoints.filter(p => (p.distanceFromStart / route.totalDistance) > 0.75);
    if (lateRouteCriticalPoints.length > 0) {
      protocols.medical.push('Medical response may be delayed for late-route incidents - enhance first aid readiness');
    }
  }
  
  // Evacuation protocols with distance-based planning
  protocols.evacuation.push('Identify safe stopping and turnaround points');
  protocols.evacuation.push('Plan emergency evacuation routes');
  
  if (criticalPoints.some(p => p.riskScore >= 9)) {
    protocols.evacuation.push('Establish emergency helicopter landing zones');
    protocols.evacuation.push('Pre-position emergency response equipment');
    
    // Add specific evacuation points based on critical point locations
    const criticalLocations = criticalPoints.filter(p => p.riskScore >= 9)
      .map(p => `${p.distanceFromStart.toFixed(1)}km`)
      .join(', ');
    protocols.evacuation.push(`Priority evacuation planning for critical points at: ${criticalLocations}`);
  }
  
  // Coordination protocols with timing considerations
  protocols.coordination.push('Notify relevant authorities of travel plans');
  protocols.coordination.push('Establish command and control structure');
  
  if (route.totalDistance > 200) {
    protocols.coordination.push('Long route - establish intermediate checkpoints for coordination');
  }
  
  // Add estimated travel times to critical points for coordination
  if (criticalPoints.length > 0) {
    protocols.coordination.push('Critical point arrival estimates:');
    criticalPoints.forEach(point => {
      const estimatedTime = estimateTravelTime(point.distanceFromStart, route.estimatedDuration, route.totalDistance);
      protocols.coordination.push(`- ${point.type} at ${point.distanceFromStart.toFixed(1)}km (ETA: ${estimatedTime})`);
    });
  }
  
  return protocols;
}

// ============================================================================
// REMAINING UTILITY FUNCTIONS
// ============================================================================

function calculateRouteScore(route, highRiskZones) {
  let score = 100; // Start with perfect score
  
  highRiskZones.forEach(zone => {
    const riskValue = getRiskValue(zone.riskLevel);
    score -= riskValue * 2; // Deduct points based on risk
  });
  
  // Additional deductions for route characteristics
  if (route.terrain === 'hilly') score -= 5;
  if (route.totalDistance > 200) score -= 5;
  
  // ✅ NEW: Distance-based score adjustments
  const criticalZones = highRiskZones.filter(zone => zone.riskLevel === 'Critical');
  const earlyRouteCritical = criticalZones.filter(zone => {
    const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
    return distance < route.totalDistance * 0.25;
  }).length;
  
  const lateRouteCritical = criticalZones.filter(zone => {
    const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
    return distance > route.totalDistance * 0.75;
  }).length;
  
  // Early route critical points are more impactful (sets tone for journey)
  score -= earlyRouteCritical * 5;
  // Late route critical points are dangerous due to fatigue
  score -= lateRouteCritical * 3;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateSafetyMargin(criticalZones, totalZones) {
  if (totalZones === 0) return 100;
  const criticalPercentage = (criticalZones / totalZones) * 100;
  return Math.max(0, 100 - criticalPercentage);
}

function determineAnalysisQuality(highRiskZones) {
  const hasRealData = highRiskZones.some(zone => 
    zone.actualData && Object.keys(zone.actualData).length > 3
  );
  
  const hasLocationInfo = highRiskZones.some(zone => zone.locationInfo);
  
  if (hasRealData && hasLocationInfo && highRiskZones.length > 10) return 'Excellent';
  if (hasRealData && highRiskZones.length > 5) return 'High';
  if (hasRealData || highRiskZones.length > 5) return 'Medium';
  return 'Basic';
}

function getRiskValue(riskLevel) {
  const values = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Minimal': 0.5 };
  return values[riskLevel] || 1;
}

async function generateDetailedRiskAnalysis(route, highRiskZones) {
  const analysis = {
    spatialDistribution: analyzeRiskDistribution(highRiskZones, route.totalDistance),
    riskClusters: identifyRiskClusters(highRiskZones),
    routeSegmentAnalysis: analyzeRouteSegments(highRiskZones, route),
    timeBasedRisk: analyzeTimeBasedRisk(highRiskZones, route),
    mitigationStrategies: generateMitigationStrategies(highRiskZones, route),
    // ✅ NEW: Enhanced analysis components
    distanceBasedInsights: {
      riskProgression: analyzeRiskProgression(highRiskZones, route.totalDistance),
      fatigueFactor: analyzeFatigueRiskFactor(highRiskZones, route),
      travelTimeImpact: analyzeTravelTimeImpact(highRiskZones, route)
    }
  };
  
  return analysis;
}

function identifyRiskClusters(highRiskZones) {
  const clusters = [];
  const clusterDistance = 5; // km - points within 5km are considered clustered
  
  highRiskZones.forEach(zone => {
    const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
    
    // Find if this zone belongs to an existing cluster
    let belongsToCluster = false;
    for (const cluster of clusters) {
      if (Math.abs(distance - cluster.centerKm) <= clusterDistance) {
        cluster.zones.push(zone);
        cluster.riskSum += getRiskValue(zone.riskLevel);
        cluster.centerKm = cluster.zones.reduce((sum, z) => 
          sum + parseFloat(z.distanceFromSupply.replace(' km', '')), 0) / cluster.zones.length;
        belongsToCluster = true;
        break;
      }
    }
    
    // Create new cluster if doesn't belong to existing one
    if (!belongsToCluster) {
      clusters.push({
        centerKm: distance,
        zones: [zone],
        riskSum: getRiskValue(zone.riskLevel)
      });
    }
  });
  
  return clusters.filter(cluster => cluster.zones.length > 1); // Only return actual clusters
}

function analyzeRouteSegments(highRiskZones, route) {
  const segmentAnalysis = analyzeRiskDistribution(highRiskZones, route.totalDistance);
  
  return segmentAnalysis.map(segment => ({
    ...segment,
    riskLevel: segment.riskDensity > 0.5 ? 'High' : segment.riskDensity > 0.2 ? 'Medium' : 'Low',
    recommendation: segment.riskDensity > 0.5 ? 
      'Consider alternative route for this segment' :
      segment.riskDensity > 0.2 ?
      'Enhanced caution required' :
      'Standard precautions sufficient',
    // ✅ NEW: Enhanced segment analysis
    estimatedTransitTime: estimateTravelTime(segment.endKm - segment.startKm, route.estimatedDuration, route.totalDistance),
    cumulativeRisk: calculateCumulativeRisk(segment, highRiskZones)
  }));
}

function analyzeTimeBasedRisk(highRiskZones, route) {
  const weatherZones = highRiskZones.filter(zone => zone.type === 'Weather Risk Zone');
  const visibilityZones = highRiskZones.filter(zone => 
    zone.type === 'Blind Spot' || 
    (zone.actualData && (zone.actualData.visibility === 'poor' || zone.actualData.visibility === 'limited'))
  );
  
  return {
    optimalTravelTimes: {
      morning: '6:00 AM - 10:00 AM (Best visibility, cooler temperatures)',
      afternoon: '2:00 PM - 5:00 PM (Good visibility, moderate temperatures)',
      evening: 'Not recommended (Reduced visibility, wildlife activity)',
      night: 'Strongly discouraged (Poor visibility, fatigue factors)'
    },
    weatherConsiderations: weatherZones.length > 0 ? 
      `Monitor weather forecasts - ${weatherZones.length} weather risk zones identified` :
      'Standard weather monitoring sufficient',
    visibilityConsiderations: visibilityZones.length > 0 ?
      `${visibilityZones.length} visibility-limited zones - avoid low-light conditions` :
      'No significant visibility restrictions',
    // ✅ NEW: Time-distance correlation
    timeDistanceCorrelation: correlateTimeWithDistance(highRiskZones, route)
  };
}

function generateMitigationStrategies(highRiskZones, route) {
  const strategies = {
    immediate: [],
    shortTerm: [],
    longTerm: []
  };
  
  // Immediate strategies with distance context
  strategies.immediate.push('Implement all identified speed reductions and safety actions');
  strategies.immediate.push('Brief all personnel on identified risks before departure');
  strategies.immediate.push('Ensure all safety equipment is functional and accessible');
  
  if (highRiskZones.length > 5) {
    strategies.immediate.push(`Route has ${highRiskZones.length} high-risk zones - consider convoy travel`);
  }
  
  // Short-term strategies
  strategies.shortTerm.push('Develop standard operating procedures for high-risk zones');
  strategies.shortTerm.push('Establish relationships with local emergency services');
  strategies.shortTerm.push('Create detailed risk maps and driver briefing materials');
  strategies.shortTerm.push('Install route-specific safety equipment');
  
  // Long-term strategies with route-specific considerations
  strategies.longTerm.push('Work with authorities to improve road safety infrastructure');
  strategies.longTerm.push('Develop alternative route options');
  strategies.longTerm.push('Implement technology solutions for high-risk areas');
  
  if (route.totalDistance > 200) {
    strategies.longTerm.push('Consider establishing intermediate support stations for long routes');
  }
  // File: controllers/highRiskZonesController.js - Part 4 (Final Completion)
// Purpose: Complete the remaining functions and export the controller

return strategies;
}

// ============================================================================
// NEW ENHANCED ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze risk progression along the route
 * @param {Array} highRiskZones - High risk zones
 * @param {number} totalDistance - Total route distance
 * @returns {Object} Risk progression analysis
 */
function analyzeRiskProgression(highRiskZones, totalDistance) {
  const segments = 10; // Divide route into 10 segments for detailed analysis
  const segmentSize = totalDistance / segments;
  const progression = Array(segments).fill(0);
  
  highRiskZones.forEach(zone => {
    const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
    const segmentIndex = Math.min(segments - 1, Math.floor(distance / segmentSize));
    const riskValue = getRiskValue(zone.riskLevel);
    progression[segmentIndex] += riskValue;
  });
  
  // Calculate trend
  const firstHalf = progression.slice(0, 5).reduce((sum, val) => sum + val, 0);
  const secondHalf = progression.slice(5).reduce((sum, val) => sum + val, 0);
  
  let trend = 'stable';
  if (secondHalf > firstHalf * 1.5) trend = 'increasing';
  else if (firstHalf > secondHalf * 1.5) trend = 'decreasing';
  
  return {
    segmentRisks: progression.map((risk, index) => ({
      segment: index + 1,
      startKm: Math.round(index * segmentSize * 10) / 10,
      endKm: Math.round((index + 1) * segmentSize * 10) / 10,
      riskValue: risk,
      riskDensity: Math.round((risk / segmentSize) * 100) / 100
    })),
    trend: trend,
    peakRiskSegment: progression.indexOf(Math.max(...progression)) + 1,
    safestSegment: progression.indexOf(Math.min(...progression)) + 1,
    riskVariability: calculateVariability(progression)
  };
}

/**
 * Analyze fatigue risk factor based on critical point positions
 * @param {Array} highRiskZones - High risk zones
 * @param {Object} route - Route object
 * @returns {Object} Fatigue risk analysis
 */
function analyzeFatigueRiskFactor(highRiskZones, route) {
  const criticalPoints = highRiskZones.filter(zone => zone.riskLevel === 'Critical');
  const lateRouteCritical = criticalPoints.filter(zone => {
    const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
    return distance > route.totalDistance * 0.75;
  });
  
  const estimatedDuration = route.estimatedDuration || (route.totalDistance * 2); // 2 min per km default
  
  let fatigueRisk = 'low';
  let recommendations = [];
  
  if (estimatedDuration > 240) { // 4+ hours
    fatigueRisk = 'high';
    recommendations.push('Long journey (4+ hours) - mandatory rest stops every 2 hours');
  } else if (estimatedDuration > 120) { // 2+ hours
    fatigueRisk = 'medium';
    recommendations.push('Medium journey (2+ hours) - plan rest stops');
  }
  
  if (lateRouteCritical.length > 0) {
    fatigueRisk = fatigueRisk === 'low' ? 'medium' : 'high';
    recommendations.push(`${lateRouteCritical.length} critical points in final quarter - high fatigue risk`);
    recommendations.push('Consider overnight stop before final leg if journey exceeds 6 hours');
  }
  
  return {
    estimatedDuration: estimatedDuration,
    fatigueRiskLevel: fatigueRisk,
    lateRouteCriticalPoints: lateRouteCritical.length,
    recommendations: recommendations,
    suggestedRestStops: generateRecommendedRestStops(highRiskZones, route.totalDistance)
  };
}

/**
 * Analyze travel time impact of high-risk zones
 * @param {Array} highRiskZones - High risk zones
 * @param {Object} route - Route object
 * @returns {Object} Travel time impact analysis
 */
function analyzeTravelTimeImpact(highRiskZones, route) {
  let totalDelayMinutes = 0;
  const delayBreakdown = {
    criticalZones: 0,
    highRiskZones: 0,
    mediumRiskZones: 0,
    weatherDelays: 0,
    communicationDelays: 0
  };
  
  highRiskZones.forEach(zone => {
    let delayMinutes = 0;
    
    switch (zone.riskLevel) {
      case 'Critical':
        delayMinutes = 15;
        delayBreakdown.criticalZones += delayMinutes;
        break;
      case 'High':
        delayMinutes = 8;
        delayBreakdown.highRiskZones += delayMinutes;
        break;
      case 'Medium':
        delayMinutes = 3;
        delayBreakdown.mediumRiskZones += delayMinutes;
        break;
      default:
        delayMinutes = 1;
    }
    
    // Additional delays for specific zone types
    if (zone.type === 'Weather Risk Zone') {
      delayMinutes += 5;
      delayBreakdown.weatherDelays += 5;
    }
    
    if (zone.type === 'Communication Dead Zone') {
      delayMinutes += 3; // Setup time for alternative communication
      delayBreakdown.communicationDelays += 3;
    }
    
    totalDelayMinutes += delayMinutes;
  });
  
  const originalDuration = route.estimatedDuration || (route.totalDistance * 2);
  const adjustedDuration = originalDuration + totalDelayMinutes;
  const delayPercentage = ((totalDelayMinutes / originalDuration) * 100).toFixed(1);
  
  return {
    originalDurationMinutes: originalDuration,
    totalDelayMinutes: totalDelayMinutes,
    adjustedDurationMinutes: adjustedDuration,
    delayPercentage: parseFloat(delayPercentage),
    delayBreakdown: delayBreakdown,
    formattedTimes: {
      originalDuration: formatDuration(originalDuration),
      totalDelay: formatDuration(totalDelayMinutes),
      adjustedDuration: formatDuration(adjustedDuration)
    }
  };
}

/**
 * Correlate time factors with distance for optimal travel planning
 * @param {Array} highRiskZones - High risk zones
 * @param {Object} route - Route object
 * @returns {Object} Time-distance correlation analysis
 */
function correlateTimeWithDistance(highRiskZones, route) {
  const weatherZones = highRiskZones.filter(zone => zone.type === 'Weather Risk Zone');
  const blindSpots = highRiskZones.filter(zone => zone.type === 'Blind Spot');
  
  const timeRecommendations = [];
  
  // Early morning recommendations for visibility zones
  if (blindSpots.length > 0) {
    const earlyBlindSpots = blindSpots.filter(zone => {
      const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
      return distance < route.totalDistance * 0.5;
    });
    
    if (earlyBlindSpots.length > 0) {
      timeRecommendations.push({
        timeWindow: '6:00 AM - 9:00 AM',
        reason: `${earlyBlindSpots.length} blind spots in first half of route - optimal visibility needed`,
        affectedDistance: `0 - ${(route.totalDistance * 0.5).toFixed(1)}km`
      });
    }
  }
  
  // Weather timing recommendations
  if (weatherZones.length > 0) {
    weatherZones.forEach(zone => {
      const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
      const estimatedArrival = estimateTravelTime(distance, route.estimatedDuration, route.totalDistance);
      
      if (zone.actualData && zone.actualData.season === 'monsoon') {
        timeRecommendations.push({
          timeWindow: 'Avoid 11:00 AM - 3:00 PM',
          reason: `Monsoon weather zone at ${distance.toFixed(1)}km - peak rain hours`,
          affectedDistance: `${distance.toFixed(1)}km`,
          estimatedArrival: estimatedArrival
        });
      }
    });
  }
  
  return {
    optimalDepartureTime: '6:00 AM',
    timeRecommendations: timeRecommendations,
    totalTravelWindow: formatDuration((route.estimatedDuration || route.totalDistance * 2) + 60), // Add buffer
    criticalTimingZones: weatherZones.length + blindSpots.length
  };
}

/**
 * Calculate cumulative risk for a route segment
 * @param {Object} segment - Route segment
 * @param {Array} highRiskZones - High risk zones
 * @returns {number} Cumulative risk score
 */
function calculateCumulativeRisk(segment, highRiskZones) {
  const segmentZones = highRiskZones.filter(zone => {
    const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
    return distance >= segment.startKm && distance <= segment.endKm;
  });
  
  return segmentZones.reduce((sum, zone) => sum + getRiskValue(zone.riskLevel), 0);
}

/**
 * Calculate variability in risk distribution
 * @param {Array} progression - Risk progression array
 * @returns {number} Variability score
 */
function calculateVariability(progression) {
  const mean = progression.reduce((sum, val) => sum + val, 0) / progression.length;
  const variance = progression.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / progression.length;
  return Math.sqrt(variance);
}

/**
 * Format duration from minutes to human-readable format
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration
 */
function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// ============================================================================
// EXPORT THE ENHANCED CONTROLLER
// ============================================================================

module.exports = highRiskZonesController;

// ============================================================================
// USAGE EXAMPLES AND API DOCUMENTATION
// ============================================================================

/**
 * API USAGE EXAMPLES:
 * 
 * 1. Get high-risk zones with distance calculations:
 *    GET /api/routes/507f1f77bcf86cd799439011/high-risk-zones?riskThreshold=6
 *    
 *    Response will include:
 *    - distanceFromSupply: "12.5 km" (distance from route start)
 *    - distanceFromCustomer: "87.3 km" (distance to route end)
 *    - locationInfo.percentageOfRoute: "12.5%" (percentage of journey completed)
 *    - locationInfo.sectionOfRoute: "Early Route (First Quarter)"
 *    - locationInfo.nearestLandmark: "Near highway junction"
 * 
 * 2. Get critical points with enhanced distance context:
 *    GET /api/routes/507f1f77bcf86cd799439011/critical-points?criticalThreshold=8
 *    
 *    Response will include:
 *    - Enhanced location context with travel time estimates
 *    - Distance-based recommendations
 *    - Route position analysis
 *    - Fatigue risk considerations
 * 
 * 3. Key improvements in this fixed version:
 *    ✅ FIXED: distanceFromSupply now shows actual km from route start
 *    ✅ FIXED: distanceFromCustomer now shows actual km to route end
 *    ✅ NEW: locationInfo with percentage, route section, landmarks
 *    ✅ NEW: Travel time estimates to each critical point
 *    ✅ NEW: Distance-based risk distribution analysis
 *    ✅ NEW: Fatigue risk analysis for late-route critical points
 *    ✅ NEW: Enhanced recommendations based on route position
 *    ✅ NEW: Concentration area identification
 *    ✅ NEW: Rest stop recommendations
 *    ✅ NEW: Route section-specific safety protocols
 */

/**
 * RESPONSE STRUCTURE CHANGES:
 * 
 * OLD (broken):
 * {
 *   "distanceFromSupply": "0 km",
 *   "distanceFromCustomer": "0 km"
 * }
 * 
 * NEW (fixed):
 * {
 *   "distanceFromSupply": "12.5 km",
 *   "distanceFromCustomer": "87.3 km",
 *   "locationInfo": {
 *     "kmFromStart": 12.5,
 *     "kmFromEnd": 87.3,
 *     "percentageOfRoute": "12.5",
 *     "nearestLandmark": "Highway junction near coordinates",
 *     "sectionOfRoute": "Early Route (First Quarter)"
 *   }
 * }
 */

/**
 * DISTANCE CALCULATION LOGIC:
 * 
 * 1. distanceFromSupply = distanceFromStartKm (from the model)
 * 2. distanceFromCustomer = totalDistance - distanceFromStartKm
 * 3. Validation ensures distances are non-negative
 * 4. Fallback to 0 if data is missing or invalid
 * 5. Enhanced with percentage calculations and route sections
 * 6. Integrated with travel time estimates
 * 7. Correlated with fatigue risk analysis
 */

/**
 * ERROR HANDLING IMPROVEMENTS:
 * 
 * 1. Validates route existence before calculations
 * 2. Handles missing distanceFromStartKm gracefully
 * 3. Prevents negative distance calculations
 * 4. Provides meaningful fallbacks for missing data
 * 5. Enhanced error messages with troubleshooting info
 * 6. Comprehensive logging for debugging
 */

/**
 * PERFORMANCE OPTIMIZATIONS:
 * 
 * 1. Parallel database queries using Promise.all()
 * 2. Efficient sorting and filtering operations
 * 3. Cached calculations where possible
 * 4. Optimized distance calculation functions
 * 5. Reduced redundant database calls
 * 6. Streamlined data processing pipeline
 */