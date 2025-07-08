// File: controllers/highRiskZonesController.js
// Purpose: Handle high risk zones and critical points analysis

const mongoose = require('mongoose');
const SharpTurn = require('../models/SharpTurn');
const BlindSpot = require('../models/BlindSpot');
const AccidentProneArea = require('../models/AccidentProneArea');
const WeatherCondition = require('../models/WeatherCondition');
const NetworkCoverage = require('../models/NetworkCoverage');

const highRiskZonesController = {

  // GET /api/routes/:routeId/high-risk-zones
  getHighRiskZones: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      // Validate route ID
      if (!mongoose.Types.ObjectId.isValid(routeId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid route ID'
        });
      }

      // Get all high-risk zones with parallel queries
      const [sharpTurns, blindSpots, accidentAreas, weatherZones, deadZones] = await Promise.all([
        SharpTurn.find({ 
          routeId, 
          riskScore: { $gte: 6 } 
        }).sort({ riskScore: -1 }),
        
        BlindSpot.find({ 
          routeId, 
          riskScore: { $gte: 6 } 
        }).sort({ riskScore: -1 }),
        
        AccidentProneArea.find({ 
          routeId, 
          riskScore: { $gte: 6 } 
        }).sort({ riskScore: -1 }),
        
        WeatherCondition.find({ 
          routeId, 
          riskScore: { $gte: 6 } 
        }).sort({ riskScore: -1 }),
        
        NetworkCoverage.find({ 
          routeId, 
          isDeadZone: true 
        }).sort({ communicationRisk: -1 })
      ]);

      // Process and format high-risk zones
      const highRiskZones = [];

      // Process Sharp Turns
      sharpTurns.forEach(turn => {
        const distanceFromCustomer = this.calculateDistanceFromCustomer(turn.distanceFromStartKm, 131); // Assuming 131km total
        
        highRiskZones.push({
          type: "Sharp Turn",
          id: turn._id,
          distanceFromSupply: `${turn.distanceFromStartKm} km`,
          distanceFromCustomer: `${distanceFromCustomer} km`,
          coordinates: {
            lat: turn.latitude,
            lng: turn.longitude
          },
          riskLevel: this.getRiskLevel(turn.riskScore),
          speedLimit: `${turn.recommendedSpeed} km/h`,
          driverAction: this.getSharpTurnAction(turn),
          mapLink: turn.mapsLink || this.generateMapLink(turn.latitude, turn.longitude),
          severity: turn.turnSeverity,
          turnAngle: turn.turnAngle,
          additionalInfo: {
            turnDirection: turn.turnDirection,
            visibility: turn.visibility,
            guardrails: turn.guardrails,
            warningSigns: turn.warningSigns
          }
        });
      });

      // Process Blind Spots
      blindSpots.forEach(spot => {
        const distanceFromCustomer = this.calculateDistanceFromCustomer(spot.distanceFromStartKm, 131);
        
        highRiskZones.push({
          type: "Blind Spot",
          id: spot._id,
          distanceFromSupply: `${spot.distanceFromStartKm} km`,
          distanceFromCustomer: `${distanceFromCustomer} km`,
          coordinates: {
            lat: spot.latitude,
            lng: spot.longitude
          },
          riskLevel: this.getRiskLevel(spot.riskScore),
          speedLimit: `${spot.speedLimit || 30} km/h`,
          driverAction: this.getBlindSpotAction(spot),
          mapLink: spot.satelliteViewLink || this.generateMapLink(spot.latitude, spot.longitude),
          severity: spot.severityLevel,
          visibilityDistance: spot.visibilityDistance,
          additionalInfo: {
            spotType: spot.spotType,
            obstructionHeight: spot.obstructionHeight,
            mirrorInstalled: spot.mirrorInstalled,
            warningSignsPresent: spot.warningSignsPresent
          }
        });
      });

      // Process Accident-Prone Areas
      accidentAreas.forEach(area => {
        const distanceFromCustomer = this.calculateDistanceFromCustomer(area.distanceFromStartKm, 131);
        
        highRiskZones.push({
          type: "Accident-Prone Area",
          id: area._id,
          distanceFromSupply: `${area.distanceFromStartKm} km`,
          distanceFromCustomer: `${distanceFromCustomer} km`,
          coordinates: {
            lat: area.latitude,
            lng: area.longitude
          },
          riskLevel: this.getRiskLevel(area.riskScore),
          speedLimit: "40 km/h",
          driverAction: this.getAccidentZoneAction(area),
          mapLink: this.generateMapLink(zone.latitude, zone.longitude),
          severity: "critical",
          additionalInfo: {
            season: zone.season,
            weatherCondition: zone.weatherCondition,
            recommendedPrecautions: zone.recommendedPrecautions
          }
        });
      });

      // Sort by risk level and distance
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

      // Generate summary statistics
      const summary = {
        totalHighRiskZones: highRiskZones.length,
        criticalZones: highRiskZones.filter(zone => zone.riskLevel === 'Critical').length,
        highRiskZones: highRiskZones.filter(zone => zone.riskLevel === 'High').length,
        mediumRiskZones: highRiskZones.filter(zone => zone.riskLevel === 'Medium').length,
        typeBreakdown: {
          sharpTurns: highRiskZones.filter(zone => zone.type === 'Sharp Turn').length,
          blindSpots: highRiskZones.filter(zone => zone.type === 'Blind Spot').length,
          accidentProneAreas: highRiskZones.filter(zone => zone.type === 'Accident-Prone Area').length,
          communicationDeadZones: highRiskZones.filter(zone => zone.type === 'Communication Dead Zone').length,
          wildlifeSanctuaryZones: highRiskZones.filter(zone => zone.type === 'Wildlife Sanctuary Zone').length
        }
      };

      res.json({
        success: true,
        data: {
          highRiskZones: highRiskZones,
          summary: summary,
          totalAnalyzed: {
            sharpTurns: sharpTurns.length,
            blindSpots: blindSpots.length,
            accidentAreas: accidentAreas.length,
            deadZones: deadZones.length,
            wildlifeZones: wildlifeZones.length
          }
        },
        message: `Found ${highRiskZones.length} high-risk zones along the route`
      });

    } catch (error) {
      console.error('Error fetching high-risk zones:', error);
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
      
      // Get only critical points (risk score >= 8)
      const [criticalTurns, criticalBlindSpots, criticalAccidents] = await Promise.all([
        SharpTurn.find({ 
          routeId, 
          riskScore: { $gte: 8 } 
        }).sort({ riskScore: -1 }),
        
        BlindSpot.find({ 
          routeId, 
          riskScore: { $gte: 8 } 
        }).sort({ riskScore: -1 }),
        
        AccidentProneArea.find({ 
          routeId, 
          $or: [
            { riskScore: { $gte: 8 } },
            { accidentSeverity: 'fatal' }
          ]
        }).sort({ riskScore: -1 })
      ]);

      const criticalPoints = [];

      // Process critical turns
      criticalTurns.forEach(turn => {
        criticalPoints.push({
          id: turn._id,
          type: 'Critical Sharp Turn',
          location: `${turn.latitude}, ${turn.longitude}`,
          distanceFromStart: turn.distanceFromStartKm,
          riskScore: turn.riskScore,
          severity: 'CRITICAL',
          urgentActions: [
            'Reduce speed to 15-20 km/h',
            'Use convoy travel with communication',
            'Deploy warning signals',
            'Consider alternative route if available'
          ],
          technicalDetails: {
            turnAngle: turn.turnAngle,
            turnDirection: turn.turnDirection,
            recommendedSpeed: turn.recommendedSpeed,
            visibility: turn.visibility
          }
        });
      });

      // Process critical blind spots
      criticalBlindSpots.forEach(spot => {
        criticalPoints.push({
          id: spot._id,
          type: 'Critical Blind Spot',
          location: `${spot.latitude}, ${spot.longitude}`,
          distanceFromStart: spot.distanceFromStartKm,
          riskScore: spot.riskScore,
          severity: 'CRITICAL',
          urgentActions: [
            'Full stop and visibility check',
            'Use horn/signal continuously',
            'Convoy travel mandatory',
            'Deploy spotter if possible'
          ],
          technicalDetails: {
            visibilityDistance: spot.visibilityDistance,
            spotType: spot.spotType,
            obstructionHeight: spot.obstructionHeight
          }
        });
      });

      // Process critical accident areas
      criticalAccidents.forEach(area => {
        criticalPoints.push({
          id: area._id,
          type: 'Critical Accident Zone',
          location: `${area.latitude}, ${area.longitude}`,
          distanceFromStart: area.distanceFromStartKm,
          riskScore: area.riskScore,
          severity: area.accidentSeverity.toUpperCase(),
          urgentActions: [
            'Maximum alertness required',
            'Speed limit 30 km/h or lower',
            'Enhanced communication protocols',
            'Emergency response readiness'
          ],
          technicalDetails: {
            accidentFrequency: area.accidentFrequencyYearly,
            commonTypes: area.commonAccidentTypes,
            contributingFactors: area.contributingFactors,
            lastIncident: area.lastAccidentDate
          }
        });
      });

      // Sort by risk score (highest first)
      criticalPoints.sort((a, b) => b.riskScore - a.riskScore);

      res.json({
        success: true,
        data: {
          criticalPoints: criticalPoints,
          summary: {
            totalCriticalPoints: criticalPoints.length,
            criticalTurns: criticalTurns.length,
            criticalBlindSpots: criticalBlindSpots.length,
            criticalAccidentZones: criticalAccidents.length,
            averageRiskScore: criticalPoints.length > 0 ? 
              Math.round((criticalPoints.reduce((sum, point) => sum + point.riskScore, 0) / criticalPoints.length) * 10) / 10 : 0
          },
          routeRecommendation: this.getRouteRecommendation(criticalPoints.length)
        },
        message: `Identified ${criticalPoints.length} critical points requiring immediate attention`
      });

    } catch (error) {
      console.error('Error fetching critical points:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving critical points',
        error: error.message
      });
    }
  },

  // Helper methods
  calculateDistanceFromCustomer: (distanceFromStart, totalDistance) => {
    const remaining = totalDistance - distanceFromStart;
    return Math.max(0, Math.round(remaining * 10) / 10);
  },

  getRiskLevel: (riskScore) => {
    if (riskScore >= 8) return 'Critical';
    if (riskScore >= 6) return 'High';
    if (riskScore >= 4) return 'Medium';
    return 'Low';
  },

  getSharpTurnAction: (turn) => {
    if (turn.riskScore >= 8) {
      return 'Stop, check visibility, proceed extremely slowly';
    } else if (turn.riskScore >= 6) {
      return 'Reduce speed significantly, use horn';
    } else {
      return 'Reduce speed, maintain caution';
    }
  },

  getBlindSpotAction: (spot) => {
    if (spot.riskScore >= 8) {
      return 'Full stop, check mirrors, inch forward slowly';
    } else if (spot.riskScore >= 6) {
      return 'Use horn, stay alert, reduce speed';
    } else {
      return 'Use horn, maintain alertness';
    }
  },

  getAccidentZoneAction: (area) => {
    if (area.accidentSeverity === 'fatal') {
      return 'Exercise extreme caution, consider alternative route';
    } else if (area.accidentSeverity === 'major') {
      return 'Reduce speed significantly, enhance communication';
    } else {
      return 'Maintain heightened awareness, follow safety protocols';
    }
  },

  generateMapLink: (lat, lng) => {
    return `https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},17z`;
  },

  getRouteRecommendation: (criticalPointCount) => {
    if (criticalPointCount >= 5) {
      return {
        level: 'URGENT',
        recommendation: 'Consider alternative route - multiple critical points detected',
        actions: [
          'Evaluate alternative routes immediately',
          'If route must be used, implement maximum safety protocols',
          'Consider convoy travel with emergency support',
          'Notify all stakeholders of high-risk conditions'
        ]
      };
    } else if (criticalPointCount >= 2) {
      return {
        level: 'HIGH CAUTION',
        recommendation: 'Proceed with enhanced safety measures',
        actions: [
          'Implement enhanced safety protocols',
          'Consider convoy travel',
          'Ensure emergency communication readiness',
          'Brief all drivers on critical points'
        ]
      };
    } else if (criticalPointCount >= 1) {
      return {
        level: 'CAUTION',
        recommendation: 'Standard enhanced precautions required',
        actions: [
          'Brief drivers on critical point locations',
          'Ensure emergency equipment readiness',
          'Maintain constant communication'
        ]
      };
    } else {
      return {
        level: 'NORMAL',
        recommendation: 'Standard safety protocols sufficient',
        actions: [
          'Follow standard safety guidelines',
          'Maintain normal alertness levels'
        ]
      };
    }
  }
};

module.exports = highRiskZonesController;