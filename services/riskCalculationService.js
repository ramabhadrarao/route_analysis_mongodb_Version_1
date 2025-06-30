// File: services/riskCalculationService.js
// Purpose: Calculate weighted risk scores based on 11 criteria
// Implements the formula: Total Weighted Score = Σ(Risk Score × Weight / 100)

const Route = require('../models/Route');
const RoadCondition = require('../models/RoadCondition');
const AccidentProneArea = require('../models/AccidentProneArea');
const WeatherCondition = require('../models/WeatherCondition');
const TrafficData = require('../models/TrafficData');
const EmergencyService = require('../models/EmergencyService');
const logger = require('../utils/logger');

class RiskCalculationService {
  constructor() {
    // Risk criteria weights as defined in requirements
    this.riskWeights = {
      roadConditions: 15,        // Critical
      accidentProne: 15,         // Critical
      sharpTurns: 10,           // High
      blindSpots: 10,           // High
      twoWayTraffic: 10,        // High
      trafficDensity: 10,       // High
      weatherConditions: 10,    // High
      emergencyServices: 5,     // Medium
      networkCoverage: 5,       // Medium
      amenities: 5,             // Medium
      securityIssues: 5         // Medium
    };
    
    // Risk grade thresholds
    this.gradeThresholds = {
      A: { min: 0, max: 2.0 },    // Low Risk
      B: { min: 2.1, max: 4.0 },  // Low-Medium Risk
      C: { min: 4.1, max: 6.0 },  // Medium Risk
      D: { min: 6.1, max: 8.0 },  // High Risk
      F: { min: 8.1, max: 10.0 }  // Critical Risk
    };
  }

  // Main risk calculation function
  async calculateRouteRisk(routeId) {
    try {
      logger.riskLogger.info(`Starting risk calculation for route: ${routeId}`);
      
      // Calculate individual risk scores
      const riskScores = {
        roadConditions: await this.calculateRoadConditionsRisk(routeId),
        accidentProne: await this.calculateAccidentProneRisk(routeId),
        sharpTurns: await this.calculateSharpTurnsRisk(routeId),
        blindSpots: await this.calculateBlindSpotsRisk(routeId),
        twoWayTraffic: await this.calculateTwoWayTrafficRisk(routeId),
        trafficDensity: await this.calculateTrafficDensityRisk(routeId),
        weatherConditions: await this.calculateWeatherRisk(routeId),
        emergencyServices: await this.calculateEmergencyServicesRisk(routeId),
        networkCoverage: await this.calculateNetworkCoverageRisk(routeId),
        amenities: await this.calculateAmenitiesRisk(routeId),
        securityIssues: await this.calculateSecurityRisk(routeId)
      };

      // Calculate weighted total score
      const totalWeightedScore = this.calculateWeightedScore(riskScores);
      
      // Determine risk grade
      const riskGrade = this.determineRiskGrade(totalWeightedScore);
      
      const result = {
        ...riskScores,
        totalWeightedScore: Math.round(totalWeightedScore * 100) / 100,
        riskGrade,
        calculatedAt: new Date()
      };

      logger.riskLogger.info(`Risk calculation completed for route ${routeId}: Score ${totalWeightedScore}, Grade ${riskGrade}`);
      
      return result;

    } catch (error) {
      logger.riskLogger.error(`Risk calculation failed for route ${routeId}:`, error);
      throw error;
    }
  }

  // 1. Road Conditions Risk (15% weight)
  async calculateRoadConditionsRisk(routeId) {
    try {
      const roadConditions = await RoadCondition.find({ routeId });
      
      if (roadConditions.length === 0) return 5; // Default medium risk
      
      // Calculate average risk score
      const avgRisk = roadConditions.reduce((sum, condition) => {
        let risk = condition.riskScore || 5;
        
        // Adjust risk based on surface quality
        switch (condition.surfaceQuality) {
          case 'critical': risk += 3; break;
          case 'poor': risk += 2; break;
          case 'fair': risk += 1; break;
          case 'good': risk -= 1; break;
          case 'excellent': risk -= 2; break;
        }
        
        // Adjust for potholes
        if (condition.hasPotholes) risk += 2;
        
        // Adjust for construction
        if (condition.underConstruction) risk += 3;
        
        // Adjust for road width
        if (condition.widthMeters && condition.widthMeters < 4) risk += 2;
        
        return sum + Math.max(1, Math.min(10, risk));
      }, 0) / roadConditions.length;
      
      return Math.round(avgRisk * 100) / 100;
      
    } catch (error) {
      logger.riskLogger.error('Road conditions risk calculation failed:', error);
      return 5; // Default risk
    }
  }

  // 2. Accident-Prone Areas Risk (15% weight)
  async calculateAccidentProneRisk(routeId) {
    try {
      const accidentAreas = await AccidentProneArea.find({ routeId });
      
      if (accidentAreas.length === 0) return 3; // Default low-medium risk
      
      // Calculate risk based on accident frequency and severity
      const totalRisk = accidentAreas.reduce((sum, area) => {
        let risk = area.riskScore || 3;
        
        // Adjust based on accident frequency
        if (area.accidentFrequencyYearly > 20) risk += 3;
        else if (area.accidentFrequencyYearly > 10) risk += 2;
        else if (area.accidentFrequencyYearly > 5) risk += 1;
        
        // Adjust based on severity
        switch (area.accidentSeverity) {
          case 'fatal': risk += 4; break;
          case 'major': risk += 2; break;
          case 'minor': risk += 1; break;
        }
        
        return sum + Math.max(1, Math.min(10, risk));
      }, 0);
      
      return Math.round((totalRisk / accidentAreas.length) * 100) / 100;
      
    } catch (error) {
      logger.riskLogger.error('Accident-prone risk calculation failed:', error);
      return 3; // Default risk
    }
  }

  // 3. Sharp Turns Risk (10% weight)
  async calculateSharpTurnsRisk(routeId) {
    try {
      const route = await Route.findById(routeId);
      if (!route || !route.routePoints) return 4;
      
      // Analyze route points for sharp turns
      let sharpTurnCount = 0;
      let totalTurnRisk = 0;
      
      for (let i = 1; i < route.routePoints.length - 1; i++) {
        const prev = route.routePoints[i - 1];
        const curr = route.routePoints[i];
        const next = route.routePoints[i + 1];
        
        // Calculate turn angle (simplified)
        const angle = this.calculateTurnAngle(prev, curr, next);
        
        if (angle > 45) { // Sharp turn threshold
          sharpTurnCount++;
          
          let turnRisk = 5;
          if (angle > 90) turnRisk += 3;  // Very sharp turn
          if (angle > 120) turnRisk += 2; // Hairpin turn
          
          // Consider elevation changes
          if (curr.elevation && prev.elevation) {
            const elevationChange = Math.abs(curr.elevation - prev.elevation);
            if (elevationChange > 50) turnRisk += 2;
          }
          
          totalTurnRisk += turnRisk;
        }
      }
      
      if (sharpTurnCount === 0) return 2; // Low risk for no sharp turns
      
      const avgTurnRisk = totalTurnRisk / sharpTurnCount;
      const densityRisk = Math.min(3, sharpTurnCount / 10); // Risk increases with turn density
      
      return Math.round((avgTurnRisk + densityRisk) * 100) / 100;
      
    } catch (error) {
      logger.riskLogger.error('Sharp turns risk calculation failed:', error);
      return 4; // Default risk
    }
  }

  // 4. Blind Spots Risk (10% weight)
  async calculateBlindSpotsRisk(routeId) {
    try {
      const route = await Route.findById(routeId);
      if (!route || !route.routePoints) return 4;
      
      let blindSpotRisk = 0;
      let riskPoints = 0;
      
      // Analyze elevation changes for hill crests and curves
      for (let i = 1; i < route.routePoints.length - 1; i++) {
        const prev = route.routePoints[i - 1];
        const curr = route.routePoints[i];
        const next = route.routePoints[i + 1];
        
        // Check for hill crests (elevation peaks)
        if (curr.elevation && prev.elevation && next.elevation) {
          if (curr.elevation > prev.elevation && curr.elevation > next.elevation) {
            const elevationDiff = Math.min(
              curr.elevation - prev.elevation,
              curr.elevation - next.elevation
            );
            
            if (elevationDiff > 20) { // Significant hill crest
              blindSpotRisk += 6 + Math.min(3, elevationDiff / 20);
              riskPoints++;
            }
          }
        }
        
        // Check for sharp curves (potential blind spots)
        const turnAngle = this.calculateTurnAngle(prev, curr, next);
        if (turnAngle > 60) {
          blindSpotRisk += 4 + (turnAngle - 60) / 30;
          riskPoints++;
        }
      }
      
      if (riskPoints === 0) return 2; // Low risk for straight, flat roads
      
      return Math.round((blindSpotRisk / riskPoints) * 100) / 100;
      
    } catch (error) {
      logger.riskLogger.error('Blind spots risk calculation failed:', error);
      return 4; // Default risk
    }
  }

  // 5. Two-Way Traffic Risk (10% weight)
  async calculateTwoWayTrafficRisk(routeId) {
    try {
      const route = await Route.findById(routeId);
      if (!route) return 5;
      
      // Estimate based on road type and route characteristics
      let risk = 5; // Base risk for two-way traffic
      
      // Adjust based on terrain
      switch (route.terrain) {
        case 'hilly': risk += 2; break;
        case 'rural': risk += 1; break;
        case 'urban': risk += 1; break;
        case 'flat': risk -= 1; break;
      }
      
      // Adjust based on major highways (assume better infrastructure)
      if (route.majorHighways && route.majorHighways.length > 0) {
        const hasNationalHighway = route.majorHighways.some(hw => hw.startsWith('NH'));
        if (hasNationalHighway) risk -= 2;
      }
      
      // Adjust based on route distance (longer routes = more two-way sections)
      if (route.totalDistance > 200) risk += 1;
      if (route.totalDistance > 500) risk += 1;
      
      return Math.max(1, Math.min(10, Math.round(risk * 100) / 100));
      
    } catch (error) {
      logger.riskLogger.error('Two-way traffic risk calculation failed:', error);
      return 5; // Default risk
    }
  }

  // 6. Traffic Density Risk (10% weight)
  async calculateTrafficDensityRisk(routeId) {
    try {
      const trafficData = await TrafficData.find({ routeId });
      
      if (trafficData.length === 0) return 5; // Default medium risk
      
      const avgRisk = trafficData.reduce((sum, traffic) => {
        let risk = traffic.riskScore || 5;
        
        // Adjust based on congestion level
        switch (traffic.congestionLevel) {
          case 'severe': risk = 9; break;
          case 'heavy': risk = 7; break;
          case 'moderate': risk = 5; break;
          case 'light': risk = 3; break;
          case 'free_flow': risk = 1; break;
        }
        
        // Adjust based on average speed
        if (traffic.averageSpeedKmph < 20) risk += 2;
        else if (traffic.averageSpeedKmph < 40) risk += 1;
        
        return sum + risk;
      }, 0) / trafficData.length;
      
      return Math.round(avgRisk * 100) / 100;
      
    } catch (error) {
      logger.riskLogger.error('Traffic density risk calculation failed:', error);
      return 5; // Default risk
    }
  }

  // 7. Weather Conditions Risk (10% weight)
  async calculateWeatherRisk(routeId) {
    try {
      const weatherConditions = await WeatherCondition.find({ routeId });
      
      if (weatherConditions.length === 0) return 4; // Default risk
      
      const avgRisk = weatherConditions.reduce((sum, weather) => {
        let risk = weather.riskScore || 4;
        
        // Adjust based on weather condition
        switch (weather.weatherCondition) {
          case 'stormy': risk = 9; break;
          case 'foggy': risk = 8; break;
          case 'rainy': risk = 6; break;
          case 'icy': risk = 8; break;
          case 'clear': risk = 2; break;
        }
        
        // Adjust based on visibility
        if (weather.visibilityKm < 1) risk += 3;
        else if (weather.visibilityKm < 5) risk += 2;
        else if (weather.visibilityKm < 10) risk += 1;
        
        // Adjust based on wind speed
        if (weather.windSpeedKmph > 50) risk += 2;
        else if (weather.windSpeedKmph > 30) risk += 1;
        
        // Adjust based on road surface condition
        switch (weather.roadSurfaceCondition) {
          case 'icy': risk += 3; break;
          case 'wet': risk += 2; break;
          case 'muddy': risk += 2; break;
        }
        
        return sum + Math.max(1, Math.min(10, risk));
      }, 0) / weatherConditions.length;
      
      return Math.round(avgRisk * 100) / 100;
      
    } catch (error) {
      logger.riskLogger.error('Weather risk calculation failed:', error);
      return 4; // Default risk
    }
  }

  // 8. Emergency Services Risk (5% weight - inverted: more services = lower risk)
  async calculateEmergencyServicesRisk(routeId) {
    try {
      const emergencyServices = await EmergencyService.find({ routeId });
      
      if (emergencyServices.length === 0) return 8; // High risk for no services
      
      // Calculate coverage score by service type
      const serviceTypes = ['hospital', 'police', 'fire_station'];
      let totalCoverage = 0;
      
      for (const serviceType of serviceTypes) {
        const servicesOfType = emergencyServices.filter(s => s.serviceType === serviceType);
        
        if (servicesOfType.length === 0) {
          totalCoverage += 8; // High risk for missing service type
        } else {
          // Find closest service of this type
          const closestService = servicesOfType.reduce((closest, current) => 
            current.distanceFromRouteKm < closest.distanceFromRouteKm ? current : closest
          );
          
          let serviceRisk = 2; // Base low risk
          
          // Adjust based on distance
          if (closestService.distanceFromRouteKm > 50) serviceRisk += 4;
          else if (closestService.distanceFromRouteKm > 25) serviceRisk += 2;
          else if (closestService.distanceFromRouteKm > 10) serviceRisk += 1;
          
          // Adjust based on response time
          if (closestService.responseTimeMinutes > 30) serviceRisk += 2;
          else if (closestService.responseTimeMinutes > 15) serviceRisk += 1;
          
          // Adjust based on availability score
          serviceRisk += (10 - closestService.availabilityScore) / 2;
          
          totalCoverage += serviceRisk;
        }
      }
      
      return Math.round((totalCoverage / serviceTypes.length) * 100) / 100;
      
    } catch (error) {
      logger.riskLogger.error('Emergency services risk calculation failed:', error);
      return 6; // Default risk
    }
  }

  // 9. Network Coverage Risk (5% weight)
  async calculateNetworkCoverageRisk(routeId) {
    try {
      // This would be implemented when network coverage data is available
      // For now, return default based on route terrain
      const route = await Route.findById(routeId);
      
      let risk = 4; // Default risk
      
      if (route) {
        switch (route.terrain) {
          case 'rural': risk = 7; break;
          case 'hilly': risk = 6; break;
          case 'urban': risk = 2; break;
          case 'flat': risk = 3; break;
        }
      }
      
      return risk;
      
    } catch (error) {
      logger.riskLogger.error('Network coverage risk calculation failed:', error);
      return 5; // Default risk
    }
  }

  // 10. Amenities Risk (5% weight - inverted: more amenities = lower risk)
  async calculateAmenitiesRisk(routeId) {
    try {
      // This would be implemented when amenities data is available
      // For now, return default based on route characteristics
      const route = await Route.findById(routeId);
      
      let risk = 6; // Default medium-high risk
      
      if (route) {
        // Assume major highways have better amenities
        if (route.majorHighways && route.majorHighways.length > 0) {
          risk -= 2;
        }
        
        // Urban areas typically have more amenities
        if (route.terrain === 'urban') risk -= 2;
        if (route.terrain === 'rural') risk += 2;
      }
      
      return Math.max(1, Math.min(10, risk));
      
    } catch (error) {
      logger.riskLogger.error('Amenities risk calculation failed:', error);
      return 6; // Default risk
    }
  }

  // 11. Security Issues Risk (5% weight)
  async calculateSecurityRisk(routeId) {
    try {
      // This would integrate with news APIs and crime data
      // For now, return default based on route characteristics
      const route = await Route.findById(routeId);
      
      let risk = 4; // Default low-medium risk
      
      if (route) {
        // Rural areas might have higher security risks
        if (route.terrain === 'rural') risk += 2;
        if (route.terrain === 'urban') risk += 1; // Urban crime
        
        // Night travel considerations (if this data is available)
        // Longer routes have more exposure
        if (route.totalDistance > 300) risk += 1;
      }
      
      return Math.max(1, Math.min(10, risk));
      
    } catch (error) {
      logger.riskLogger.error('Security risk calculation failed:', error);
      return 4; // Default risk
    }
  }

  // Calculate weighted total score
  calculateWeightedScore(riskScores) {
    let totalScore = 0;
    
    for (const [criterion, score] of Object.entries(riskScores)) {
      if (this.riskWeights[criterion]) {
        totalScore += (score * this.riskWeights[criterion]) / 100;
      }
    }
    
    return totalScore;
  }

  // Determine risk grade based on total score
  determineRiskGrade(totalScore) {
    for (const [grade, threshold] of Object.entries(this.gradeThresholds)) {
      if (totalScore >= threshold.min && totalScore <= threshold.max) {
        return grade;
      }
    }
    return 'F'; // Default to highest risk
  }

  // Helper function to calculate turn angle between three points
  calculateTurnAngle(p1, p2, p3) {
    // Simplified turn angle calculation
    const dx1 = p2.longitude - p1.longitude;
    const dy1 = p2.latitude - p1.latitude;
    const dx2 = p3.longitude - p2.longitude;
    const dy2 = p3.latitude - p2.latitude;
    
    const angle1 = Math.atan2(dy1, dx1);
    const angle2 = Math.atan2(dy2, dx2);
    
    let turnAngle = Math.abs(angle2 - angle1) * (180 / Math.PI);
    if (turnAngle > 180) turnAngle = 360 - turnAngle;
    
    return turnAngle;
  }

  // Get risk explanation for a given score
  getRiskExplanation(riskGrade, totalScore) {
    const explanations = {
      A: 'Low Risk - Route is generally safe with minimal hazards',
      B: 'Low-Medium Risk - Route has some minor risk factors',
      C: 'Medium Risk - Route requires normal caution and attention',
      D: 'High Risk - Route has significant hazards requiring extra precaution',
      F: 'Critical Risk - Route has severe hazards, consider alternative routes'
    };
    
    return {
      grade: riskGrade,
      score: totalScore,
      explanation: explanations[riskGrade] || 'Risk assessment unavailable',
      recommendations: this.getRecommendations(riskGrade, totalScore)
    };
  }

  // Get recommendations based on risk level
  getRecommendations(riskGrade, totalScore) {
    const recommendations = [];
    
    switch (riskGrade) {
      case 'A':
        recommendations.push('Maintain normal driving practices');
        recommendations.push('Follow standard safety protocols');
        break;
      case 'B':
        recommendations.push('Exercise normal caution');
        recommendations.push('Monitor weather conditions');
        break;
      case 'C':
        recommendations.push('Increase following distance');
        recommendations.push('Check weather and traffic conditions');
        recommendations.push('Ensure emergency kit is complete');
        break;
      case 'D':
        recommendations.push('Consider alternative routes if possible');
        recommendations.push('Travel during daylight hours when possible');
        recommendations.push('Maintain constant communication with control room');
        recommendations.push('Reduce speed and increase safety margins');
        break;
      case 'F':
        recommendations.push('CRITICAL: Consider postponing travel if possible');
        recommendations.push('If travel is necessary, arrange escort vehicles');
        recommendations.push('Maintain constant GPS tracking and communication');
        recommendations.push('Brief all drivers on specific hazards');
        recommendations.push('Carry extra emergency supplies');
        break;
    }
    
    return recommendations;
  }
}

module.exports = new RiskCalculationService();