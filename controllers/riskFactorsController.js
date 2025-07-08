// File: controllers/riskFactorsController.js (QUICK FIX VERSION)
// Purpose: Handle risk factor analysis for routes with proper exports

const Route = require('../models/Route');
const AccidentProneArea = require('../models/AccidentProneArea');
const RoadCondition = require('../models/RoadCondition');
const WeatherCondition = require('../models/WeatherCondition');
const TrafficData = require('../models/TrafficData');
const EmergencyService = require('../models/EmergencyService');
const NetworkCoverage = require('../models/NetworkCoverage');

const riskFactorsController = {

  // GET /api/routes/:routeId/risk-factors
  getRiskFactors: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      console.log(`⚠️ Risk factors request for route: ${routeId}`);
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      console.log(`   Found route: ${route.routeName || route.routeId}`);

      // Get risk factor data from various sources
      const [roadConditions, accidentAreas, weatherData, trafficData, emergencyServices, networkData] = await Promise.all([
        RoadCondition.find({ routeId }).catch(() => []),
        AccidentProneArea.find({ routeId }).catch(() => []),
        WeatherCondition.find({ routeId }).catch(() => []),
        TrafficData.find({ routeId }).catch(() => []),
        EmergencyService.find({ routeId }).catch(() => []),
        NetworkCoverage.find({ routeId }).catch(() => [])
      ]);

      console.log(`   Data found: ${roadConditions.length} road, ${accidentAreas.length} accident, ${weatherData.length} weather, ${trafficData.length} traffic, ${emergencyServices.length} emergency, ${networkData.length} network`);

      // Calculate individual risk factors
      const riskFactors = [
        {
          criterion: "Road Conditions",
          score: calculateRoadConditionsRisk(roadConditions, route),
          category: getRiskCategory(calculateRoadConditionsRisk(roadConditions, route)),
          details: `${roadConditions.length} road segments analyzed`
        },
        {
          criterion: "Accident-Prone Areas", 
          score: calculateAccidentProneRisk(accidentAreas),
          category: getRiskCategory(calculateAccidentProneRisk(accidentAreas)),
          details: `${accidentAreas.length} accident-prone areas identified`
        },
        {
          criterion: "Sharp Turns",
          score: calculateSharpTurnsRisk(route),
          category: getRiskCategory(calculateSharpTurnsRisk(route)),
          details: "Geometric analysis based on route characteristics"
        },
        {
          criterion: "Blind Spots",
          score: calculateBlindSpotsRisk(route),
          category: getRiskCategory(calculateBlindSpotsRisk(route)),
          details: "Visibility analysis based on terrain and route geometry"
        },
        {
          criterion: "Traffic Condition (Density & Two Way)",
          score: calculateTrafficRisk(trafficData, route),
          category: getRiskCategory(calculateTrafficRisk(trafficData, route)),
          details: `${trafficData.length} traffic data points analyzed`
        },
        {
          criterion: "Seasonal Weather Conditions",
          score: calculateWeatherRisk(weatherData, route),
          category: getRiskCategory(calculateWeatherRisk(weatherData, route)),
          details: `${weatherData.length} weather conditions analyzed`
        },
        {
          criterion: "Emergency Handling Services",
          score: calculateEmergencyServicesRisk(emergencyServices, route),
          category: getRiskCategory(calculateEmergencyServicesRisk(emergencyServices, route)),
          details: `${emergencyServices.length} emergency facilities within range`
        },
        {
          criterion: "Network Dead / Low Zones",
          score: calculateNetworkRisk(networkData, route),
          category: getRiskCategory(calculateNetworkRisk(networkData, route)),
          details: `${networkData.length} network coverage points analyzed`
        },
        {
          criterion: "Roadside Amenities",
          score: calculateAmenitiesRisk(emergencyServices, route),
          category: getRiskCategory(calculateAmenitiesRisk(emergencyServices, route)),
          details: "Fuel stations and rest areas availability assessment"
        },
        {
          criterion: "Security & Social Issues",
          score: calculateSecurityRisk(route),
          category: getRiskCategory(calculateSecurityRisk(route)),
          details: "General security assessment based on route characteristics"
        }
      ];

      // Calculate overall risk score
      const totalWeightedScore = calculateOverallRisk(riskFactors);
      const overallRiskCategory = getRiskCategory(totalWeightedScore);

      console.log(`   ✅ Risk analysis completed. Overall score: ${totalWeightedScore.toFixed(2)}`);

      res.json({
        success: true,
        data: {
          riskFactors,
          overallRisk: {
            totalWeightedScore: Math.round(totalWeightedScore * 100) / 100,
            category: overallRiskCategory,
            grade: getRiskGrade(totalWeightedScore)
          },
          summary: {
            criticalFactors: riskFactors.filter(rf => rf.score >= 4).length,
            highRiskFactors: riskFactors.filter(rf => rf.score >= 3 && rf.score < 4).length,
            averageRiskScore: Math.round((riskFactors.reduce((sum, rf) => sum + rf.score, 0) / riskFactors.length) * 100) / 100
          },
          dataQuality: {
            roadConditions: roadConditions.length > 0 ? 'Available' : 'Default',
            accidentData: accidentAreas.length > 0 ? 'Available' : 'Default',
            weatherData: weatherData.length > 0 ? 'Available' : 'Default',
            trafficData: trafficData.length > 0 ? 'Available' : 'Default',
            emergencyServices: emergencyServices.length > 0 ? 'Available' : 'Default',
            networkCoverage: networkData.length > 0 ? 'Available' : 'Default'
          }
        },
        message: 'Risk factors calculated successfully'
      });

    } catch (error) {
      console.error('Risk factors calculation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating risk factors',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};

// Helper functions for risk calculations
function calculateRoadConditionsRisk(roadConditions, route) {
  if (!roadConditions || roadConditions.length === 0) {
    // Default based on terrain
    if (route.terrain === 'hilly') return 3.5;
    if (route.terrain === 'urban') return 2.0;
    if (route.terrain === 'rural') return 3.0;
    return 2.5;
  }
  
  const avgRiskScore = roadConditions.reduce((sum, condition) => sum + (condition.riskScore || 3), 0) / roadConditions.length;
  const criticalSections = roadConditions.filter(condition => 
    condition.surfaceQuality === 'critical' || condition.surfaceQuality === 'poor'
  ).length;
  
  let baseScore = Math.min(5.0, avgRiskScore / 2);
  if (criticalSections > roadConditions.length * 0.3) baseScore += 1; // 30% critical sections add risk
  
  return Math.min(5.0, baseScore);
}

function calculateAccidentProneRisk(accidentAreas) {
  if (!accidentAreas || accidentAreas.length === 0) return 1.5;
  
  const avgRiskScore = accidentAreas.reduce((sum, area) => sum + (area.riskScore || 5), 0) / accidentAreas.length;
  const fatalAreas = accidentAreas.filter(area => area.accidentSeverity === 'fatal').length;
  
  let score = Math.min(5.0, avgRiskScore / 2.5);
  if (fatalAreas > 0) score += fatalAreas * 0.5; // Fatal areas increase risk
  
  return Math.min(5.0, score);
}

function calculateSharpTurnsRisk(route) {
  // Default assessment based on terrain and distance
  let baseRisk = 1.0;
  
  if (route.terrain === 'hilly') baseRisk = 3.5;
  else if (route.terrain === 'rural') baseRisk = 2.0;
  else if (route.terrain === 'urban') baseRisk = 1.5;
  
  // Longer routes may have more turns
  if (route.totalDistance > 100) baseRisk += 0.5;
  
  return Math.min(5.0, baseRisk);
}

function calculateBlindSpotsRisk(route) {
  // Default assessment based on terrain
  let baseRisk = 1.0;
  
  if (route.terrain === 'hilly') baseRisk = 3.0;
  else if (route.terrain === 'rural') baseRisk = 2.5;
  else if (route.terrain === 'urban') baseRisk = 1.5;
  
  return Math.min(5.0, baseRisk);
}

function calculateTrafficRisk(trafficData, route) {
  if (!trafficData || trafficData.length === 0) {
    // Default based on terrain
    if (route.terrain === 'urban') return 3.0;
    if (route.terrain === 'rural') return 1.5;
    return 2.0;
  }
  
  const heavyCongestion = trafficData.filter(data => 
    data.congestionLevel === 'heavy' || data.congestionLevel === 'severe'
  ).length;
  
  const avgRiskScore = trafficData.reduce((sum, data) => sum + (data.riskScore || 3), 0) / trafficData.length;
  
  return Math.min(5.0, avgRiskScore / 3);
}

function calculateWeatherRisk(weatherData, route) {
  if (!weatherData || weatherData.length === 0) {
    // Default seasonal risk
    if (route.terrain === 'hilly') return 4.0;
    return 3.0;
  }
  
  const avgRiskScore = weatherData.reduce((sum, condition) => sum + (condition.riskScore || 3), 0) / weatherData.length;
  const severeWeather = weatherData.filter(condition => 
    condition.drivingConditionImpact === 'severe'
  ).length;
  
  let score = Math.min(5.0, avgRiskScore / 3);
  if (severeWeather > 0) score += severeWeather * 0.3;
  
  return Math.min(5.0, score);
}

function calculateEmergencyServicesRisk(emergencyServices, route) {
  if (!emergencyServices || emergencyServices.length === 0) {
    // High risk if no emergency services
    return 4.0;
  }
  
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
  
  return Math.max(1.0, score);
}

function calculateNetworkRisk(networkData, route) {
  if (!networkData || networkData.length === 0) {
    // Default network risk based on terrain
    if (route.terrain === 'rural') return 4.0;
    if (route.terrain === 'hilly') return 4.5;
    return 3.0;
  }
  
  const deadZones = networkData.filter(data => data.isDeadZone).length;
  const weakSignal = networkData.filter(data => data.signalStrength < 4).length;
  const avgCommunicationRisk = networkData.reduce((sum, data) => sum + (data.communicationRisk || 3), 0) / networkData.length;
  
  return Math.min(5.0, avgCommunicationRisk / 2.5);
}

function calculateAmenitiesRisk(emergencyServices, route) {
  if (!emergencyServices || emergencyServices.length === 0) return 3.0;
  
  const amenities = emergencyServices.filter(service => 
    service.serviceType === 'amenity' || service.serviceType === 'fuel'
  );
  
  let score = 3.0; // Neutral starting point
  
  if (amenities.length >= 10) score = 1.0;
  else if (amenities.length >= 5) score = 1.5;
  else if (amenities.length >= 2) score = 2.0;
  else score = 3.0;
  
  return score;
}

function calculateSecurityRisk(route) {
  // Basic security assessment
  let baseRisk = 1.0;
  
  if (route.terrain === 'rural') baseRisk = 2.0; // Rural areas may have less security
  if (route.totalDistance > 200) baseRisk += 0.5; // Long routes increase exposure
  
  return Math.min(5.0, baseRisk);
}

function getRiskCategory(score) {
  if (score >= 4.0) return 'High Risk';
  if (score >= 3.0) return 'Mild Risk';
  if (score >= 2.0) return 'Low Risk';
  return 'Minimal Risk';
}

function getRiskGrade(score) {
  if (score >= 4.0) return 'D';
  if (score >= 3.0) return 'C';
  if (score >= 2.0) return 'B';
  return 'A';
}

function calculateOverallRisk(riskFactors) {
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

module.exports = riskFactorsController;