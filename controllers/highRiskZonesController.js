// File: controllers/highRiskZonesController.js (DYNAMIC VERSION)
// Purpose: Handle DYNAMIC high risk zones and critical points analysis
// ENHANCEMENT: Uses real route data, dynamic calculations, and actual risk assessments

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

      // Get route details for dynamic calculations
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      console.log(`🚨 Analyzing high-risk zones for route: ${route.routeId} (${route.totalDistance}km)`);

      // Get all high-risk zones with parallel queries - DYNAMIC thresholds
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

      // Process and format high-risk zones DYNAMICALLY
      const highRiskZones = [];

      // Process Sharp Turns with DYNAMIC data
      for (const turn of sharpTurns) {
        const dynamicData = await generateDynamicTurnData(turn, route);
        highRiskZones.push({
          type: "Sharp Turn",
          id: turn._id,
          distanceFromSupply: `${turn.distanceFromStartKm || 0} km`,
          distanceFromCustomer: `${dynamicData.distanceFromEnd} km`,
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
          dynamicAssessment: dynamicData.assessment
        });
      }

      // Process Blind Spots with DYNAMIC data
      for (const spot of blindSpots) {
        const dynamicData = await generateDynamicBlindSpotData(spot, route);
        highRiskZones.push({
          type: "Blind Spot",
          id: spot._id,
          distanceFromSupply: `${spot.distanceFromStartKm || 0} km`,
          distanceFromCustomer: `${dynamicData.distanceFromEnd} km`,
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
          dynamicAssessment: dynamicData.assessment
        });
      }

      // Process Accident-Prone Areas with DYNAMIC data
      for (const area of accidentAreas) {
        const dynamicData = await generateDynamicAccidentData(area, route);
        highRiskZones.push({
          type: "Accident-Prone Area",
          id: area._id,
          distanceFromSupply: `${area.distanceFromStartKm || 0} km`,
          distanceFromCustomer: `${dynamicData.distanceFromEnd} km`,
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
          dynamicAssessment: dynamicData.assessment
        });
      }

      // Process Weather Zones with DYNAMIC data
      for (const weather of weatherZones) {
        const dynamicData = await generateDynamicWeatherData(weather, route);
        highRiskZones.push({
          type: "Weather Risk Zone",
          id: weather._id,
          distanceFromSupply: `${weather.distanceFromStartKm || 0} km`,
          distanceFromCustomer: `${dynamicData.distanceFromEnd} km`,
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
          dynamicAssessment: dynamicData.assessment
        });
      }

      // Process Communication Dead Zones with DYNAMIC data
      for (const deadZone of deadZones) {
        const dynamicData = await generateDynamicDeadZoneData(deadZone, route);
        highRiskZones.push({
          type: "Communication Dead Zone",
          id: deadZone._id,
          distanceFromSupply: `${deadZone.distanceFromStartKm || 0} km`,
          distanceFromCustomer: `${dynamicData.distanceFromEnd} km`,
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
          dynamicAssessment: dynamicData.assessment
        });
      }

      // DYNAMIC sorting by risk level and distance
      highRiskZones.sort((a, b) => {
        const riskOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
        const aRisk = riskOrder[a.riskLevel] || 0;
        const bRisk = riskOrder[b.riskLevel] || 0;
        
        if (aRisk !== bRisk) return bRisk - aRisk; // Higher risk first
        
        // If same risk level, sort by distance from start
        const aDistance = parseFloat(a.distanceFromSupply.replace(' km', ''));
        const bDistance = parseFloat(b.distanceFromSupply.replace(' km', ''));
        return aDistance - bDistance;
      });

      // Generate DYNAMIC summary statistics
      const summary = generateDynamicSummary(highRiskZones, route, riskThreshold);

      // DYNAMIC route risk assessment
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
          routeRiskAssessment: routeRiskAssessment
        },
        message: `Found ${highRiskZones.length} high-risk zones along ${route.totalDistance}km route (threshold: ${riskThreshold})`
      };

      // Add detailed analysis if requested
      if (includeAnalysis === 'true') {
        response.data.detailedAnalysis = await generateDetailedRiskAnalysis(route, highRiskZones);
      }

      res.json(response);

    } catch (error) {
      console.error('Error fetching dynamic high-risk zones:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving high-risk zones',
        error: error.message
      });
    }
  },

  // GET /api/routes/:routeId/critical-points
  getCriticalPoints: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { criticalThreshold = 8 } = req.query;
      
      // Get route for dynamic calculations
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      console.log(`🔴 Analyzing critical points for route: ${route.routeId} (threshold: ${criticalThreshold})`);

      // Get only critical points with DYNAMIC threshold
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

      // Process critical turns with DYNAMIC data
      for (const turn of criticalTurns) {
        const dynamicActions = await generateCriticalTurnActions(turn, route);
        criticalPoints.push({
          id: turn._id,
          type: 'Critical Sharp Turn',
          location: `${turn.latitude}, ${turn.longitude}`,
          distanceFromStart: turn.distanceFromStartKm,
          distanceFromEnd: calculateDynamicDistanceFromEnd(turn.distanceFromStartKm, route.totalDistance),
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
          routeImpact: calculateRouteImpact(turn, route)
        });
      }

      // Process critical blind spots with DYNAMIC data
      for (const spot of criticalBlindSpots) {
        const dynamicActions = await generateCriticalBlindSpotActions(spot, route);
        criticalPoints.push({
          id: spot._id,
          type: 'Critical Blind Spot',
          location: `${spot.latitude}, ${spot.longitude}`,
          distanceFromStart: spot.distanceFromStartKm,
          distanceFromEnd: calculateDynamicDistanceFromEnd(spot.distanceFromStartKm, route.totalDistance),
          riskScore: spot.riskScore,
          severity: 'CRITICAL',
          urgentActions: dynamicActions.urgent,
          recommendedActions: dynamicActions.recommended,
          technicalDetails: {
            visibilityDistance: spot.visibilityDistance,
            spotType: spot.spotType,
            obstructionHeight: spot.obstructionHeight,
            analysisMethod: spot.analysisMethod,
            confidence: spot.confidence
          },
          routeImpact: calculateRouteImpact(spot, route)
        });
      }

      // Process critical accident areas with DYNAMIC data
      for (const area of criticalAccidents) {
        const dynamicActions = await generateCriticalAccidentActions(area, route);
        criticalPoints.push({
          id: area._id,
          type: 'Critical Accident Zone',
          location: `${area.latitude}, ${area.longitude}`,
          distanceFromStart: area.distanceFromStartKm,
          distanceFromEnd: calculateDynamicDistanceFromEnd(area.distanceFromStartKm, route.totalDistance),
          riskScore: area.riskScore,
          severity: area.accidentSeverity?.toUpperCase() || 'CRITICAL',
          urgentActions: dynamicActions.urgent,
          recommendedActions: dynamicActions.recommended,
          technicalDetails: {
            accidentFrequency: area.accidentFrequencyYearly,
            commonTypes: area.commonAccidentTypes,
            contributingFactors: area.contributingFactors,
            lastIncident: area.lastAccidentDate,
            dataSource: area.dataSource
          },
          routeImpact: calculateRouteImpact(area, route)
        });
      }

      // Process critical weather zones
      for (const weather of criticalWeather) {
        const dynamicActions = await generateCriticalWeatherActions(weather, route);
        criticalPoints.push({
          id: weather._id,
          type: 'Critical Weather Zone',
          location: `${weather.latitude}, ${weather.longitude}`,
          distanceFromStart: weather.distanceFromStartKm,
          distanceFromEnd: calculateDynamicDistanceFromEnd(weather.distanceFromStartKm, route.totalDistance),
          riskScore: weather.riskScore,
          severity: 'CRITICAL',
          urgentActions: dynamicActions.urgent,
          recommendedActions: dynamicActions.recommended,
          technicalDetails: {
            season: weather.season,
            weatherCondition: weather.weatherCondition,
            visibility: weather.visibilityKm,
            temperature: weather.averageTemperature,
            windSpeed: weather.windSpeedKmph
          },
          routeImpact: calculateRouteImpact(weather, route)
        });
      }

      // Process critical dead zones
      for (const deadZone of criticalDeadZones) {
        const dynamicActions = await generateCriticalDeadZoneActions(deadZone, route);
        criticalPoints.push({
          id: deadZone._id,
          type: 'Critical Dead Zone',
          location: `${deadZone.latitude}, ${deadZone.longitude}`,
          distanceFromStart: deadZone.distanceFromStartKm,
          distanceFromEnd: calculateDynamicDistanceFromEnd(deadZone.distanceFromStartKm, route.totalDistance),
          riskScore: deadZone.communicationRisk,
          severity: deadZone.deadZoneSeverity?.toUpperCase() || 'CRITICAL',
          urgentActions: dynamicActions.urgent,
          recommendedActions: dynamicActions.recommended,
          technicalDetails: {
            duration: deadZone.deadZoneDuration,
            radius: deadZone.deadZoneRadius,
            terrain: deadZone.terrain,
            operatorCoverage: deadZone.operatorCoverage
          },
          routeImpact: calculateRouteImpact(deadZone, route)
        });
      }

      // Sort by risk score (highest first)
      criticalPoints.sort((a, b) => b.riskScore - a.riskScore);

      // Generate DYNAMIC route recommendation
      const routeRecommendation = generateDynamicRouteRecommendation(criticalPoints, route);

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
          emergencyProtocols: generateEmergencyProtocols(criticalPoints, route)
        },
        message: `Identified ${criticalPoints.length} critical points requiring immediate attention on ${route.totalDistance}km route`
      });

    } catch (error) {
      console.error('Error fetching dynamic critical points:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving critical points',
        error: error.message
      });
    }
  }
};

// ============================================================================
// DYNAMIC HELPER FUNCTIONS
// ============================================================================

async function generateDynamicTurnData(turn, route) {
  const distanceFromEnd = calculateDynamicDistanceFromEnd(turn.distanceFromStartKm, route.totalDistance);
  
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
    assessment: generateTurnAssessment(turn, route)
  };
}

async function generateDynamicBlindSpotData(spot, route) {
  const distanceFromEnd = calculateDynamicDistanceFromEnd(spot.distanceFromStartKm, route.totalDistance);
  
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
    assessment: generateBlindSpotAssessment(spot, route)
  };
}

async function generateDynamicAccidentData(area, route) {
  const distanceFromEnd = calculateDynamicDistanceFromEnd(area.distanceFromStartKm, route.totalDistance);
  
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
    assessment: generateAccidentAssessment(area, route)
  };
}

async function generateDynamicWeatherData(weather, route) {
  const distanceFromEnd = calculateDynamicDistanceFromEnd(weather.distanceFromStartKm, route.totalDistance);
  
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
    assessment: generateWeatherAssessment(weather, route)
  };
}

async function generateDynamicDeadZoneData(deadZone, route) {
  const distanceFromEnd = calculateDynamicDistanceFromEnd(deadZone.distanceFromStartKm, route.totalDistance);
  
  // Speed doesn't need to be reduced for dead zones unless combined with other risks
  let recommendedSpeed = 60;
  if (deadZone.terrain === 'hilly') recommendedSpeed = 45;
  if (deadZone.deadZoneSeverity === 'critical') recommendedSpeed -= 10;
  
  return {
    distanceFromEnd: Math.max(0, Math.round(distanceFromEnd * 10) / 10),
    recommendedSpeed: `${Math.max(30, recommendedSpeed)} km/h`,
    assessment: generateDeadZoneAssessment(deadZone, route)
  };
}

function calculateDynamicDistanceFromEnd(distanceFromStart, totalDistance) {
  if (!distanceFromStart || !totalDistance) return 0;
  return Math.max(0, totalDistance - distanceFromStart);
}

function getDynamicRiskLevel(riskScore) {
  if (riskScore >= 9) return 'Critical';
  if (riskScore >= 7) return 'High';
  if (riskScore >= 5) return 'Medium';
  if (riskScore >= 3) return 'Low';
  return 'Minimal';
}

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
  
  return action;
}

function generateDynamicMapLink(lat, lng) {
  return `https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},17z/data=!3m1!1e3`;
}

function generateDynamicSummary(highRiskZones, route, riskThreshold) {
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
    riskThreshold: parseFloat(riskThreshold),
    analysisQuality: determineAnalysisQuality(highRiskZones)
  };
}

async function generateRouteRiskAssessment(route, highRiskZones) {
  const totalZones = highRiskZones.length;
  const criticalZones = highRiskZones.filter(zone => zone.riskLevel === 'Critical').length;
  
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
    }
  };
}

async function generateDetailedRiskAnalysis(route, highRiskZones) {
  const analysis = {
    spatialDistribution: analyzeSpatialDistribution(highRiskZones, route),
    riskClusters: identifyRiskClusters(highRiskZones),
    routeSegmentAnalysis: analyzeRouteSegments(highRiskZones, route),
    timeBasedRisk: analyzeTimeBasedRisk(highRiskZones),
    mitigationStrategies: generateMitigationStrategies(highRiskZones, route)
  };
  
  return analysis;
}

// Critical point action generators
async function generateCriticalTurnActions(turn, route) {
  const urgent = [
    'Immediate speed reduction to 15-20 km/h',
    'Deploy advance warning signals',
    'Use convoy formation with lead vehicle',
    'Continuous communication during passage'
  ];
  
  const recommended = [
    'Pre-brief all drivers on turn characteristics',
    'Ensure vehicles are in optimal mechanical condition',
    'Plan alternative route if conditions deteriorate',
    'Establish emergency response protocols'
  ];
  
  // Add turn-specific actions
  if (turn.turnAngle > 120) {
    urgent.push('Hairpin turn protocol - walking speed only');
  }
  if (turn.visibility === 'poor') {
    urgent.push('Deploy spotter at turn apex if possible');
  }
  
  return { urgent, recommended };
}

async function generateCriticalBlindSpotActions(spot, route) {
  const urgent = [
    'Mandatory full stop before blind area',
    'Deploy spotter or use mirrors/cameras',
    'Continuous horn/signal when entering',
    'Inch forward with maximum visibility checks'
  ];
  
  const recommended = [
    'Install additional mirrors or cameras if feasible',
    'Coordinate with other traffic users',
    'Plan travel during optimal visibility hours',
    'Carry emergency communication equipment'
  ];
  
  // Add spot-specific actions
  if (spot.visibilityDistance < 20) {
    urgent.push('EXTREME LIMITED VISIBILITY - Consider route alternative');
  }
  if (spot.spotType === 'intersection') {
    urgent.push('Check for cross-traffic from all directions');
  }
  
  return { urgent, recommended };
}

async function generateCriticalAccidentActions(area, route) {
  const urgent = [
    'Maximum alertness and reduced speed (30 km/h maximum)',
    'Enhanced communication protocols active',
    'Emergency response equipment ready',
    'Consider convoy travel through this zone'
  ];
  
  const recommended = [
    'Study accident patterns and timing',
    'Brief drivers on specific hazards',
    'Coordinate with local emergency services',
    'Monitor traffic and weather conditions'
  ];
  
  // Add accident-specific actions
  if (area.accidentSeverity === 'fatal') {
    urgent.unshift('CRITICAL: Consider alternative route - fatal accident history');
  }
  if (area.accidentFrequencyYearly > 10) {
    urgent.push('HIGH FREQUENCY accident zone - extreme caution');
  }
  
  return { urgent, recommended };
}

async function generateCriticalWeatherActions(weather, route) {
  const urgent = [
    'Monitor weather conditions continuously',
    'Adjust speed and following distance for conditions',
    'Use appropriate lighting and signals',
    'Be prepared to stop safely if conditions worsen'
  ];
  
  const recommended = [
    'Check weather forecasts before departure',
    'Carry weather-appropriate emergency supplies',
    'Plan alternative stopping points',
    'Coordinate timing with weather windows'
  ];
  
  // Add weather-specific actions
  if (weather.weatherCondition === 'foggy') {
    urgent.push('Use fog lights and reduce speed to 25 km/h');
  }
  if (weather.visibilityKm < 1) {
    urgent.push('Consider stopping safely until visibility improves');
  }
  
  return { urgent, recommended };
}

async function generateCriticalDeadZoneActions(deadZone, route) {
  const urgent = [
    'Test communication before entering zone',
    'Inform control room of entry and expected exit time',
    'Use satellite communication if available',
    'Travel in convoy with backup communication'
  ];
  
  const recommended = [
    'Carry multiple communication devices',
    'Plan emergency rendezvous points',
    'Brief all personnel on dead zone protocols',
    'Coordinate with emergency services'
  ];
  
  // Add dead zone-specific actions
  if (deadZone.deadZoneDuration > 60) {
    urgent.push('Extended dead zone - mandatory satellite communication');
  }
  if (deadZone.deadZoneSeverity === 'critical') {
    urgent.push('Critical communication gap - consider route postponement');
  }
  
  return { urgent, recommended };
}

function calculateRouteImpact(riskPoint, route) {
  const impact = {
    timeDelay: 0,
    speedReduction: 0,
    safetyMeasures: [],
    alternativeRequired: false
  };
  
  // Calculate based on risk score and type
  if (riskPoint.riskScore >= 9) {
    impact.timeDelay = 15; // minutes
    impact.speedReduction = 70; // percentage
    impact.alternativeRequired = true;
  } else if (riskPoint.riskScore >= 7) {
    impact.timeDelay = 10;
    impact.speedReduction = 50;
  } else if (riskPoint.riskScore >= 5) {
    impact.timeDelay = 5;
    impact.speedReduction = 30;
  }
  
  return impact;
}

function generateDynamicRouteRecommendation(criticalPoints, route) {
  const totalCritical = criticalPoints.length;
  const maxRisk = criticalPoints.length > 0 ? Math.max(...criticalPoints.map(p => p.riskScore)) : 0;
  const avgRisk = criticalPoints.length > 0 ? 
    criticalPoints.reduce((sum, p) => sum + p.riskScore, 0) / criticalPoints.length : 0;
  
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
    }
  };
}

function generateEmergencyProtocols(criticalPoints, route) {
  const protocols = {
    communication: [],
    medical: [],
    evacuation: [],
    coordination: []
  };
  
  // Communication protocols
  protocols.communication.push('Establish primary and backup communication channels');
  protocols.communication.push('Test all communication equipment before departure');
  protocols.communication.push('Maintain regular check-in schedule every 30 minutes');
  
  if (criticalPoints.some(p => p.type.includes('Dead Zone'))) {
    protocols.communication.push('Deploy satellite communication for dead zones');
    protocols.communication.push('Establish emergency rendezvous points');
  }
  
  // Medical protocols
  protocols.medical.push('Ensure first aid kits are available and current');
  protocols.medical.push('Brief personnel on emergency medical procedures');
  
  if (criticalPoints.length > 3) {
    protocols.medical.push('Consider medical personnel accompaniment');
    protocols.medical.push('Pre-coordinate with emergency medical services');
  }
  
  // Evacuation protocols
  protocols.evacuation.push('Identify safe stopping and turnaround points');
  protocols.evacuation.push('Plan emergency evacuation routes');
  
  if (criticalPoints.some(p => p.riskScore >= 9)) {
    protocols.evacuation.push('Establish emergency helicopter landing zones');
    protocols.evacuation.push('Pre-position emergency response equipment');
  }
  
  // Coordination protocols
  protocols.coordination.push('Notify relevant authorities of travel plans');
  protocols.coordination.push('Establish command and control structure');
  
  return protocols;
}

// Analysis helper functions
function analyzeSpatialDistribution(highRiskZones, route) {
  const segments = 5; // Divide route into 5 segments
  const segmentSize = route.totalDistance / segments;
  const distribution = Array(segments).fill(0);
  
  highRiskZones.forEach(zone => {
    const distance = parseFloat(zone.distanceFromSupply.replace(' km', ''));
    const segmentIndex = Math.min(segments - 1, Math.floor(distance / segmentSize));
    distribution[segmentIndex]++;
  });
  
  return distribution.map((count, index) => ({
    segment: index + 1,
    startKm: index * segmentSize,
    endKm: (index + 1) * segmentSize,
    riskCount: count,
    riskDensity: count / segmentSize
  }));
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
  const segmentAnalysis = analyzeSpatialDistribution(highRiskZones, route);
  
  return segmentAnalysis.map(segment => ({
    ...segment,
    riskLevel: segment.riskDensity > 0.5 ? 'High' : segment.riskDensity > 0.2 ? 'Medium' : 'Low',
    recommendation: segment.riskDensity > 0.5 ? 
      'Consider alternative route for this segment' :
      segment.riskDensity > 0.2 ?
      'Enhanced caution required' :
      'Standard precautions sufficient'
  }));
}

function analyzeTimeBasedRisk(highRiskZones) {
  // Analyze if certain risk types are more prevalent during specific times
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
      'Monitor weather forecasts - multiple weather risk zones identified' :
      'Standard weather monitoring sufficient',
    visibilityConsiderations: visibilityZones.length > 0 ?
      `${visibilityZones.length} visibility-limited zones - avoid low-light conditions` :
      'No significant visibility restrictions'
  };
}

function generateMitigationStrategies(highRiskZones, route) {
  const strategies = {
    immediate: [],
    shortTerm: [],
    longTerm: []
  };
  
  // Immediate strategies
  strategies.immediate.push('Implement all identified speed reductions and safety actions');
  strategies.immediate.push('Brief all personnel on identified risks before departure');
  strategies.immediate.push('Ensure all safety equipment is functional and accessible');
  
  // Short-term strategies
  strategies.shortTerm.push('Develop standard operating procedures for high-risk zones');
  strategies.shortTerm.push('Establish relationships with local emergency services');
  strategies.shortTerm.push('Create detailed risk maps and driver briefing materials');
  
  // Long-term strategies
  strategies.longTerm.push('Work with authorities to improve road safety infrastructure');
  strategies.longTerm.push('Develop alternative route options');
  strategies.longTerm.push('Implement technology solutions for high-risk areas');
  
  return strategies;
}

// Utility functions
function getRiskValue(riskLevel) {
  const values = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Minimal': 0.5 };
  return values[riskLevel] || 1;
}

function calculateRouteScore(route, highRiskZones) {
  let score = 100; // Start with perfect score
  
  highRiskZones.forEach(zone => {
    const riskValue = getRiskValue(zone.riskLevel);
    score -= riskValue * 2; // Deduct points based on risk
  });
  
  // Additional deductions for route characteristics
  if (route.terrain === 'hilly') score -= 5;
  if (route.totalDistance > 200) score -= 5;
  
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
  
  if (hasRealData && highRiskZones.length > 10) return 'High';
  if (hasRealData || highRiskZones.length > 5) return 'Medium';
  return 'Low';
}

// Assessment generators
function generateTurnAssessment(turn, route) {
  return `${turn.turnSeverity} turn with ${turn.turnAngle}° angle. ` +
         `Risk score: ${turn.riskScore}/10. ` +
         `Analysis method: ${turn.analysisMethod}. ` +
         `Confidence: ${Math.round((turn.confidence || 0.8) * 100)}%.`;
}

function generateBlindSpotAssessment(spot, route) {
  return `${spot.spotType} blind spot with ${spot.visibilityDistance}m visibility. ` +
         `Risk score: ${spot.riskScore}/10. ` +
         `Height obstruction: ${spot.obstructionHeight || 0}m. ` +
         `Confidence: ${Math.round((spot.confidence || 0.7) * 100)}%.`;
}

function generateAccidentAssessment(area, route) {
  return `Accident-prone area with ${area.accidentSeverity} severity incidents. ` +
         `Frequency: ${area.accidentFrequencyYearly || 0} accidents/year. ` +
         `Risk score: ${area.riskScore}/10. ` +
         `Data source: ${area.dataSource}.`;
}

function generateWeatherAssessment(weather, route) {
  return `Weather risk zone with ${weather.weatherCondition} conditions. ` +
         `Risk score: ${weather.riskScore}/10. ` +
         `Visibility: ${weather.visibilityKm || 'unknown'}km. ` +
         `Season: ${weather.season}.`;
}

function generateDeadZoneAssessment(deadZone, route) {
  return `Communication dead zone (${deadZone.deadZoneSeverity}) lasting ${deadZone.deadZoneDuration || 0} minutes. ` +
         `Coverage radius: ${deadZone.deadZoneRadius || 0}m. ` +
         `Terrain: ${deadZone.terrain}. ` +
         `Communication risk: ${deadZone.communicationRisk}/10.`;
}

module.exports = highRiskZonesController;