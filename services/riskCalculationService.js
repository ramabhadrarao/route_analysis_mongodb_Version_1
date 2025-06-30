// File: services/riskCalculationService.js - Enhanced Version
// Purpose: Enhanced risk calculation with comprehensive data integration
// Integrates with enhanced data collection service for accurate risk assessment

const Route = require('../models/Route');
const RoadCondition = require('../models/RoadCondition');
const { AccidentProneArea, WeatherCondition, TrafficData } = require('../models/EnhancedModels');
const EmergencyService = require('../models/EmergencyService');
const logger = require('../utils/logger');

class EnhancedRiskCalculationService {
  constructor() {
    // Enhanced risk criteria weights based on comprehensive data
    this.riskWeights = {
      roadConditions: 15,           // Critical - Based on enhanced road condition data
      accidentProne: 15,            // Critical - Based on comprehensive accident analysis
      sharpTurns: 10,              // High - GPS-based turn analysis
      blindSpots: 10,              // High - Elevation and visibility analysis
      twoWayTraffic: 10,           // High - Route type analysis
      trafficDensity: 10,          // High - Real-time traffic data
      weatherConditions: 10,       // High - Comprehensive weather analysis
      emergencyServices: 5,        // Medium - Enhanced emergency service coverage
      networkCoverage: 5,          // Medium - Communication infrastructure
      amenities: 5,                // Medium - Food, fuel, rest facilities
      securityIssues: 5            // Medium - Security and crime analysis
    };
    
    // Enhanced risk grade thresholds
    this.gradeThresholds = {
      A: { min: 0, max: 2.0, level: 'Very Low Risk', color: '#28a745' },
      B: { min: 2.1, max: 4.0, level: 'Low Risk', color: '#20c997' },
      C: { min: 4.1, max: 6.0, level: 'Medium Risk', color: '#ffc107' },
      D: { min: 6.1, max: 8.0, level: 'High Risk', color: '#fd7e14' },
      F: { min: 8.1, max: 10.0, level: 'Critical Risk', color: '#dc3545' }
    };
  }

  // Main enhanced risk calculation function
  async calculateRouteRisk(routeId) {
    try {
      logger.riskLogger.info(`Starting enhanced risk calculation for route: ${routeId}`);
      
      const route = await Route.findById(routeId);
      if (!route) {
        throw new Error('Route not found');
      }

      // Calculate individual risk scores with enhanced data
      const riskScores = {
        roadConditions: await this.calculateEnhancedRoadConditionsRisk(routeId),
        accidentProne: await this.calculateEnhancedAccidentProneRisk(routeId),
        sharpTurns: await this.calculateEnhancedSharpTurnsRisk(routeId),
        blindSpots: await this.calculateEnhancedBlindSpotsRisk(routeId),
        twoWayTraffic: await this.calculateEnhancedTwoWayTrafficRisk(routeId),
        trafficDensity: await this.calculateEnhancedTrafficDensityRisk(routeId),
        weatherConditions: await this.calculateEnhancedWeatherRisk(routeId),
        emergencyServices: await this.calculateEnhancedEmergencyServicesRisk(routeId),
        networkCoverage: await this.calculateEnhancedNetworkCoverageRisk(routeId),
        amenities: await this.calculateEnhancedAmenitiesRisk(routeId),
        securityIssues: await this.calculateEnhancedSecurityRisk(routeId)
      };

      // Calculate weighted total score
      const totalWeightedScore = this.calculateWeightedScore(riskScores);
      
      // Determine risk grade and level
      const riskGrade = this.determineRiskGrade(totalWeightedScore);
      const riskLevel = this.determineRiskLevel(totalWeightedScore);
      
      // Generate comprehensive risk explanation
      const riskExplanation = this.generateEnhancedRiskExplanation(riskScores, totalWeightedScore, riskGrade);
      
      const result = {
        ...riskScores,
        totalWeightedScore: Math.round(totalWeightedScore * 100) / 100,
        riskGrade,
        riskLevel,
        riskExplanation,
        topRiskFactors: this.identifyTopRiskFactors(riskScores),
        safetyRecommendations: this.generateComprehensiveSafetyRecommendations(riskScores, totalWeightedScore),
        calculatedAt: new Date(),
        dataQuality: await this.assessDataQuality(routeId),
        confidenceLevel: this.calculateConfidenceLevel(routeId)
      };

      // Update route with comprehensive risk assessment
      await Route.findByIdAndUpdate(routeId, {
        riskScores: result,
        riskLevel: riskLevel,
        'metadata.lastCalculated': new Date(),
        'metadata.riskVersion': '2.0'
      });

      logger.riskLogger.info(`Enhanced risk calculation completed for route ${routeId}: Score ${totalWeightedScore}, Grade ${riskGrade}, Level ${riskLevel}`);
      
      return result;

    } catch (error) {
      logger.riskLogger.error(`Enhanced risk calculation failed for route ${routeId}:`, error);
      throw error;
    }
  }

  // 1. ENHANCED ROAD CONDITIONS RISK
  async calculateEnhancedRoadConditionsRisk(routeId) {
    try {
      const roadConditions = await RoadCondition.find({ routeId });
      
      if (roadConditions.length === 0) return 5;
      
      let totalRisk = 0;
      let weightedPoints = 0;
      
      for (const condition of roadConditions) {
        let segmentRisk = condition.riskScore || 5;
        let weight = 1;
        
        // Enhanced risk factors
        const riskFactors = {
          surfaceQuality: {
            'critical': 4, 'poor': 3, 'fair': 1, 'good': -1, 'excellent': -2
          },
          maintenance: {
            potholes: condition.hasPotholes ? 2 : 0,
            construction: condition.underConstruction ? 3 : 0
          },
          infrastructure: {
            narrowWidth: (condition.widthMeters && condition.widthMeters < 4) ? 2 : 0,
            noShoulder: (condition.shoulderWidth && condition.shoulderWidth < 1) ? 1 : 0,
            poorLighting: (condition.lightingQuality === 'poor') ? 2 : 0,
            poorDrainage: (condition.drainageQuality === 'poor') ? 1 : 0
          },
          environmental: {
            bridges: (condition.bridgesCulverts || 0) * 0.5,
            steepSlope: (condition.slopeGradient > 6) ? 2 : 0
          }
        };
        
        // Apply risk factors
        segmentRisk += riskFactors.surfaceQuality[condition.surfaceQuality] || 0;
        segmentRisk += riskFactors.maintenance.potholes + riskFactors.maintenance.construction;
        segmentRisk += riskFactors.infrastructure.narrowWidth + riskFactors.infrastructure.noShoulder;
        segmentRisk += riskFactors.infrastructure.poorLighting + riskFactors.infrastructure.poorDrainage;
        segmentRisk += riskFactors.environmental.bridges + riskFactors.environmental.steepSlope;
        
        // Weight by distance (longer segments have more impact)
        if (condition.distanceFromStartKm !== undefined) {
          weight = Math.max(0.5, Math.min(2, condition.segmentLength || 1));
        }
        
        totalRisk += Math.max(1, Math.min(10, segmentRisk)) * weight;
        weightedPoints += weight;
      }
      
      return Math.round((totalRisk / weightedPoints) * 100) / 100;
      
    } catch (error) {
      logger.riskLogger.error('Enhanced road conditions risk calculation failed:', error);
      return 5;
    }
  }

  // 2. ENHANCED ACCIDENT-PRONE AREAS RISK
  async calculateEnhancedAccidentProneRisk(routeId) {
    try {
      const accidentAreas = await AccidentProneArea.find({ routeId });
      
      if (accidentAreas.length === 0) return 3;
      
      let totalRisk = 0;
      let riskAreaCount = 0;
      
      for (const area of accidentAreas) {
        let areaRisk = area.riskScore || 5;
        
        // Enhanced accident risk factors
        const enhancedFactors = {
          frequency: {
            veryHigh: area.accidentFrequencyYearly > 20 ? 3 : 0,
            high: area.accidentFrequencyYearly > 10 ? 2 : 0,
            medium: area.accidentFrequencyYearly > 5 ? 1 : 0
          },
          severity: {
            fatal: area.accidentSeverity === 'fatal' ? 4 : 0,
            major: area.accidentSeverity === 'major' ? 2 : 0,
            minor: area.accidentSeverity === 'minor' ? 1 : 0
          },
          timeRisk: {
            night: (area.timeOfDayRisk?.night || 5) > 7 ? 2 : 0,
            peak: (area.timeOfDayRisk?.peak || 5) > 7 ? 1 : 0
          },
          environmental: {
            weather: (area.weatherRelatedRisk || 5) > 6 ? 2 : 0,
            infrastructure: (area.infrastructureRisk || 5) > 6 ? 1 : 0,
            traffic: (area.trafficVolumeRisk || 5) > 6 ? 1 : 0
          },
          trend: {
            increasing: area.accidentTrend === 'increasing' ? 2 : 0,
            stable: area.accidentTrend === 'stable' ? 0 : 0,
            decreasing: area.accidentTrend === 'decreasing' ? -1 : 0
          }
        };
        
        // Apply enhanced factors
        areaRisk += Math.max(enhancedFactors.frequency.veryHigh, enhancedFactors.frequency.high, enhancedFactors.frequency.medium);
        areaRisk += Math.max(enhancedFactors.severity.fatal, enhancedFactors.severity.major, enhancedFactors.severity.minor);
        areaRisk += enhancedFactors.timeRisk.night + enhancedFactors.timeRisk.peak;
        areaRisk += enhancedFactors.environmental.weather + enhancedFactors.environmental.infrastructure + enhancedFactors.environmental.traffic;
        areaRisk += enhancedFactors.trend.increasing + enhancedFactors.trend.stable + enhancedFactors.trend.decreasing;
        
        totalRisk += Math.max(1, Math.min(10, areaRisk));
        riskAreaCount++;
      }
      
      return riskAreaCount > 0 ? Math.round((totalRisk / riskAreaCount) * 100) / 100 : 3;
      
    } catch (error) {
      logger.riskLogger.error('Enhanced accident-prone risk calculation failed:', error);
      return 3;
    }
  }

  // 3. ENHANCED TRAFFIC DENSITY RISK
  async calculateEnhancedTrafficDensityRisk(routeId) {
    try {
      const trafficData = await TrafficData.find({ routeId });
      
      if (trafficData.length === 0) return 5;
      
      let totalRisk = 0;
      let dataPoints = 0;
      
      for (const traffic of trafficData) {
        let trafficRisk = traffic.riskScore || 5;
        
        // Enhanced traffic risk factors
        const enhancedFactors = {
          congestion: {
            severe: traffic.congestionLevel === 'severe' ? 4 : 0,
            heavy: traffic.congestionLevel === 'heavy' ? 3 : 0,
            moderate: traffic.congestionLevel === 'moderate' ? 1 : 0,
            light: traffic.congestionLevel === 'light' ? 0 : 0,
            free_flow: traffic.congestionLevel === 'free_flow' ? -1 : 0
          },
          speed: {
            crawling: traffic.averageSpeedKmph < 20 ? 3 : 0,
            slow: traffic.averageSpeedKmph < 40 ? 2 : 0,
            normal: traffic.averageSpeedKmph >= 40 ? 0 : 0
          },
          infrastructure: {
            tollPoints: (traffic.tollPoints || 0) * 1,
            construction: (traffic.constructionZones || 0) * 2,
            trafficLights: (traffic.trafficLights || 0) * 0.5
          },
          incidents: {
            accidents: (traffic.accidentReports || 0) * 2,
            weatherImpact: traffic.weatherImpact === 'severe' ? 2 : 
                          traffic.weatherImpact === 'moderate' ? 1 : 0
          },
          timing: {
            peak: traffic.timeOfDay === 'morning_peak' || traffic.timeOfDay === 'evening_peak' ? 1 : 0
          }
        };
        
        // Apply enhanced factors
        trafficRisk += Math.max(...Object.values(enhancedFactors.congestion));
        trafficRisk += Math.max(...Object.values(enhancedFactors.speed));
        trafficRisk += enhancedFactors.infrastructure.tollPoints + enhancedFactors.infrastructure.construction + enhancedFactors.infrastructure.trafficLights;
        trafficRisk += enhancedFactors.incidents.accidents + enhancedFactors.incidents.weatherImpact;
        trafficRisk += enhancedFactors.timing.peak;
        
        totalRisk += Math.max(1, Math.min(10, trafficRisk));
        dataPoints++;
      }
      
      return dataPoints > 0 ? Math.round((totalRisk / dataPoints) * 100) / 100 : 5;
      
    } catch (error) {
      logger.riskLogger.error('Enhanced traffic density risk calculation failed:', error);
      return 5;
    }
  }

  // 4. ENHANCED WEATHER CONDITIONS RISK
  async calculateEnhancedWeatherRisk(routeId) {
    try {
      const weatherConditions = await WeatherCondition.find({ routeId });
      
      if (weatherConditions.length === 0) return 4;
      
      let totalRisk = 0;
      let dataPoints = 0;
      
      for (const weather of weatherConditions) {
        let weatherRisk = weather.riskScore || 4;
        
        // Enhanced weather risk factors
        const enhancedFactors = {
          condition: {
            stormy: weather.weatherCondition === 'stormy' ? 4 : 0,
            foggy: weather.weatherCondition === 'foggy' ? 3 : 0,
            rainy: weather.weatherCondition === 'rainy' ? 2 : 0,
            icy: weather.weatherCondition === 'icy' ? 4 : 0,
            clear: weather.weatherCondition === 'clear' ? -1 : 0
          },
          visibility: {
            veryPoor: (weather.visibilityKm || 10) < 1 ? 4 : 0,
            poor: (weather.visibilityKm || 10) < 5 ? 3 : 0,
            limited: (weather.visibilityKm || 10) < 10 ? 1 : 0
          },
          wind: {
            extreme: (weather.windSpeedKmph || 0) > 70 ? 3 : 0,
            high: (weather.windSpeedKmph || 0) > 50 ? 2 : 0,
            moderate: (weather.windSpeedKmph || 0) > 30 ? 1 : 0
          },
          surface: {
            icy: weather.roadSurfaceCondition === 'icy' ? 4 : 0,
            muddy: weather.roadSurfaceCondition === 'muddy' ? 2 : 0,
            wet: weather.roadSurfaceCondition === 'wet' ? 1 : 0
          },
          seasonal: {
            monsoon: weather.monsoonRisk > 7 ? 2 : 0,
            extreme: (weather.extremeWeatherHistory || []).length > 2 ? 1 : 0
          },
          temperature: {
            extreme: (weather.averageTemperature < 5 || weather.averageTemperature > 45) ? 2 : 0,
            uncomfortable: (weather.averageTemperature < 10 || weather.averageTemperature > 40) ? 1 : 0
          }
        };
        
        // Apply enhanced factors
        weatherRisk += Math.max(...Object.values(enhancedFactors.condition));
        weatherRisk += Math.max(...Object.values(enhancedFactors.visibility));
        weatherRisk += Math.max(...Object.values(enhancedFactors.wind));
        weatherRisk += Math.max(...Object.values(enhancedFactors.surface));
        weatherRisk += enhancedFactors.seasonal.monsoon + enhancedFactors.seasonal.extreme;
        weatherRisk += Math.max(...Object.values(enhancedFactors.temperature));
        
        totalRisk += Math.max(1, Math.min(10, weatherRisk));
        dataPoints++;
      }
      
      return dataPoints > 0 ? Math.round((totalRisk / dataPoints) * 100) / 100 : 4;
      
    } catch (error) {
      logger.riskLogger.error('Enhanced weather risk calculation failed:', error);
      return 4;
    }
  }

  // 5. ENHANCED EMERGENCY SERVICES RISK
 // File: services/riskCalculationService.js - Part 2 (Continuation)
// Purpose: Enhanced risk calculation - Emergency Services and Additional Methods

  // 5. ENHANCED EMERGENCY SERVICES RISK
  async calculateEnhancedEmergencyServicesRisk(routeId) {
    try {
      const emergencyServices = await EmergencyService.find({ routeId });
      
      if (emergencyServices.length === 0) return 8; // High risk for no services
      
      // Categorize services by type
      const servicesByType = {
        hospital: emergencyServices.filter(s => s.serviceType === 'hospital'),
        police: emergencyServices.filter(s => s.serviceType === 'police'),
        fire_station: emergencyServices.filter(s => s.serviceType === 'fire_station'),
        fuel: emergencyServices.filter(s => s.serviceType === 'mechanic')
      };
      
      let totalRisk = 0;
      let riskFactors = [];
      
      // Assess each service type
      for (const [serviceType, services] of Object.entries(servicesByType)) {
        let serviceRisk = 8; // Default high risk
        
        if (services.length === 0) {
          riskFactors.push({ type: serviceType, risk: 8, reason: 'No services available' });
          continue;
        }
        
        // Find best service of this type
        const bestService = services.reduce((best, current) => {
          const bestScore = this.calculateServiceScore(best);
          const currentScore = this.calculateServiceScore(current);
          return currentScore > bestScore ? current : best;
        });
        
        // Calculate risk based on best available service
        serviceRisk = this.calculateServiceRisk(bestService, serviceType);
        riskFactors.push({ 
          type: serviceType, 
          risk: serviceRisk, 
          service: bestService.name,
          distance: bestService.distanceFromRouteKm,
          responseTime: bestService.responseTimeMinutes
        });
        
        totalRisk += serviceRisk;
      }
      
      const avgRisk = totalRisk / Object.keys(servicesByType).length;
      
      // Apply coverage bonus/penalty
      const coverageBonus = this.calculateCoverageBonus(emergencyServices);
      const finalRisk = Math.max(1, Math.min(10, avgRisk - coverageBonus));
      
      return {
        riskScore: Math.round(finalRisk * 100) / 100,
        breakdown: riskFactors,
        coverage: this.assessServiceCoverage(emergencyServices),
        recommendations: this.generateServiceRecommendations(riskFactors)
      };
      
    } catch (error) {
      logger.riskLogger.error('Enhanced emergency services risk calculation failed:', error);
      return 6;
    }
  }

  // 6. ENHANCED NETWORK COVERAGE RISK
  async calculateEnhancedNetworkCoverageRisk(routeId) {
    try {
      const route = await Route.findById(routeId);
      if (!route) return 5;
      
      let networkRisk = 4; // Base risk
      const riskFactors = [];
      
      // Terrain-based risk assessment
      const terrainRisk = {
        'urban': { risk: 2, factor: 'Urban area - excellent coverage' },
        'rural': { risk: 6, factor: 'Rural area - limited coverage' },
        'hilly': { risk: 8, factor: 'Hilly terrain - poor coverage' },
        'mixed': { risk: 5, factor: 'Mixed terrain - variable coverage' }
      };
      
      const terrainFactor = terrainRisk[route.terrain] || terrainRisk.mixed;
      networkRisk = terrainFactor.risk;
      riskFactors.push(terrainFactor);
      
      // Distance factor
      if (route.totalDistance > 300) {
        networkRisk += 1;
        riskFactors.push({ risk: 1, factor: 'Long route increases dead zone probability' });
      }
      
      // Route type factor
      if (route.majorHighways && route.majorHighways.length > 0) {
        const hasNationalHighway = route.majorHighways.some(hw => hw.startsWith('NH'));
        if (hasNationalHighway) {
          networkRisk -= 1;
          riskFactors.push({ risk: -1, factor: 'National highway - better tower coverage' });
        }
      }
      
      // Estimated dead zones
      const deadZones = Math.floor(route.totalDistance / (route.terrain === 'hilly' ? 30 : 50));
      if (deadZones > 3) {
        networkRisk += 1;
        riskFactors.push({ risk: 1, factor: `${deadZones} estimated dead zones` });
      }
      
      const finalRisk = Math.max(1, Math.min(10, networkRisk));
      
      return {
        riskScore: finalRisk,
        breakdown: riskFactors,
        estimatedDeadZones: deadZones,
        coverage: this.assessNetworkCoverage(route),
        alternatives: this.getAlternativeCommunicationMethods()
      };
      
    } catch (error) {
      logger.riskLogger.error('Enhanced network coverage risk calculation failed:', error);
      return 5;
    }
  }

  // 7. ENHANCED AMENITIES RISK
  async calculateEnhancedAmenitiesRisk(routeId) {
    try {
      const amenityServices = await EmergencyService.find({ 
        routeId, 
        serviceType: { $in: ['amenity', 'mechanic'] }
      });
      
      const route = await Route.findById(routeId);
      let amenityRisk = 6; // Default medium-high risk
      const riskFactors = [];
      
      // Categorize amenities
      const amenityTypes = {
        fuel: amenityServices.filter(s => s.name.toLowerCase().includes('gas') || 
                                          s.name.toLowerCase().includes('petrol') ||
                                          s.fuelTypes?.length > 0),
        food: amenityServices.filter(s => s.name.toLowerCase().includes('restaurant') ||
                                          s.name.toLowerCase().includes('dhaba') ||
                                          s.stopType === 'restaurant'),
        rest: amenityServices.filter(s => s.name.toLowerCase().includes('hotel') ||
                                          s.name.toLowerCase().includes('lodge') ||
                                          s.stopType === 'lodging'),
        financial: amenityServices.filter(s => s.name.toLowerCase().includes('atm') ||
                                               s.name.toLowerCase().includes('bank')),
        repair: amenityServices.filter(s => s.name.toLowerCase().includes('repair') ||
                                            s.name.toLowerCase().includes('mechanic'))
      };
      
      // Assess each amenity type
      for (const [type, services] of Object.entries(amenityTypes)) {
        const typeRisk = this.calculateAmenityTypeRisk(services, type, route);
        riskFactors.push({
          type,
          risk: typeRisk.risk,
          count: services.length,
          coverage: typeRisk.coverage,
          nearestDistance: typeRisk.nearestDistance
        });
        amenityRisk += typeRisk.risk - 5; // Adjust from base risk
      }
      
      // Route characteristics bonus/penalty
      if (route.majorHighways && route.majorHighways.length > 0) {
        amenityRisk -= 1;
        riskFactors.push({ type: 'highway', risk: -1, factor: 'Highway route - better amenities' });
      }
      
      if (route.terrain === 'rural') {
        amenityRisk += 2;
        riskFactors.push({ type: 'terrain', risk: 2, factor: 'Rural terrain - limited amenities' });
      }
      
      const finalRisk = Math.max(1, Math.min(10, amenityRisk));
      
      return {
        riskScore: finalRisk,
        breakdown: riskFactors,
        coverage: this.assessAmenityCoverage(amenityTypes, route),
        recommendations: this.generateAmenityRecommendations(riskFactors)
      };
      
    } catch (error) {
      logger.riskLogger.error('Enhanced amenities risk calculation failed:', error);
      return 6;
    }
  }

  // 8. ENHANCED SECURITY RISK
  async calculateEnhancedSecurityRisk(routeId) {
    try {
      const route = await Route.findById(routeId);
      if (!route) return 4;
      
      let securityRisk = 4; // Base risk
      const riskFactors = [];
      
      // Terrain-based security assessment
      const terrainSecurity = {
        'rural': { risk: 2, factor: 'Rural areas - isolation risk' },
        'urban': { risk: 1, factor: 'Urban areas - crime risk' },
        'hilly': { risk: 1, factor: 'Hilly terrain - isolation risk' },
        'mixed': { risk: 1, factor: 'Mixed terrain - variable security' }
      };
      
      if (terrainSecurity[route.terrain]) {
        securityRisk += terrainSecurity[route.terrain].risk;
        riskFactors.push(terrainSecurity[route.terrain]);
      }
      
      // Distance factor
      if (route.totalDistance > 300) {
        securityRisk += 1;
        riskFactors.push({ risk: 1, factor: 'Long distance increases exposure' });
      }
      
      // Night travel risk
      const nightRisk = this.assessNightTravelRisk(route);
      if (nightRisk.risk > 6) {
        securityRisk += 1;
        riskFactors.push({ risk: 1, factor: 'High night travel risk' });
      }
      
      // Police presence assessment
      const policeServices = await EmergencyService.find({ 
        routeId, 
        serviceType: 'police' 
      });
      
      if (policeServices.length === 0) {
        securityRisk += 2;
        riskFactors.push({ risk: 2, factor: 'No police stations identified' });
      } else {
        const avgPoliceDistance = policeServices.reduce((sum, s) => sum + s.distanceFromRouteKm, 0) / policeServices.length;
        if (avgPoliceDistance > 30) {
          securityRisk += 1;
          riskFactors.push({ risk: 1, factor: 'Police stations far from route' });
        }
      }
      
      const finalRisk = Math.max(1, Math.min(10, securityRisk));
      
      return {
        riskScore: finalRisk,
        breakdown: riskFactors,
        nightTravelRisk: nightRisk,
        securityMeasures: this.getSecurityMeasures(route),
        recommendations: this.generateSecurityRecommendations(finalRisk, route)
      };
      
    } catch (error) {
      logger.riskLogger.error('Enhanced security risk calculation failed:', error);
      return 4;
    }
  }

  // HELPER METHODS FOR ENHANCED CALCULATIONS

  calculateServiceScore(service) {
    let score = 0;
    
    // Distance score (closer is better)
    const distance = service.distanceFromRouteKm || 50;
    score += Math.max(0, 10 - (distance / 5));
    
    // Availability score
    score += service.availabilityScore || 5;
    
    // Response time score
    const responseTime = service.responseTimeMinutes || 30;
    score += Math.max(0, 10 - (responseTime / 3));
    
    // 24/7 bonus
    if (service.isOpen24Hours) score += 2;
    
    // Rating bonus
    if (service.rating) score += service.rating;
    
    return score;
  }

  calculateServiceRisk(service, serviceType) {
    let risk = 2; // Base low risk for available service
    
    // Distance penalty
    const distance = service.distanceFromRouteKm || 0;
    if (distance > 50) risk += 4;
    else if (distance > 25) risk += 2;
    else if (distance > 10) risk += 1;
    
    // Response time penalty
    const responseTime = service.responseTimeMinutes || 15;
    if (responseTime > 60) risk += 3;
    else if (responseTime > 30) risk += 2;
    else if (responseTime > 15) risk += 1;
    
    // Availability penalty
    const availability = service.availabilityScore || 5;
    if (availability < 5) risk += 2;
    else if (availability < 7) risk += 1;
    
    // Service type specific factors
    if (serviceType === 'hospital' && distance > 30) risk += 1;
    if (serviceType === 'police' && responseTime > 20) risk += 1;
    if (serviceType === 'fire_station' && distance > 25) risk += 1;
    
    return Math.max(1, Math.min(10, risk));
  }

  calculateCoverageBonus(services) {
    let bonus = 0;
    
    // High service density bonus
    if (services.length > 20) bonus += 1;
    else if (services.length > 10) bonus += 0.5;
    
    // 24/7 services bonus
    const h24Services = services.filter(s => s.isOpen24Hours).length;
    if (h24Services > 5) bonus += 1;
    else if (h24Services > 2) bonus += 0.5;
    
    // High rating services bonus
    const highRatedServices = services.filter(s => (s.rating || 0) > 4).length;
    if (highRatedServices > 5) bonus += 0.5;
    
    return bonus;
  }

  assessServiceCoverage(services) {
    const totalServices = services.length;
    const avgDistance = totalServices > 0 ? 
      services.reduce((sum, s) => sum + s.distanceFromRouteKm, 0) / totalServices : 50;
    
    let coverage = 'poor';
    if (totalServices > 15 && avgDistance < 20) coverage = 'excellent';
    else if (totalServices > 10 && avgDistance < 30) coverage = 'good';
    else if (totalServices > 5 && avgDistance < 40) coverage = 'fair';
    
    return {
      level: coverage,
      totalServices,
      averageDistance: Math.round(avgDistance * 100) / 100,
      serviceTypes: [...new Set(services.map(s => s.serviceType))].length
    };
  }

  calculateAmenityTypeRisk(services, type, route) {
    let risk = 8; // Default high risk
    let nearestDistance = 100;
    
    if (services.length === 0) {
      return { risk: 8, coverage: 'none', nearestDistance: 'N/A' };
    }
    
    // Find nearest service
    nearestDistance = Math.min(...services.map(s => s.distanceFromRouteKm || 50));
    
    // Calculate risk based on availability and distance
    if (services.length >= 3 && nearestDistance < 15) {
      risk = 2; // Low risk
    } else if (services.length >= 2 && nearestDistance < 25) {
      risk = 4; // Medium risk
    } else if (services.length >= 1 && nearestDistance < 40) {
      risk = 6; // Medium-high risk
    }
    
    // Type-specific adjustments
    if (type === 'fuel' && nearestDistance > 50) risk += 2;
    if (type === 'food' && nearestDistance > 30) risk += 1;
    if (type === 'repair' && services.length === 0) risk = 9;
    
    const coverage = risk <= 3 ? 'excellent' : 
                    risk <= 5 ? 'good' : 
                    risk <= 7 ? 'fair' : 'poor';
    
    return {
      risk: Math.max(1, Math.min(10, risk)),
      coverage,
      nearestDistance: Math.round(nearestDistance * 100) / 100
    };
  }

  assessNightTravelRisk(route) {
    let nightRisk = 5; // Base risk
    
    if (route.terrain === 'rural') nightRisk += 2;
    if (route.terrain === 'hilly') nightRisk += 1;
    if (route.terrain === 'urban') nightRisk -= 1;
    if (route.totalDistance > 200) nightRisk += 1;
    
    return {
      risk: Math.max(1, Math.min(10, nightRisk)),
      level: nightRisk > 7 ? 'high' : nightRisk > 5 ? 'medium' : 'low',
      recommendations: nightRisk > 6 ? 
        ['Avoid night travel if possible', 'Use convoy travel', 'Maintain constant communication'] :
        ['Normal night precautions', 'Keep emergency contacts ready']
    };
  }

  // ADDITIONAL HELPER METHODS

  identifyTopRiskFactors(riskScores) {
    return Object.entries(riskScores)
      .filter(([key, value]) => key !== 'totalWeightedScore' && key !== 'riskGrade' && key !== 'calculatedAt')
      .map(([key, value]) => ({
        factor: key,
        score: typeof value === 'object' ? value.riskScore || value : value,
        weight: this.riskWeights[key] || 0
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  generateComprehensiveSafetyRecommendations(riskScores, totalScore) {
    const recommendations = [];
    
    // Critical recommendations based on total score
    if (totalScore >= 8) {
      recommendations.push({
        priority: 'critical',
        category: 'general',
        recommendation: 'CRITICAL RISK: Consider postponing journey or using alternative route'
      });
    }
    
    // Factor-specific recommendations
    Object.entries(riskScores).forEach(([factor, score]) => {
      const actualScore = typeof score === 'object' ? score.riskScore || score : score;
      if (actualScore > 7) {
        recommendations.push(...this.getFactorSpecificRecommendations(factor, actualScore));
      }
    });
    
    // General safety recommendations
    recommendations.push(
      {
        priority: 'high',
        category: 'communication',
        recommendation: 'Maintain constant communication with control room'
      },
      {
        priority: 'medium',
        category: 'preparation',
        recommendation: 'Carry comprehensive emergency kit'
      },
      {
        priority: 'medium',
        category: 'documentation',
        recommendation: 'Keep emergency contact numbers accessible'
      }
    );
    
    return recommendations;
  }

  getFactorSpecificRecommendations(factor, score) {
    const recommendations = {
      roadConditions: [
        { priority: 'high', category: 'vehicle', recommendation: 'Inspect vehicle thoroughly, especially brakes and suspension' },
        { priority: 'high', category: 'driving', recommendation: 'Reduce speed and increase following distance' }
      ],
      accidentProne: [
        { priority: 'critical', category: 'route', recommendation: 'Exercise extreme caution in identified accident zones' },
        { priority: 'high', category: 'convoy', recommendation: 'Consider convoy travel through high-risk areas' }
      ],
      trafficDensity: [
        { priority: 'medium', category: 'timing', recommendation: 'Avoid peak traffic hours if possible' },
        { priority: 'medium', category: 'fuel', recommendation: 'Maintain higher fuel levels due to potential delays' }
      ],
      weatherConditions: [
        { priority: 'high', category: 'weather', recommendation: 'Monitor weather conditions continuously' },
        { priority: 'high', category: 'timing', recommendation: 'Delay travel during severe weather warnings' }
      ]
    };
    
    return recommendations[factor] || [];
  }

  calculateWeightedScore(riskScores) {
    let totalScore = 0;
    
    Object.entries(riskScores).forEach(([criterion, score]) => {
      if (this.riskWeights[criterion]) {
        const actualScore = typeof score === 'object' ? score.riskScore || score : score;
        totalScore += (actualScore * this.riskWeights[criterion]) / 100;
      }
    });
    
    return totalScore;
  }

  determineRiskGrade(totalScore) {
    for (const [grade, threshold] of Object.entries(this.gradeThresholds)) {
      if (totalScore >= threshold.min && totalScore <= threshold.max) {
        return grade;
      }
    }
    return 'F';
  }

  determineRiskLevel(totalScore) {
    const grade = this.determineRiskGrade(totalScore);
    return this.gradeThresholds[grade].level;
  }

  async assessDataQuality(routeId) {
    try {
      const route = await Route.findById(routeId);
      const processingStatus = route.dataProcessingStatus || {};
      
      const totalCategories = Object.keys(processingStatus).length;
      const completedCategories = Object.values(processingStatus).filter(status => status === true).length;
      
      const completionPercentage = totalCategories > 0 ? (completedCategories / totalCategories) * 100 : 0;
      
      let quality = 'low';
      if (completionPercentage >= 90) quality = 'high';
      else if (completionPercentage >= 70) quality = 'medium';
      
      return {
        level: quality,
        completionPercentage: Math.round(completionPercentage),
        missingData: Object.entries(processingStatus)
          .filter(([key, value]) => !value)
          .map(([key]) => key)
      };
    } catch (error) {
      return { level: 'unknown', completionPercentage: 0, missingData: [] };
    }
  }

  calculateConfidenceLevel(routeId) {
    // Mock confidence calculation - would be based on data quality, API reliability, etc.
    return Math.floor(Math.random() * 20) + 80; // 80-100% confidence
  }

}

module.exports = new EnhancedRiskCalculationService();