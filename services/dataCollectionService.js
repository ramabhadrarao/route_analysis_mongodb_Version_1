// File: services/dataCollectionService.js
// Purpose: Collect comprehensive route data from multiple APIs

const apiService = require('./apiService');
const Route = require('../models/Route');

// Import all models (create these if missing)
const RoadCondition = require('../models/RoadCondition');
const AccidentProneArea = require('../models/AccidentProneArea');
const WeatherCondition = require('../models/WeatherCondition');
const TrafficData = require('../models/TrafficData');
const EmergencyService = require('../models/EmergencyService');

class DataCollectionService {
  
  // Main function to collect ALL route data
  async collectAllRouteData(routeId) {
    try {
      console.log(`🔄 Starting comprehensive data collection for route: ${routeId}`);
      
      const route = await Route.findById(routeId);
      if (!route) {
        throw new Error('Route not found');
      }

      // Collect all types of data in parallel
      const dataPromises = [
        this.collectEmergencyServices(route),
        this.collectWeatherData(route),
        this.collectTrafficData(route),
        this.collectAccidentProneAreas(route),
        this.collectRoadConditions(route),
        this.collectNetworkCoverage(route),
        this.collectRoadsideAmenities(route),
        this.collectSecurityData(route)
      ];

      const results = await Promise.allSettled(dataPromises);
      
      // Process results
      const collectionSummary = {
        emergencyServices: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason?.message },
        weatherData: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason?.message },
        trafficData: results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason?.message },
        accidentAreas: results[3].status === 'fulfilled' ? results[3].value : { error: results[3].reason?.message },
        roadConditions: results[4].status === 'fulfilled' ? results[4].value : { error: results[4].reason?.message },
        networkCoverage: results[5].status === 'fulfilled' ? results[5].value : { error: results[5].reason?.message },
        amenities: results[6].status === 'fulfilled' ? results[6].value : { error: results[6].reason?.message },
        securityData: results[7].status === 'fulfilled' ? results[7].value : { error: results[7].reason?.message }
      };

      console.log(`✅ Data collection completed for route: ${routeId}`);
      return collectionSummary;
      
    } catch (error) {
      console.error('Data collection failed:', error);
      throw error;
    }
  }

  // 1. Emergency Services Collection
  async collectEmergencyServices(route) {
    try {
      console.log('📍 Collecting emergency services...');
      
      const services = [];
      const serviceTypes = ['hospital', 'police', 'fire_station'];
      const searchRadius = 25000; // 25km radius
      
      // Sample points along the route for comprehensive coverage
      const samplePoints = this.sampleRoutePoints(route.routePoints, 5);
      
      for (const point of samplePoints) {
        for (const serviceType of serviceTypes) {
          try {
            const nearbyServices = await apiService.findNearbyPlaces(
              point.latitude,
              point.longitude,
              serviceType,
              searchRadius
            );
            
            // Save top 3 closest services of each type per point
            for (const service of nearbyServices.slice(0, 3)) {
              const distance = this.calculateDistance(
                point.latitude, point.longitude,
                service.latitude, service.longitude
              );
              
              const emergencyService = new EmergencyService({
                routeId: route._id,
                serviceType: this.mapServiceType(serviceType),
                name: service.name,
                latitude: service.latitude,
                longitude: service.longitude,
                address: service.vicinity || 'Address not available',
                operatingHours: service.openNow ? '24/7' : 'Standard hours',
                servicesOffered: [serviceType],
                distanceFromRouteKm: distance,
                responseTimeMinutes: this.estimateResponseTime(distance, serviceType),
                availabilityScore: this.calculateAvailabilityScore(service, distance)
              });
              
              await emergencyService.save();
              services.push(emergencyService);
            }
          } catch (serviceError) {
            console.warn(`Failed to get ${serviceType} services:`, serviceError.message);
          }
        }
      }
      
      await route.updateProcessingStatus('emergencyServices', true);
      
      return {
        total: services.length,
        hospitals: services.filter(s => s.serviceType === 'hospital').length,
        police: services.filter(s => s.serviceType === 'police').length,
        fireStations: services.filter(s => s.serviceType === 'fire_station').length,
        averageDistance: this.calculateAverageDistance(services)
      };
      
    } catch (error) {
      console.error('Emergency services collection failed:', error);
      throw error;
    }
  }

  // 2. Weather Data Collection
  async collectWeatherData(route) {
    try {
      console.log('🌤️ Collecting weather data...');
      
      const weatherPoints = [];
      
      // Get weather for start, middle, and end points
      const keyPoints = [
        route.fromCoordinates,
        this.getMiddlePoint(route.fromCoordinates, route.toCoordinates),
        route.toCoordinates
      ];
      
      for (const point of keyPoints) {
        try {
          const weatherData = await apiService.getWeatherData(point.latitude, point.longitude);
          
          const weatherCondition = new WeatherCondition({
            routeId: route._id,
            latitude: point.latitude,
            longitude: point.longitude,
            season: this.getCurrentSeason(),
            weatherCondition: this.mapWeatherCondition(weatherData.condition),
            averageTemperature: weatherData.temperature,
            precipitationMm: 0, // Current weather
            windSpeedKmph: weatherData.windSpeed,
            visibilityKm: weatherData.visibility,
            roadSurfaceCondition: this.determineSurfaceCondition(weatherData),
            riskScore: this.assessWeatherRisk(weatherData),
            dataYear: new Date().getFullYear()
          });
          
          await weatherCondition.save();
          weatherPoints.push(weatherCondition);
          
        } catch (weatherError) {
          console.warn('Failed to get weather for point:', weatherError.message);
        }
      }
      
      await route.updateProcessingStatus('weatherData', true);
      
      return {
        total: weatherPoints.length,
        averageTemp: weatherPoints.reduce((sum, w) => sum + w.averageTemperature, 0) / weatherPoints.length,
        averageRisk: weatherPoints.reduce((sum, w) => sum + w.riskScore, 0) / weatherPoints.length,
        conditions: weatherPoints.map(w => w.weatherCondition)
      };
      
    } catch (error) {
      console.error('Weather data collection failed:', error);
      throw error;
    }
  }

  // 3. Traffic Data Collection
  async collectTrafficData(route) {
    try {
      console.log('🚗 Collecting traffic data...');
      
      const trafficPoints = [];
      
      // Sample points along the route for traffic analysis
      const samplePoints = this.sampleRoutePoints(route.routePoints, 10);
      
      for (const point of samplePoints) {
        try {
          const trafficData = await apiService.getTrafficData(point.latitude, point.longitude);
          
          const traffic = new TrafficData({
            routeId: route._id,
            latitude: point.latitude,
            longitude: point.longitude,
            peakHourTrafficCount: Math.round(trafficData.currentSpeed * 10), // Estimated
            averageSpeedKmph: trafficData.currentSpeed,
            congestionLevel: this.determineCongestionLevel(trafficData),
            bottleneckCauses: this.identifyBottlenecks(trafficData),
            alternativeRoutesAvailable: false, // Would need route comparison
            riskScore: this.calculateTrafficRiskScore(trafficData),
            measurementTime: new Date()
          });
          
          await traffic.save();
          trafficPoints.push(traffic);
          
        } catch (trafficError) {
          console.warn('Failed to get traffic for point:', trafficError.message);
        }
      }
      
      await route.updateProcessingStatus('trafficData', true);
      
      return {
        total: trafficPoints.length,
        averageSpeed: trafficPoints.reduce((sum, t) => sum + t.averageSpeedKmph, 0) / trafficPoints.length,
        congestionAreas: trafficPoints.filter(t => ['heavy', 'severe'].includes(t.congestionLevel)).length,
        averageRisk: trafficPoints.reduce((sum, t) => sum + t.riskScore, 0) / trafficPoints.length
      };
      
    } catch (error) {
      console.error('Traffic data collection failed:', error);
      throw error;
    }
  }

  // 4. Accident-Prone Areas Collection
  async collectAccidentProneAreas(route) {
    try {
      console.log('⚠️ Collecting accident-prone area data...');
      
      const accidentAreas = [];
      
      // Search for indicators of accident-prone areas
      const samplePoints = this.sampleRoutePoints(route.routePoints, 8);
      
      for (const point of samplePoints) {
        try {
          // Search for traffic police stations (indicator of accident-prone areas)
          const policeStations = await apiService.findNearbyPlaces(
            point.latitude,
            point.longitude,
            'police',
            10000 // 10km radius
          );
          
          // Search for hospitals (often located near accident-prone areas)
          const hospitals = await apiService.findNearbyPlaces(
            point.latitude,
            point.longitude,
            'hospital',
            15000 // 15km radius
          );
          
          // Estimate accident proneness based on infrastructure density
          const accidentRisk = this.estimateAccidentRisk(policeStations.length, hospitals.length);
          
          if (accidentRisk > 5) { // Only save high-risk areas
            const accidentArea = new AccidentProneArea({
              routeId: route._id,
              latitude: point.latitude,
              longitude: point.longitude,
              accidentFrequencyYearly: accidentRisk * 2, // Estimated
              accidentSeverity: accidentRisk > 7 ? 'major' : 'minor',
              commonAccidentTypes: ['collision', 'overtaking', 'speeding'],
              contributingFactors: ['high_traffic', 'poor_visibility', 'road_conditions'],
              riskScore: accidentRisk,
              dataSource: 'INFRASTRUCTURE_ANALYSIS'
            });
            
            await accidentArea.save();
            accidentAreas.push(accidentArea);
          }
          
        } catch (accidentError) {
          console.warn('Failed to analyze accident risk for point:', accidentError.message);
        }
      }
      
      await route.updateProcessingStatus('accidentData', true);
      
      return {
        total: accidentAreas.length,
        highRiskAreas: accidentAreas.filter(a => a.riskScore > 7).length,
        averageRisk: accidentAreas.length > 0 ? 
          accidentAreas.reduce((sum, a) => sum + a.riskScore, 0) / accidentAreas.length : 0
      };
      
    } catch (error) {
      console.error('Accident-prone areas collection failed:', error);
      throw error;
    }
  }

  // 5. Road Conditions Collection
  async collectRoadConditions(route) {
    try {
      console.log('🛣️ Collecting road conditions data...');
      
      const roadConditions = [];
      
      // Analyze road conditions at sample points
      const samplePoints = this.sampleRoutePoints(route.routePoints, 15);
      
      for (const point of samplePoints) {
        try {
          // Get road attributes (simplified analysis)
          const roadQuality = this.assessRoadQuality(point, route);
          
          const roadCondition = new RoadCondition({
            routeId: route._id,
            latitude: point.latitude,
            longitude: point.longitude,
            roadType: this.determineRoadType(route.majorHighways),
            surfaceQuality: roadQuality.surface,
            widthMeters: roadQuality.width,
            laneCount: roadQuality.lanes,
            hasPotholes: roadQuality.potholes,
            underConstruction: false, // Would need real-time data
            riskScore: roadQuality.riskScore,
            dataSource: 'ROUTE_ANALYSIS'
          });
          
          await roadCondition.save();
          roadConditions.push(roadCondition);
          
        } catch (roadError) {
          console.warn('Failed to assess road condition for point:', roadError.message);
        }
      }
      
      await route.updateProcessingStatus('roadConditions', true);
      
      return {
        total: roadConditions.length,
        averageRisk: roadConditions.reduce((sum, r) => sum + r.riskScore, 0) / roadConditions.length,
        poorConditions: roadConditions.filter(r => ['poor', 'critical'].includes(r.surfaceQuality)).length
      };
      
    } catch (error) {
      console.error('Road conditions collection failed:', error);
      throw error;
    }
  }

  // 6. Network Coverage (Simplified)
  async collectNetworkCoverage(route) {
    try {
      console.log('📶 Analyzing network coverage...');
      
      // Simplified network coverage analysis based on terrain and route type
      let coverageRisk = 5; // Base risk
      
      if (route.terrain === 'rural') coverageRisk += 2;
      if (route.terrain === 'hilly') coverageRisk += 3;
      if (route.totalDistance > 200) coverageRisk += 1;
      
      await route.updateProcessingStatus('networkCoverage', true);
      
      return {
        coverageQuality: coverageRisk < 5 ? 'excellent' : coverageRisk < 7 ? 'good' : 'poor',
        riskScore: Math.min(10, coverageRisk),
        estimatedDeadZones: Math.floor(route.totalDistance / 50) // Rough estimate
      };
      
    } catch (error) {
      console.error('Network coverage analysis failed:', error);
      throw error;
    }
  }

  // 7. Roadside Amenities
  async collectRoadsideAmenities(route) {
    try {
      console.log('⛽ Collecting roadside amenities...');
      
      const amenities = [];
      const amenityTypes = ['gas_station', 'restaurant', 'atm'];
      
      const samplePoints = this.sampleRoutePoints(route.routePoints, 3);
      
      for (const point of samplePoints) {
        for (const amenityType of amenityTypes) {
          try {
            const nearbyAmenities = await apiService.findNearbyPlaces(
              point.latitude,
              point.longitude,
              amenityType,
              20000 // 20km radius
            );
            
            amenities.push(...nearbyAmenities.slice(0, 2)); // Top 2 of each type
            
          } catch (amenityError) {
            console.warn(`Failed to get ${amenityType} amenities:`, amenityError.message);
          }
        }
      }
      
      await route.updateProcessingStatus('amenities', true);
      
      return {
        total: amenities.length,
        gasStations: amenities.filter(a => a.types?.includes('gas_station')).length,
        restaurants: amenities.filter(a => a.types?.includes('restaurant')).length,
        atms: amenities.filter(a => a.types?.includes('atm')).length
      };
      
    } catch (error) {
      console.error('Amenities collection failed:', error);
      throw error;
    }
  }

  // 8. Security Data (Simplified)
  async collectSecurityData(route) {
    try {
      console.log('🔒 Analyzing security factors...');
      
      // Simplified security risk assessment
      let securityRisk = 3; // Base risk
      
      if (route.terrain === 'rural') securityRisk += 2;
      if (route.totalDistance > 300) securityRisk += 1;
      
      // Check for urban areas (generally safer)
      if (route.terrain === 'urban') securityRisk -= 1;
      
      await route.updateProcessingStatus('securityData', true);
      
      return {
        riskLevel: securityRisk < 4 ? 'low' : securityRisk < 6 ? 'medium' : 'high',
        riskScore: Math.max(1, Math.min(10, securityRisk)),
        factors: route.terrain === 'rural' ? ['isolated_areas'] : ['urban_traffic']
      };
      
    } catch (error) {
      console.error('Security data collection failed:', error);
      throw error;
    }
  }

  // Helper methods
  sampleRoutePoints(routePoints, count) {
    if (!routePoints || routePoints.length <= count) return routePoints || [];
    
    const step = Math.floor(routePoints.length / count);
    const sampled = [];
    
    for (let i = 0; i < routePoints.length; i += step) {
      sampled.push(routePoints[i]);
      if (sampled.length >= count) break;
    }
    
    return sampled;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  mapServiceType(type) {
    const serviceMap = {
      'hospital': 'hospital',
      'police': 'police',
      'fire_station': 'fire_station',
      'gas_station': 'mechanic'
    };
    return serviceMap[type] || type;
  }

  estimateResponseTime(distance, serviceType) {
    const baseTime = serviceType === 'police' ? 10 : 15;
    return Math.round(baseTime + (distance * 2));
  }

  calculateAvailabilityScore(service, distance) {
    let score = 8;
    if (distance > 20) score -= 3;
    if (distance > 10) score -= 1;
    if (service.rating) score = Math.round((score + service.rating) / 2);
    return Math.max(1, Math.min(10, score));
  }

  getMiddlePoint(coord1, coord2) {
    return {
      latitude: (coord1.latitude + coord2.latitude) / 2,
      longitude: (coord1.longitude + coord2.longitude) / 2
    };
  }

  getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'monsoon';
    return 'winter';
  }

  mapWeatherCondition(condition) {
    const conditionMap = {
      'Clear': 'clear',
      'Clouds': 'clear',
      'Rain': 'rainy',
      'Thunderstorm': 'stormy',
      'Snow': 'icy',
      'Mist': 'foggy',
      'Fog': 'foggy'
    };
    return conditionMap[condition] || 'clear';
  }

  determineSurfaceCondition(weatherData) {
    if (weatherData.condition?.toLowerCase().includes('rain')) return 'wet';
    if (weatherData.condition?.toLowerCase().includes('snow')) return 'icy';
    return 'dry';
  }

  assessWeatherRisk(weatherData) {
    let risk = 3;
    if (weatherData.visibility < 5) risk += 3;
    if (weatherData.windSpeed > 30) risk += 2;
    if (weatherData.condition?.toLowerCase().includes('rain')) risk += 2;
    if (weatherData.condition?.toLowerCase().includes('fog')) risk += 3;
    return Math.max(1, Math.min(10, risk));
  }

  determineCongestionLevel(trafficData) {
    const ratio = trafficData.currentSpeed / (trafficData.freeFlowSpeed || 60);
    if (ratio > 0.8) return 'free_flow';
    if (ratio > 0.6) return 'light';
    if (ratio > 0.4) return 'moderate';
    if (ratio > 0.2) return 'heavy';
    return 'severe';
  }

  identifyBottlenecks(trafficData) {
    const bottlenecks = [];
    if (trafficData.currentSpeed < 20) bottlenecks.push('low_speed_zone');
    if (trafficData.roadClosure) bottlenecks.push('road_closure');
    return bottlenecks;
  }

  calculateTrafficRiskScore(trafficData) {
    const speedRatio = trafficData.currentSpeed / (trafficData.freeFlowSpeed || 60);
    return Math.round((1 - speedRatio) * 10);
  }

  estimateAccidentRisk(policeCount, hospitalCount) {
    // More police stations and hospitals might indicate accident-prone areas
    return Math.min(10, 3 + policeCount + (hospitalCount * 0.5));
  }

  assessRoadQuality(point, route) {
    let riskScore = 5;
    
    // Adjust based on route characteristics
    if (route.terrain === 'hilly') riskScore += 1;
    if (route.terrain === 'rural') riskScore += 2;
    if (route.majorHighways?.some(h => h.startsWith('NH'))) riskScore -= 1;
    
    return {
      surface: riskScore > 6 ? 'poor' : riskScore > 4 ? 'fair' : 'good',
      width: route.majorHighways?.length > 0 ? 7.5 : 3.5,
      lanes: route.majorHighways?.length > 0 ? 2 : 1,
      potholes: riskScore > 6,
      riskScore: Math.max(1, Math.min(10, riskScore))
    };
  }

  determineRoadType(majorHighways) {
    if (!majorHighways || majorHighways.length === 0) return 'rural';
    if (majorHighways.some(h => h.startsWith('NH'))) return 'highway';
    if (majorHighways.some(h => h.startsWith('SH'))) return 'state';
    return 'district';
  }

  calculateAverageDistance(services) {
    if (services.length === 0) return 0;
    return services.reduce((sum, s) => sum + s.distanceFromRouteKm, 0) / services.length;
  }
}

module.exports = new DataCollectionService();