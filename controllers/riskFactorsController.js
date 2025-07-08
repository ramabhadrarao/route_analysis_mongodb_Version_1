// File: controllers/riskFactorsController.js
// Purpose: Handle risk factor analysis for routes

const Route = require('../models/Route');
const AccidentProneArea = require('../models/AccidentProneArea');
const SharpTurn = require('../models/SharpTurn');
const BlindSpot = require('../models/BlindSpot');
const TrafficData = require('../models/TrafficData');
const WeatherCondition = require('../models/WeatherCondition');
const EmergencyService = require('../models/EmergencyService');
const NetworkCoverage = require('../models/NetworkCoverage');
const RoadCondition = require('../models/RoadCondition');

const riskFactorsController = {

  // GET /api/routes/:routeId/risk-factors
  getRiskFactors: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      // Get risk factor scores
      const riskFactors = await Promise.all([
        this.calculateRoadConditionsRisk(routeId),
        this.calculateAccidentProneRisk(routeId),
        this.calculateSharpTurnsRisk(routeId),
        this.calculateBlindSpotsRisk(routeId),
        this.calculateTrafficRisk(routeId),
        this.calculateWeatherRisk(routeId),
        this.calculateEmergencyServicesRisk(routeId),
        this.calculateNetworkCoverageRisk(routeId),
        this.calculateAmenitiesRisk(routeId),
        this.calculateSecurityRisk(routeId)
      ]);

      const [
        roadConditions,
        accidentProne,
        sharpTurns,
        blindSpots,
        traffic,
        weather,
        emergencyServices,
        networkCoverage,
        amenities,
        security
      ] = riskFactors;

      const riskFactorData = [
        { 
          criterion: "Road Conditions", 
          score: roadConditions.score, 
          category: this.getRiskCategory(roadConditions.score),
          details: roadConditions.details
        },
        { 
          criterion: "Accident-Prone Areas", 
          score: accidentProne.score, 
          category: this.getRiskCategory(accidentProne.score),
          details: accidentProne.details
        },
        { 
          criterion: "Sharp Turns", 
          score: sharpTurns.score, 
          category: this.getRiskCategory(sharpTurns.score),
          details: sharpTurns.details
        },
        { 
          criterion: "Blind Spots", 
          score: blindSpots.score, 
          category: this.getRiskCategory(blindSpots.score),
          details: blindSpots.details
        },
        { 
          criterion: "Traffic Condition (Density & Two Way)", 
          score: traffic.score, 
          category: this.getRiskCategory(traffic.score),
          details: traffic.details
        },
        { 
          criterion: "Seasonal Weather Conditions", 
          score: weather.score, 
          category: this.getRiskCategory(weather.score),
          details: weather.details
        },
        { 
          criterion: "Emergency Handling Services", 
          score: emergencyServices.score, 
          category: this.getRiskCategory(emergencyServices.score),
          details: emergencyServices.details
        },
        { 
          criterion: "Network Dead / Low Zones", 
          score: networkCoverage.score, 
          category: this.getRiskCategory(networkCoverage.score),
          details: networkCoverage.details
        },
        { 
          criterion: "Roadside Amenities", 
          score: amenities.score, 
          category: this.getRiskCategory(amenities.score),
          details: amenities.details
        },
        { 
          criterion: "Security & Social Issues", 
          score: security.score, 
          category: this.getRiskCategory(security.score),
          details: security.details
        }
      ];

      // Calculate overall risk score
      const totalWeightedScore = this.calculateOverallRisk(riskFactorData);
      const overallRiskCategory = this.getRiskCategory(totalWeightedScore);

      res.json({
        success: true,
        data: {
          riskFactors: riskFactorData,
          overallRisk: {
            totalWeightedScore: Math.round(totalWeightedScore * 10) / 10,
            category: overallRiskCategory,
            grade: this.getRiskGrade(totalWeightedScore)
          },
          summary: {
            criticalFactors: riskFactorData.filter(rf => rf.score >= 4).length,
            highRiskFactors: riskFactorData.filter(rf => rf.score >= 3 && rf.score < 4).length,
            averageRiskScore: Math.round((riskFactorData.reduce((sum, rf) => sum + rf.score, 0) / riskFactorData.length) * 10) / 10
          }
        },
        message: 'Risk factors calculated successfully'
      });

    } catch (error) {
      console.error('Error calculating risk factors:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating risk factors',
        error: error.message
      });
    }
  },

  // Helper methods for calculating individual risk factors
  calculateRoadConditionsRisk: async (routeId) => {
    try {
      const roadConditions = await RoadCondition.find({ routeId });
      
      if (!roadConditions || roadConditions.length === 0) {
        return { score: 2.0, details: "No road condition data available" };
      }

      const avgRiskScore = roadConditions.reduce((sum, condition) => sum + condition.riskScore, 0) / roadConditions.length;
      const criticalSections = roadConditions.filter(condition => condition.surfaceQuality === 'critical' || condition.surfaceQuality === 'poor').length;
      
      return {
        score: Math.min(5.0, avgRiskScore / 2), // Scale to 1-5
        details: `${roadConditions.length} segments analyzed, ${criticalSections} critical sections identified`
      };
    } catch (error) {
      return { score: 3.0, details: "Error analyzing road conditions" };
    }
  },

  calculateAccidentProneRisk: async (routeId) => {
    try {
      const accidentAreas = await AccidentProneArea.find({ routeId });
      
      if (!accidentAreas || accidentAreas.length === 0) {
        return { score: 1.0, details: "No accident-prone areas identified" };
      }

      const avgRiskScore = accidentAreas.reduce((sum, area) => sum + area.riskScore, 0) / accidentAreas.length;
      const fatalAreas = accidentAreas.filter(area => area.accidentSeverity === 'fatal').length;
      const majorAreas = accidentAreas.filter(area => area.accidentSeverity === 'major').length;
      
      return {
        score: Math.min(5.0, avgRiskScore / 2.5), // Scale to 1-5
        details: `${accidentAreas.length} accident-prone areas, ${fatalAreas} fatal zones, ${majorAreas} major risk zones`
      };
    } catch (error) {
      return { score: 2.5, details: "Error analyzing accident data" };
    }
  },

  calculateSharpTurnsRisk: async (routeId) => {
    try {
      const sharpTurns = await SharpTurn.find({ routeId });
      
      if (!sharpTurns || sharpTurns.length === 0) {
        return { score: 1.0, details: "No sharp turns identified" };
      }

      const avgRiskScore = sharpTurns.reduce((sum, turn) => sum + turn.riskScore, 0) / sharpTurns.length;
      const criticalTurns = sharpTurns.filter(turn => turn.riskScore >= 8).length;
      const hairpinTurns = sharpTurns.filter(turn => turn.turnSeverity === 'hairpin').length;
      
      return {
        score: Math.min(5.0, avgRiskScore / 2), // Scale to 1-5
        details: `${sharpTurns.length} sharp turns, ${criticalTurns} critical turns, ${hairpinTurns} hairpin turns`
      };
    } catch (error) {
      return { score: 2.0, details: "Error analyzing sharp turns" };
    }
  },

  calculateBlindSpotsRisk: async (routeId) => {
    try {
      const blindSpots = await BlindSpot.find({ routeId });
      
      if (!blindSpots || blindSpots.length === 0) {
        return { score: 1.0, details: "No blind spots identified" };
      }

      const avgRiskScore = blindSpots.reduce((sum, spot) => sum + spot.riskScore, 0) / blindSpots.length;
      const criticalSpots = blindSpots.filter(spot => spot.riskScore >= 8).length;
      const poorVisibility = blindSpots.filter(spot => spot.visibilityDistance < 50).length;
      
      return {
        score: Math.min(5.0, avgRiskScore / 2.5), // Scale to 1-5
        details: `${blindSpots.length} blind spots, ${criticalSpots} critical spots, ${poorVisibility} poor visibility areas`
      };
    } catch (error) {
      return { score: 2.0, details: "Error analyzing blind spots" };
    }
  },

  calculateTrafficRisk: async (routeId) => {
    try {
      const trafficData = await TrafficData.find({ routeId });
      
      if (!trafficData || trafficData.length === 0) {
        return { score: 1.0, details: "No traffic data available - assuming light traffic" };
      }

      const heavyCongestion = trafficData.filter(data => data.congestionLevel === 'heavy' || data.congestionLevel === 'severe').length;
      const avgRiskScore = trafficData.reduce((sum, data) => sum + data.riskScore, 0) / trafficData.length;
      
      return {
        score: Math.min(5.0, avgRiskScore / 3), // Scale to 1-5
        details: `${trafficData.length} traffic segments analyzed, ${heavyCongestion} heavy congestion areas`
      };
    } catch (error) {
      return { score: 2.0, details: "Error analyzing traffic data" };
    }
  },

  calculateWeatherRisk: async (routeId) => {
    try {
      const weatherData = await WeatherCondition.find({ routeId });
      
      if (!weatherData || weatherData.length === 0) {
        return { score: 3.0, details: "No weather data available - assuming moderate seasonal risk" };
      }

      const avgRiskScore = weatherData.reduce((sum, condition) => sum + condition.riskScore, 0) / weatherData.length;
      const severeWeather = weatherData.filter(condition => condition.drivingConditionImpact === 'severe').length;
      
      return {
        score: Math.min(5.0, avgRiskScore / 3), // Scale to 1-5
        details: `${weatherData.length} weather conditions analyzed, ${severeWeather} severe weather zones`
      };
    } catch (error) {
      return { score: 3.0, details: "Error analyzing weather conditions" };
    }
  },

  calculateEmergencyServicesRisk: async (routeId) => {
    try {
      const emergencyServices = await EmergencyService.find({ 
        routeId, 
        serviceType: { $in: ['hospital', 'police', 'fire_station'] },
        distanceFromRouteKm: { $lte: 30 } // Within 30km
      });
      
      const hospitalCount = emergencyServices.filter(service => service.serviceType === 'hospital').length;
      const policeCount = emergencyServices.filter(service => service.serviceType === 'police').length;
      const fireCount = emergencyServices.filter(service => service.serviceType === 'fire_station').length;
      
      let score = 5.0; // Start with high risk
      
      // Reduce risk based on service availability
      if (hospitalCount >= 3) score -= 1.5;
      else if (hospitalCount >= 1) score -= 1.0;
      
      if (policeCount >= 2) score -= 1.0;
      else if (policeCount >= 1) score -= 0.5;
      
      if (fireCount >= 2) score -= 1.0;
      else if (fireCount >= 1) score -= 0.5;
      
      return {
        score: Math.max(1.0, score),
        details: `${hospitalCount} hospitals, ${policeCount} police stations, ${fireCount} fire stations within 30km`
      };
    } catch (error) {
      return { score: 3.0, details: "Error analyzing emergency services" };
    }
  },

  calculateNetworkCoverageRisk: async (routeId) => {
    try {
      const networkData = await NetworkCoverage.find({ routeId });
      
      if (!networkData || networkData.length === 0) {
        return { score: 3.0, details: "No network coverage data available" };
      }

      const deadZones = networkData.filter(data => data.isDeadZone).length;
      const weakSignal = networkData.filter(data => data.signalStrength < 4).length;
      const avgCommunicationRisk = networkData.reduce((sum, data) => sum + data.communicationRisk, 0) / networkData.length;
      
      return {
        score: Math.min(5.0, avgCommunicationRisk / 2.5), // Scale to 1-5
        details: `${networkData.length} coverage points, ${deadZones} dead zones, ${weakSignal} weak signal areas`
      };
    } catch (error) {
      return { score: 3.0, details: "Error analyzing network coverage" };
    }
  },

  calculateAmenitiesRisk: async (routeId) => {
    try {
      const amenities = await EmergencyService.find({ 
        routeId, 
        serviceType: { $in: ['amenity', 'transport'] },
        distanceFromRouteKm: { $lte: 20 }
      });
      
      let score = 3.0; // Neutral starting point
      
      if (amenities.length >= 10) score = 1.0; // Low risk - good amenities
      else if (amenities.length >= 5) score = 1.5;
      else if (amenities.length >= 2) score = 2.0;
      else score = 3.0; // High risk - few amenities
      
      return {
        score: score,
        details: `${amenities.length} roadside amenities within 20km of route`
      };
    } catch (error) {
      return { score: 2.0, details: "Error analyzing roadside amenities" };
    }
  },

  calculateSecurityRisk: async (routeId) => {
    try {
      // This would typically analyze security incidents, crime data, etc.
      // For now, we'll provide a baseline assessment
      return {
        score: 1.0,
        details: "No major security issues identified - standard precautions recommended"
      };
    } catch (error) {
      return { score: 2.0, details: "Error analyzing security conditions" };
    }
  },

  // Helper methods
  getRiskCategory: (score) => {
    if (score >= 4.0) return 'High Risk';
    if (score >= 3.0) return 'Mild Risk';
    if (score >= 2.0) return 'Low Risk';
    return 'Minimal Risk';
  },

  getRiskGrade: (score) => {
    if (score >= 4.0) return 'D';
    if (score >= 3.0) return 'C';
    if (score >= 2.0) return 'B';
    return 'A';
  },

  calculateOverallRisk: (riskFactors) => {
    // Weighted calculation - some factors are more important
    const weights = {
      'Road Conditions': 0.15,
      'Accident-Prone Areas': 0.15,
      'Sharp Turns': 0.12,
      'Blind Spots': 0.12,
      'Traffic Condition (Density & Two Way)': 0.10,
      'Seasonal Weather Conditions': 0.10,
      'Emergency Handling Services': 0.08,
      'Network Dead / Low Zones': 0.08,
      'Roadside Amenities': 0.05,
      'Security & Social Issues': 0.05
    };

    let weightedSum = 0;
    let totalWeight = 0;

    riskFactors.forEach(factor => {
      const weight = weights[factor.criterion] || 0.1;
      weightedSum += factor.score * weight;
      totalWeight += weight;
    });

    return weightedSum / totalWeight;
  }
};

module.exports = riskFactorsController;