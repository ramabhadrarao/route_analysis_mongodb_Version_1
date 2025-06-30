// File: services/dataCollectionService.js
// Purpose: Enhanced comprehensive route data collection with detailed information
// Collects: Emergency services, fuel stations, educational institutions, food stops, etc.
// Includes: Phone numbers, distances from start/end points, detailed facility information

const apiService = require('./apiService');
const Route = require('../models/Route');

// Import all models
const RoadCondition = require('../models/RoadCondition');
const AccidentProneArea = require('../models/AccidentProneArea');
const WeatherCondition = require('../models/WeatherCondition');
const TrafficData = require('../models/TrafficData');
const EmergencyService = require('../models/EmergencyService');

class EnhancedDataCollectionService {
  
  constructor() {
    // Enhanced service categories for comprehensive collection
    this.serviceCategories = {
      // Critical Emergency Services
      emergency: {
        'hospital': { type: 'hospital', priority: 'critical', radius: 50000 },
        'emergency_room': { type: 'hospital', priority: 'critical', radius: 30000 },
        'clinic': { type: 'hospital', priority: 'high', radius: 25000 },
        'pharmacy': { type: 'hospital', priority: 'medium', radius: 15000 }
      },
      
      // Law Enforcement & Security
      lawEnforcement: {
        'police': { type: 'police', priority: 'critical', radius: 40000 },
        'courthouse': { type: 'police', priority: 'medium', radius: 50000 },
        'prison': { type: 'police', priority: 'low', radius: 30000 }
      },
      
      // Fire & Rescue Services
      fireRescue: {
        'fire_station': { type: 'fire_station', priority: 'critical', radius: 35000 },
        'ambulance_service': { type: 'fire_station', priority: 'critical', radius: 40000 }
      },
      
      // Fuel & Vehicle Services
      fuelServices: {
        'gas_station': { type: 'mechanic', priority: 'high', radius: 25000 },
        'car_repair': { type: 'mechanic', priority: 'medium', radius: 20000 },
        'car_dealer': { type: 'mechanic', priority: 'low', radius: 30000 },
        'tire_shop': { type: 'mechanic', priority: 'medium', radius: 15000 }
      },
      
      // Educational Institutions
      educational: {
        'school': { type: 'educational', priority: 'medium', radius: 20000 },
        'university': { type: 'educational', priority: 'medium', radius: 30000 },
        'college': { type: 'educational', priority: 'medium', radius: 25000 }
      },
      
      // Food & Rest Stops
      foodRest: {
        'restaurant': { type: 'amenity', priority: 'medium', radius: 20000 },
        'food': { type: 'amenity', priority: 'medium', radius: 15000 },
        'meal_delivery': { type: 'amenity', priority: 'low', radius: 10000 },
        'cafe': { type: 'amenity', priority: 'low', radius: 10000 },
        'lodging': { type: 'amenity', priority: 'high', radius: 30000 }
      },
      
      // Financial & Communication
      financial: {
        'bank': { type: 'amenity', priority: 'medium', radius: 20000 },
        'atm': { type: 'amenity', priority: 'high', radius: 15000 },
        'post_office': { type: 'amenity', priority: 'medium', radius: 25000 }
      },
      
      // Transportation Hubs
      transportation: {
        'bus_station': { type: 'transport', priority: 'medium', radius: 30000 },
        'train_station': { type: 'transport', priority: 'medium', radius: 40000 },
        'airport': { type: 'transport', priority: 'low', radius: 50000 },
        'taxi_stand': { type: 'transport', priority: 'medium', radius: 15000 }
      }
    };
  }

  // Main enhanced data collection function
  async collectAllRouteData(routeId) {
    try {
      console.log(`🔄 Starting ENHANCED comprehensive data collection for route: ${routeId}`);
      
      const route = await Route.findById(routeId);
      if (!route) {
        throw new Error('Route not found');
      }

      // Enhanced data collection with detailed information
      const dataPromises = [
        this.collectDetailedEmergencyServices(route),
        this.collectLawEnforcementServices(route),
        this.collectFireRescueServices(route),
        this.collectFuelStations(route),
        this.collectEducationalInstitutions(route),
        this.collectFoodRestStops(route),
        this.collectFinancialServices(route),
        this.collectTransportationHubs(route),
        this.collectEnhancedWeatherData(route),
        this.collectDetailedTrafficData(route),
        this.collectAccidentProneAreas(route),
        this.collectEnhancedRoadConditions(route),
        this.collectNetworkCoverage(route),
        this.collectSecurityAnalysis(route)
      ];

      const results = await Promise.allSettled(dataPromises);
      
      // Update processing status sequentially
      const statusUpdates = [
        'emergencyServices', 'lawEnforcement', 'fireRescue', 'fuelStations',
        'educational', 'foodRest', 'financial', 'transportation',
        'weatherData', 'trafficData', 'accidentData', 'roadConditions',
        'networkCoverage', 'securityData'
      ];

      for (const status of statusUpdates) {
        try {
          await route.updateProcessingStatus(status, true);
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to prevent conflicts
        } catch (statusError) {
          console.warn(`Status update failed for ${status}:`, statusError.message);
        }
      }
      
      // Process and structure results
      const collectionSummary = {
        emergencyServices: this.processResult(results[0]),
        lawEnforcement: this.processResult(results[1]),
        fireRescue: this.processResult(results[2]),
        fuelStations: this.processResult(results[3]),
        educational: this.processResult(results[4]),
        foodRest: this.processResult(results[5]),
        financial: this.processResult(results[6]),
        transportation: this.processResult(results[7]),
        weatherData: this.processResult(results[8]),
        trafficData: this.processResult(results[9]),
        accidentAreas: this.processResult(results[10]),
        roadConditions: this.processResult(results[11]),
        networkCoverage: this.processResult(results[12]),
        securityData: this.processResult(results[13])
      };

      console.log(`✅ Enhanced data collection completed for route: ${routeId}`);
      return collectionSummary;
      
    } catch (error) {
      console.error('Enhanced data collection failed:', error);
      throw error;
    }
  }

  // 1. DETAILED EMERGENCY SERVICES (Hospitals, Clinics, Pharmacies)
  async collectDetailedEmergencyServices(route) {
    try {
      console.log('🏥 Collecting detailed emergency services...');
      
      const services = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 20); // 20 segments for detailed coverage
      
      for (const segment of routeSegments) {
        for (const [serviceKey, config] of Object.entries(this.serviceCategories.emergency)) {
          try {
            const nearbyServices = await apiService.findNearbyPlaces(
              segment.latitude,
              segment.longitude,
              serviceKey,
              config.radius
            );
            
            // Process each service with detailed information
            for (const service of nearbyServices.slice(0, 5)) { // Top 5 per segment
              const distanceFromStart = this.calculateDistanceFromStart(route.routePoints, service);
              const distanceFromEnd = route.totalDistance - distanceFromStart;
              const distanceFromRoute = this.calculateDistanceFromRoute(route.routePoints, service);
              
              // Get additional details
              const serviceDetails = await this.getPlaceDetails(service.placeId);
              
              const emergencyService = new EmergencyService({
                routeId: route._id,
                serviceType: this.mapEmergencyServiceType(serviceKey),
                name: service.name,
                latitude: service.latitude,
                longitude: service.longitude,
                phoneNumber: serviceDetails.phoneNumber || 'Not available',
                emergencyNumber: this.getEmergencyNumber(serviceKey),
                address: serviceDetails.address || service.vicinity,
                operatingHours: serviceDetails.operatingHours || 'Hours not available',
                servicesOffered: this.getServicesOffered(serviceKey),
                distanceFromRouteKm: distanceFromRoute,
                distanceFromStartKm: distanceFromStart,
                distanceFromEndKm: distanceFromEnd,
                responseTimeMinutes: this.estimateResponseTime(distanceFromRoute, serviceKey),
                availabilityScore: this.calculateAvailabilityScore(service, distanceFromRoute),
                priority: config.priority,
                rating: service.rating || 0,
                website: serviceDetails.website || '',
                accessibility: serviceDetails.accessibility || 'Unknown'
              });
              
              await emergencyService.save();
              services.push(emergencyService);
            }
          } catch (serviceError) {
            console.warn(`Failed to get ${serviceKey} services:`, serviceError.message);
          }
        }
      }
      
      return {
        total: services.length,
        hospitals: services.filter(s => s.serviceType === 'hospital').length,
        clinics: services.filter(s => s.name.toLowerCase().includes('clinic')).length,
        pharmacies: services.filter(s => s.name.toLowerCase().includes('pharmacy')).length,
        emergencyRooms: services.filter(s => s.name.toLowerCase().includes('emergency')).length,
        averageDistance: this.calculateAverageDistance(services),
        averageResponseTime: services.reduce((sum, s) => sum + s.responseTimeMinutes, 0) / services.length || 0,
        coverage: this.assessCoverage(services, route.totalDistance)
      };
      
    } catch (error) {
      console.error('Emergency services collection failed:', error);
      throw error;
    }
  }

  // 2. LAW ENFORCEMENT & SECURITY SERVICES
  async collectLawEnforcementServices(route) {
    try {
      console.log('👮 Collecting law enforcement services...');
      
      const services = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 15);
      
      for (const segment of routeSegments) {
        for (const [serviceKey, config] of Object.entries(this.serviceCategories.lawEnforcement)) {
          try {
            const nearbyServices = await apiService.findNearbyPlaces(
              segment.latitude,
              segment.longitude,
              serviceKey,
              config.radius
            );
            
            for (const service of nearbyServices.slice(0, 3)) {
              const distanceFromStart = this.calculateDistanceFromStart(route.routePoints, service);
              const distanceFromEnd = route.totalDistance - distanceFromStart;
              const distanceFromRoute = this.calculateDistanceFromRoute(route.routePoints, service);
              
              const serviceDetails = await this.getPlaceDetails(service.placeId);
              
              const lawEnforcementService = new EmergencyService({
                routeId: route._id,
                serviceType: 'police',
                name: service.name,
                latitude: service.latitude,
                longitude: service.longitude,
                phoneNumber: serviceDetails.phoneNumber || '100', // Police emergency number
                emergencyNumber: '100',
                address: serviceDetails.address || service.vicinity,
                operatingHours: serviceDetails.operatingHours || '24/7',
                servicesOffered: ['Emergency Response', 'Law Enforcement', 'Traffic Control'],
                distanceFromRouteKm: distanceFromRoute,
                distanceFromStartKm: distanceFromStart,
                distanceFromEndKm: distanceFromEnd,
                responseTimeMinutes: this.estimateResponseTime(distanceFromRoute, 'police'),
                availabilityScore: this.calculateAvailabilityScore(service, distanceFromRoute),
                priority: config.priority,
                jurisdiction: this.determineJurisdiction(service.latitude, service.longitude),
                specializedUnits: this.getSpecializedUnits(serviceKey)
              });
              
              await lawEnforcementService.save();
              services.push(lawEnforcementService);
            }
          } catch (serviceError) {
            console.warn(`Failed to get ${serviceKey} services:`, serviceError.message);
          }
        }
      }
      
      return {
        total: services.length,
        policeStations: services.filter(s => s.name.toLowerCase().includes('police')).length,
        trafficPolice: services.filter(s => s.name.toLowerCase().includes('traffic')).length,
        averageDistance: this.calculateAverageDistance(services),
        coverage: this.assessCoverage(services, route.totalDistance)
      };
      
    } catch (error) {
      console.error('Law enforcement services collection failed:', error);
      throw error;
    }
  }

  // 3. FIRE & RESCUE SERVICES
  async collectFireRescueServices(route) {
    try {
      console.log('🚒 Collecting fire & rescue services...');
      
      const services = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 12);
      
      for (const segment of routeSegments) {
        for (const [serviceKey, config] of Object.entries(this.serviceCategories.fireRescue)) {
          try {
            const nearbyServices = await apiService.findNearbyPlaces(
              segment.latitude,
              segment.longitude,
              serviceKey,
              config.radius
            );
            
            for (const service of nearbyServices.slice(0, 3)) {
              const distanceFromStart = this.calculateDistanceFromStart(route.routePoints, service);
              const distanceFromEnd = route.totalDistance - distanceFromStart;
              const distanceFromRoute = this.calculateDistanceFromRoute(route.routePoints, service);
              
              const serviceDetails = await this.getPlaceDetails(service.placeId);
              
              const fireRescueService = new EmergencyService({
                routeId: route._id,
                serviceType: 'fire_station',
                name: service.name,
                latitude: service.latitude,
                longitude: service.longitude,
                phoneNumber: serviceDetails.phoneNumber || '101',
                emergencyNumber: '101',
                address: serviceDetails.address || service.vicinity,
                operatingHours: '24/7',
                servicesOffered: ['Fire Fighting', 'Emergency Medical', 'Rescue Operations', 'Hazmat Response'],
                distanceFromRouteKm: distanceFromRoute,
                distanceFromStartKm: distanceFromStart,
                distanceFromEndKm: distanceFromEnd,
                responseTimeMinutes: this.estimateResponseTime(distanceFromRoute, 'fire_station'),
                availabilityScore: this.calculateAvailabilityScore(service, distanceFromRoute),
                priority: config.priority,
                equipment: this.getFireEquipment(serviceKey),
                specializations: this.getFireSpecializations()
              });
              
              await fireRescueService.save();
              services.push(fireRescueService);
            }
          } catch (serviceError) {
            console.warn(`Failed to get ${serviceKey} services:`, serviceError.message);
          }
        }
      }
      
      return {
        total: services.length,
        fireStations: services.filter(s => s.serviceType === 'fire_station').length,
        averageDistance: this.calculateAverageDistance(services),
        coverage: this.assessCoverage(services, route.totalDistance)
      };
      
    } catch (error) {
      console.error('Fire & rescue services collection failed:', error);
      throw error;
    }
  }

  // 4. FUEL STATIONS & VEHICLE SERVICES
  async collectFuelStations(route) {
    try {
      console.log('⛽ Collecting fuel stations & vehicle services...');
      
      const services = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 25); // More segments for fuel stations
      
      for (const segment of routeSegments) {
        for (const [serviceKey, config] of Object.entries(this.serviceCategories.fuelServices)) {
          try {
            const nearbyServices = await apiService.findNearbyPlaces(
              segment.latitude,
              segment.longitude,
              serviceKey,
              config.radius
            );
            
            for (const service of nearbyServices.slice(0, 4)) {
              const distanceFromStart = this.calculateDistanceFromStart(route.routePoints, service);
              const distanceFromEnd = route.totalDistance - distanceFromStart;
              const distanceFromRoute = this.calculateDistanceFromRoute(route.routePoints, service);
              
              const serviceDetails = await this.getPlaceDetails(service.placeId);
              
              const fuelService = {
                routeId: route._id,
                serviceType: serviceKey,
                name: service.name,
                latitude: service.latitude,
                longitude: service.longitude,
                phoneNumber: serviceDetails.phoneNumber || 'Not available',
                address: serviceDetails.address || service.vicinity,
                operatingHours: serviceDetails.operatingHours || 'Hours not available',
                distanceFromRouteKm: distanceFromRoute,
                distanceFromStartKm: distanceFromStart,
                distanceFromEndKm: distanceFromEnd,
                priority: config.priority,
                rating: service.rating || 0,
                priceLevel: service.priceLevel || 0,
                fuelTypes: this.getFuelTypes(serviceKey),
                services: this.getVehicleServices(serviceKey),
                amenities: serviceDetails.amenities || [],
                isOpen24Hours: this.checkIfOpen24Hours(serviceDetails.operatingHours),
                hasATM: serviceDetails.hasATM || false,
                hasRestroom: serviceDetails.hasRestroom || false,
                hasConvenienceStore: serviceDetails.hasConvenienceStore || false
              };
              
              // Save as EmergencyService with mechanic type for consistency
              const emergencyService = new EmergencyService({
                ...fuelService,
                serviceType: 'mechanic',
                emergencyNumber: 'N/A',
                responseTimeMinutes: 0,
                availabilityScore: this.calculateAvailabilityScore(service, distanceFromRoute)
              });
              
              await emergencyService.save();
              services.push(emergencyService);
            }
          } catch (serviceError) {
            console.warn(`Failed to get ${serviceKey} services:`, serviceError.message);
          }
        }
      }
      
      return {
        total: services.length,
        gasStations: services.filter(s => s.name.toLowerCase().includes('gas') || s.name.toLowerCase().includes('petrol')).length,
        repairShops: services.filter(s => s.name.toLowerCase().includes('repair')).length,
        averageDistance: this.calculateAverageDistance(services),
        coverage: this.assessCoverage(services, route.totalDistance),
        open24Hours: services.filter(s => s.isOpen24Hours).length
      };
      
    } catch (error) {
      console.error('Fuel stations collection failed:', error);
      throw error;
    }
  }

  // 5. ENHANCED WEATHER DATA COLLECTION
  async collectEnhancedWeatherData(route) {
    try {
      console.log('🌤️ Collecting enhanced weather data...');
      
      const weatherPoints = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 10);
      
      for (const segment of routeSegments) {
        try {
          const currentWeather = await apiService.getWeatherData(segment.latitude, segment.longitude);
          
          // Get historical weather patterns
          const historicalData = await this.getHistoricalWeatherPatterns(segment.latitude, segment.longitude);
          
          const weatherCondition = new WeatherCondition({
            routeId: route._id,
            latitude: segment.latitude,
            longitude: segment.longitude,
            season: this.getCurrentSeason(),
            weatherCondition: this.mapWeatherCondition(currentWeather.condition),
            averageTemperature: currentWeather.temperature,
            precipitationMm: historicalData.averagePrecipitation || 0,
            windSpeedKmph: currentWeather.windSpeed,
            visibilityKm: currentWeather.visibility,
            roadSurfaceCondition: this.determineSurfaceCondition(currentWeather),
            riskScore: this.assessWeatherRisk(currentWeather),
            dataYear: new Date().getFullYear(),
            distanceFromStartKm: this.calculateDistanceFromStart(route.routePoints, segment),
            humidity: currentWeather.humidity || 0,
            pressure: currentWeather.pressure || 0,
            uvIndex: historicalData.averageUvIndex || 0,
            monsoonRisk: this.assessMonsoonRisk(segment.latitude, segment.longitude),
            extremeWeatherHistory: historicalData.extremeEvents || []
          });
          
          await weatherCondition.save();
          weatherPoints.push(weatherCondition);
          
        } catch (weatherError) {
          console.warn('Failed to get weather for segment:', weatherError.message);
        }
      }
      
      return {
        total: weatherPoints.length,
        averageTemp: weatherPoints.reduce((sum, w) => sum + w.averageTemperature, 0) / weatherPoints.length || 0,
        averageRisk: weatherPoints.reduce((sum, w) => sum + w.riskScore, 0) / weatherPoints.length || 0,
        conditions: [...new Set(weatherPoints.map(w => w.weatherCondition))],
        riskAreas: weatherPoints.filter(w => w.riskScore > 6).length,
        monsoonRiskAreas: weatherPoints.filter(w => w.monsoonRisk > 5).length
      };
      
    } catch (error) {
      console.error('Enhanced weather data collection failed:', error);
      throw error;
    }
  }

  // Helper Methods
  
  createRouteSegments(routePoints, numberOfSegments) {
    const segments = [];
    const step = Math.max(1, Math.floor(routePoints.length / numberOfSegments));
    
    for (let i = 0; i < routePoints.length; i += step) {
      segments.push(routePoints[i]);
    }
    
    return segments;
  }

  calculateDistanceFromStart(routePoints, targetPoint) {
    if (!routePoints || routePoints.length === 0) return 0;
    
    // Find the nearest route point
    let minDistance = Infinity;
    let nearestPointIndex = 0;
    
    for (let i = 0; i < routePoints.length; i++) {
      const distance = this.calculateDistance(
        routePoints[i].latitude, routePoints[i].longitude,
        targetPoint.latitude, targetPoint.longitude
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPointIndex = i;
      }
    }
    
    // Return distance from start to nearest point
    return routePoints[nearestPointIndex].distanceFromStart || 0;
  }

  calculateDistanceFromRoute(routePoints, targetPoint) {
    if (!routePoints || routePoints.length === 0) return 0;
    
    let minDistance = Infinity;
    
    for (const point of routePoints) {
      const distance = this.calculateDistance(
        point.latitude, point.longitude,
        targetPoint.latitude, targetPoint.longitude
      );
      
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    
    return minDistance;
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

  async getPlaceDetails(placeId) {
    try {
      // Mock implementation - would use Google Places Details API
      return {
        phoneNumber: '+91-' + Math.floor(Math.random() * 10000000000),
        address: 'Address not available',
        operatingHours: 'Hours not available',
        website: '',
        accessibility: 'Unknown',
        amenities: []
      };
    } catch (error) {
      return {
        phoneNumber: 'Not available',
        address: 'Address not available',
        operatingHours: 'Hours not available'
      };
    }
  }

  mapEmergencyServiceType(serviceKey) {
    const mapping = {
      'hospital': 'hospital',
      'emergency_room': 'hospital',
      'clinic': 'hospital',
      'pharmacy': 'hospital'
    };
    return mapping[serviceKey] || 'hospital';
  }

  getEmergencyNumber(serviceType) {
    const emergencyNumbers = {
      'hospital': '108',
      'emergency_room': '108',
      'clinic': '108',
      'pharmacy': '108'
    };
    return emergencyNumbers[serviceType] || '108';
  }

  getServicesOffered(serviceType) {
    const services = {
      'hospital': ['Emergency Care', 'Surgery', 'Diagnostics', 'Pharmacy'],
      'emergency_room': ['Emergency Care', 'Trauma Care', 'Ambulance'],
      'clinic': ['General Medicine', 'Consultation', 'Basic Treatment'],
      'pharmacy': ['Medicines', 'Medical Supplies', 'Health Products']
    };
    return services[serviceType] || ['General Services'];
  }

  estimateResponseTime(distance, serviceType) {
    const baseTime = {
      'hospital': 15,
      'police': 10,
      'fire_station': 12
    };
    
    const base = baseTime[serviceType] || 15;
    return Math.round(base + (distance * 2));
  }

  calculateAvailabilityScore(service, distance) {
    let score = 8;
    if (distance > 20) score -= 3;
    else if (distance > 10) score -= 1;
    if (service.rating) score = Math.round((score + service.rating) / 2);
    return Math.max(1, Math.min(10, score));
  }

  calculateAverageDistance(services) {
    if (services.length === 0) return 0;
    return services.reduce((sum, s) => sum + (s.distanceFromRouteKm || 0), 0) / services.length;
  }

  assessCoverage(services, totalDistance) {
    if (services.length === 0) return 'none';
    const coverage = (services.length / (totalDistance / 50)) * 100; // Services per 50km
    if (coverage > 80) return 'excellent';
    if (coverage > 60) return 'good';
    if (coverage > 40) return 'fair';
    return 'poor';
  }

  processResult(result) {
    return result.status === 'fulfilled' ? result.value : { error: result.reason?.message };
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

  // Additional helper methods for enhanced data collection
  
  getFuelTypes(serviceKey) {
    const fuelTypes = {
      'gas_station': ['Petrol', 'Diesel', 'CNG'],
      'car_repair': [],
      'car_dealer': [],
      'tire_shop': []
    };
    return fuelTypes[serviceKey] || [];
  }

  getVehicleServices(serviceKey) {
    const services = {
      'gas_station': ['Fuel', 'Basic Maintenance', 'Car Wash'],
      'car_repair': ['Engine Repair', 'Electrical', 'Body Work', 'Towing'],
      'car_dealer': ['Sales', 'Service', 'Parts'],
      'tire_shop': ['Tire Replacement', 'Wheel Alignment', 'Balancing']
    };
    return services[serviceKey] || [];
  }

  // File: services/dataCollectionService.js - Part 2 (Continuation)
// Purpose: Enhanced comprehensive route data collection - Part 2
// Continuation from checkIfOpen24Hours method

  checkIfOpen24Hours(operatingHours) {
    if (!operatingHours) return false;
    return operatingHours.toLowerCase().includes('24') || 
           operatingHours.toLowerCase().includes('always open');
  }

  determineJurisdiction(latitude, longitude) {
    // Simplified jurisdiction determination based on coordinates
    // In real implementation, this would query administrative boundaries
    return 'Local Police';
  }

  getSpecializedUnits(serviceKey) {
    const units = {
      'police': ['Traffic Police', 'Emergency Response', 'Crime Investigation'],
      'courthouse': ['Judicial Services', 'Legal Aid'],
      'prison': ['Correctional Services']
    };
    return units[serviceKey] || ['General Services'];
  }

  getFireEquipment(serviceKey) {
    const equipment = {
      'fire_station': ['Fire Trucks', 'Ambulances', 'Rescue Equipment', 'Hazmat Gear'],
      'ambulance_service': ['Ambulances', 'Medical Equipment', 'Emergency Supplies']
    };
    return equipment[serviceKey] || ['Basic Equipment'];
  }

  getFireSpecializations() {
    return ['Structure Fire', 'Vehicle Fire', 'Wildfire', 'Hazardous Materials', 'Water Rescue'];
  }

  async getHistoricalWeatherPatterns(latitude, longitude) {
    try {
      // Mock historical weather data - would integrate with weather APIs
      return {
        averagePrecipitation: Math.random() * 100,
        averageUvIndex: Math.random() * 10,
        extremeEvents: ['Heavy Rain (2023)', 'Hailstorm (2022)']
      };
    } catch (error) {
      return {
        averagePrecipitation: 50,
        averageUvIndex: 5,
        extremeEvents: []
      };
    }
  }

  assessMonsoonRisk(latitude, longitude) {
    // Assess monsoon risk based on geographical location
    // Higher risk for areas prone to monsoons
    const monsoonProneRegions = [
      { lat: 28, lng: 77, risk: 7 }, // Delhi NCR region
      { lat: 19, lng: 72, risk: 8 }, // Mumbai region
    ];
    
    let risk = 5; // Default moderate risk
    
    for (const region of monsoonProneRegions) {
      const distance = this.calculateDistance(latitude, longitude, region.lat, region.lng);
      if (distance < 100) { // Within 100km of monsoon-prone region
        risk = region.risk;
        break;
      }
    }
    
    return risk;
  }

  // 6. EDUCATIONAL INSTITUTIONS
  async collectEducationalInstitutions(route) {
    try {
      console.log('🎓 Collecting educational institutions...');
      
      const institutions = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 10);
      
      for (const segment of routeSegments) {
        for (const [serviceKey, config] of Object.entries(this.serviceCategories.educational)) {
          try {
            const nearbyInstitutions = await apiService.findNearbyPlaces(
              segment.latitude,
              segment.longitude,
              serviceKey,
              config.radius
            );
            
            for (const institution of nearbyInstitutions.slice(0, 3)) {
              const distanceFromStart = this.calculateDistanceFromStart(route.routePoints, institution);
              const distanceFromEnd = route.totalDistance - distanceFromStart;
              const distanceFromRoute = this.calculateDistanceFromRoute(route.routePoints, institution);
              
              const institutionDetails = await this.getPlaceDetails(institution.placeId);
              
              const educationalInstitution = {
                routeId: route._id,
                serviceType: 'educational',
                name: institution.name,
                latitude: institution.latitude,
                longitude: institution.longitude,
                phoneNumber: institutionDetails.phoneNumber || 'Not available',
                address: institutionDetails.address || institution.vicinity,
                operatingHours: institutionDetails.operatingHours || 'School hours',
                distanceFromRouteKm: distanceFromRoute,
                distanceFromStartKm: distanceFromStart,
                distanceFromEndKm: distanceFromEnd,
                priority: config.priority,
                rating: institution.rating || 0,
                institutionType: this.getInstitutionType(serviceKey),
                studentCapacity: this.estimateStudentCapacity(serviceKey),
                safetyFeatures: this.getEducationalSafetyFeatures(),
                emergencyContact: institutionDetails.phoneNumber || 'Not available'
              };
              
              // Store as custom data structure or in a dedicated collection
              institutions.push(educationalInstitution);
            }
          } catch (serviceError) {
            console.warn(`Failed to get ${serviceKey} institutions:`, serviceError.message);
          }
        }
      }
      
      return {
        total: institutions.length,
        schools: institutions.filter(i => i.institutionType === 'school').length,
        universities: institutions.filter(i => i.institutionType === 'university').length,
        colleges: institutions.filter(i => i.institutionType === 'college').length,
        averageDistance: this.calculateAverageDistance(institutions),
        coverage: this.assessCoverage(institutions, route.totalDistance)
      };
      
    } catch (error) {
      console.error('Educational institutions collection failed:', error);
      throw error;
    }
  }

  // 7. FOOD & REST STOPS
  async collectFoodRestStops(route) {
    try {
      console.log('🍽️ Collecting food & rest stops...');
      
      const stops = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 20);
      
      for (const segment of routeSegments) {
        for (const [serviceKey, config] of Object.entries(this.serviceCategories.foodRest)) {
          try {
            const nearbyStops = await apiService.findNearbyPlaces(
              segment.latitude,
              segment.longitude,
              serviceKey,
              config.radius
            );
            
            for (const stop of nearbyStops.slice(0, 3)) {
              const distanceFromStart = this.calculateDistanceFromStart(route.routePoints, stop);
              const distanceFromEnd = route.totalDistance - distanceFromStart;
              const distanceFromRoute = this.calculateDistanceFromRoute(route.routePoints, stop);
              
              const stopDetails = await this.getPlaceDetails(stop.placeId);
              
              const foodRestStop = {
                routeId: route._id,
                serviceType: 'amenity',
                name: stop.name,
                latitude: stop.latitude,
                longitude: stop.longitude,
                phoneNumber: stopDetails.phoneNumber || 'Not available',
                address: stopDetails.address || stop.vicinity,
                operatingHours: stopDetails.operatingHours || 'Restaurant hours',
                distanceFromRouteKm: distanceFromRoute,
                distanceFromStartKm: distanceFromStart,
                distanceFromEndKm: distanceFromEnd,
                priority: config.priority,
                rating: stop.rating || 0,
                priceLevel: stop.priceLevel || 0,
                stopType: this.getStopType(serviceKey),
                cuisineType: this.getCuisineType(stop.name),
                amenities: this.getFoodAmenities(serviceKey),
                parkingAvailable: this.estimateParkingAvailability(serviceKey),
                truckFriendly: this.assessTruckFriendliness(serviceKey),
                restFacilities: this.getRestFacilities(serviceKey)
              };
              
              stops.push(foodRestStop);
            }
          } catch (serviceError) {
            console.warn(`Failed to get ${serviceKey} stops:`, serviceError.message);
          }
        }
      }
      
      return {
        total: stops.length,
        restaurants: stops.filter(s => s.stopType === 'restaurant').length,
        cafes: stops.filter(s => s.stopType === 'cafe').length,
        lodging: stops.filter(s => s.stopType === 'lodging').length,
        truckStops: stops.filter(s => s.truckFriendly).length,
        averageDistance: this.calculateAverageDistance(stops),
        coverage: this.assessCoverage(stops, route.totalDistance)
      };
      
    } catch (error) {
      console.error('Food & rest stops collection failed:', error);
      throw error;
    }
  }

  // 8. FINANCIAL SERVICES
  async collectFinancialServices(route) {
    try {
      console.log('🏦 Collecting financial services...');
      
      const services = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 15);
      
      for (const segment of routeSegments) {
        for (const [serviceKey, config] of Object.entries(this.serviceCategories.financial)) {
          try {
            const nearbyServices = await apiService.findNearbyPlaces(
              segment.latitude,
              segment.longitude,
              serviceKey,
              config.radius
            );
            
            for (const service of nearbyServices.slice(0, 2)) {
              const distanceFromStart = this.calculateDistanceFromStart(route.routePoints, service);
              const distanceFromEnd = route.totalDistance - distanceFromStart;
              const distanceFromRoute = this.calculateDistanceFromRoute(route.routePoints, service);
              
              const serviceDetails = await this.getPlaceDetails(service.placeId);
              
              const financialService = {
                routeId: route._id,
                serviceType: 'amenity',
                name: service.name,
                latitude: service.latitude,
                longitude: service.longitude,
                phoneNumber: serviceDetails.phoneNumber || 'Not available',
                address: serviceDetails.address || service.vicinity,
                operatingHours: serviceDetails.operatingHours || 'Banking hours',
                distanceFromRouteKm: distanceFromRoute,
                distanceFromStartKm: distanceFromStart,
                distanceFromEndKm: distanceFromEnd,
                priority: config.priority,
                rating: service.rating || 0,
                serviceType: this.getFinancialServiceType(serviceKey),
                servicesOffered: this.getFinancialServices(serviceKey),
                atmAvailable: serviceKey === 'atm' || serviceKey === 'bank',
                currencies: ['INR'],
                accessibleHours: this.getAccessibleHours(serviceKey)
              };
              
              services.push(financialService);
            }
          } catch (serviceError) {
            console.warn(`Failed to get ${serviceKey} services:`, serviceError.message);
          }
        }
      }
      
      return {
        total: services.length,
        banks: services.filter(s => s.serviceType === 'bank').length,
        atms: services.filter(s => s.serviceType === 'atm').length,
        postOffices: services.filter(s => s.serviceType === 'post_office').length,
        averageDistance: this.calculateAverageDistance(services),
        coverage: this.assessCoverage(services, route.totalDistance)
      };
      
    } catch (error) {
      console.error('Financial services collection failed:', error);
      throw error;
    }
  }

  // 9. TRANSPORTATION HUBS
  async collectTransportationHubs(route) {
    try {
      console.log('🚌 Collecting transportation hubs...');
      
      const hubs = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 8);
      
      for (const segment of routeSegments) {
        for (const [serviceKey, config] of Object.entries(this.serviceCategories.transportation)) {
          try {
            const nearbyHubs = await apiService.findNearbyPlaces(
              segment.latitude,
              segment.longitude,
              serviceKey,
              config.radius
            );
            
            for (const hub of nearbyHubs.slice(0, 2)) {
              const distanceFromStart = this.calculateDistanceFromStart(route.routePoints, hub);
              const distanceFromEnd = route.totalDistance - distanceFromStart;
              const distanceFromRoute = this.calculateDistanceFromRoute(route.routePoints, hub);
              
              const hubDetails = await this.getPlaceDetails(hub.placeId);
              
              const transportationHub = {
                routeId: route._id,
                serviceType: 'transport',
                name: hub.name,
                latitude: hub.latitude,
                longitude: hub.longitude,
                phoneNumber: hubDetails.phoneNumber || 'Not available',
                address: hubDetails.address || hub.vicinity,
                operatingHours: hubDetails.operatingHours || 'Transport hours',
                distanceFromRouteKm: distanceFromRoute,
                distanceFromStartKm: distanceFromStart,
                distanceFromEndKm: distanceFromEnd,
                priority: config.priority,
                rating: hub.rating || 0,
                hubType: this.getTransportationType(serviceKey),
                transportModes: this.getTransportModes(serviceKey),
                connectivity: this.assessConnectivity(serviceKey),
                facilities: this.getTransportFacilities(serviceKey),
                emergencyContact: hubDetails.phoneNumber || 'Not available'
              };
              
              hubs.push(transportationHub);
            }
          } catch (serviceError) {
            console.warn(`Failed to get ${serviceKey} hubs:`, serviceError.message);
          }
        }
      }
      
      return {
        total: hubs.length,
        busStations: hubs.filter(h => h.hubType === 'bus_station').length,
        trainStations: hubs.filter(h => h.hubType === 'train_station').length,
        airports: hubs.filter(h => h.hubType === 'airport').length,
        taxiStands: hubs.filter(h => h.hubType === 'taxi_stand').length,
        averageDistance: this.calculateAverageDistance(hubs),
        coverage: this.assessCoverage(hubs, route.totalDistance)
      };
      
    } catch (error) {
      console.error('Transportation hubs collection failed:', error);
      throw error;
    }
  }

  // 10. DETAILED TRAFFIC DATA COLLECTION
  async collectDetailedTrafficData(route) {
    try {
      console.log('🚗 Collecting detailed traffic data...');
      
      const trafficPoints = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 25);
      
      for (const segment of routeSegments) {
        try {
          const trafficData = await apiService.getTrafficData(segment.latitude, segment.longitude);
          
          const traffic = new TrafficData({
            routeId: route._id,
            latitude: segment.latitude,
            longitude: segment.longitude,
            peakHourTrafficCount: Math.round(trafficData.currentSpeed * 10),
            averageSpeedKmph: trafficData.currentSpeed,
            congestionLevel: this.determineCongestionLevel(trafficData),
            bottleneckCauses: this.identifyBottlenecks(trafficData),
            alternativeRoutesAvailable: this.checkAlternativeRoutes(segment),
            riskScore: Math.max(1, this.calculateTrafficRiskScore(trafficData)),
            measurementTime: new Date(),
            distanceFromStartKm: this.calculateDistanceFromStart(route.routePoints, segment),
            speedLimit: this.estimateSpeedLimit(segment),
            roadType: this.determineRoadType(segment),
            trafficLights: this.estimateTrafficLights(segment),
            tollPoints: this.identifyTollPoints(segment),
            constructionZones: this.identifyConstructionZones(segment)
          });
          
          await traffic.save();
          trafficPoints.push(traffic);
          
        } catch (trafficError) {
          console.warn('Failed to get traffic for segment:', trafficError.message);
        }
      }
      
      return {
        total: trafficPoints.length,
        averageSpeed: trafficPoints.length > 0 ? 
          trafficPoints.reduce((sum, t) => sum + t.averageSpeedKmph, 0) / trafficPoints.length : 0,
        congestionAreas: trafficPoints.filter(t => ['heavy', 'severe'].includes(t.congestionLevel)).length,
        averageRisk: trafficPoints.length > 0 ? 
          trafficPoints.reduce((sum, t) => sum + t.riskScore, 0) / trafficPoints.length : 0,
        tollPoints: trafficPoints.filter(t => t.tollPoints > 0).length,
        constructionZones: trafficPoints.filter(t => t.constructionZones > 0).length
      };
      
    } catch (error) {
      console.error('Detailed traffic data collection failed:', error);
      throw error;
    }
  }

  // 11. ENHANCED ROAD CONDITIONS
  async collectEnhancedRoadConditions(route) {
    try {
      console.log('🛣️ Collecting enhanced road conditions...');
      
      const roadConditions = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 30);
      
      for (const segment of routeSegments) {
        try {
          const roadQuality = this.assessDetailedRoadQuality(segment, route);
          
          const roadCondition = new RoadCondition({
            routeId: route._id,
            latitude: segment.latitude,
            longitude: segment.longitude,
            roadType: this.determineDetailedRoadType(route.majorHighways, segment),
            surfaceQuality: roadQuality.surface,
            widthMeters: roadQuality.width,
            laneCount: roadQuality.lanes,
            hasPotholes: roadQuality.potholes,
            underConstruction: roadQuality.construction,
            riskScore: roadQuality.riskScore,
            dataSource: 'ENHANCED_ROUTE_ANALYSIS',
            distanceFromStartKm: this.calculateDistanceFromStart(route.routePoints, segment),
            shoulderWidth: roadQuality.shoulderWidth,
            medianPresent: roadQuality.median,
            lightingQuality: roadQuality.lighting,
            drainageQuality: roadQuality.drainage,
            bridgesCulverts: roadQuality.bridges,
            slopeGradient: roadQuality.slope
          });
          
          await roadCondition.save();
          roadConditions.push(roadCondition);
          
        } catch (roadError) {
          console.warn('Failed to assess road condition for segment:', roadError.message);
        }
      }
      
      return {
        total: roadConditions.length,
        averageRisk: roadConditions.reduce((sum, r) => sum + r.riskScore, 0) / roadConditions.length || 0,
        poorConditions: roadConditions.filter(r => ['poor', 'critical'].includes(r.surfaceQuality)).length,
        constructionZones: roadConditions.filter(r => r.underConstruction).length,
        potholeAreas: roadConditions.filter(r => r.hasPotholes).length,
        bridgesCulverts: roadConditions.filter(r => r.bridgesCulverts > 0).length
      };
      
    } catch (error) {
      console.error('Enhanced road conditions collection failed:', error);
      throw error;
    }
  }

  // 12. COMPREHENSIVE ACCIDENT-PRONE AREAS
  async collectAccidentProneAreas(route) {
    try {
      console.log('⚠️ Collecting detailed accident-prone area data...');
      
      const accidentAreas = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 20);
      
      for (const segment of routeSegments) {
        try {
          // Enhanced accident risk analysis
          const riskFactors = await this.analyzeAccidentRiskFactors(segment, route);
          
          if (riskFactors.overallRisk > 5) { // Only save significant risk areas
            const accidentArea = new AccidentProneArea({
              routeId: route._id,
              latitude: segment.latitude,
              longitude: segment.longitude,
              accidentFrequencyYearly: riskFactors.estimatedFrequency,
              accidentSeverity: riskFactors.severity,
              commonAccidentTypes: riskFactors.accidentTypes,
              contributingFactors: riskFactors.contributingFactors,
              riskScore: riskFactors.overallRisk,
              dataSource: 'COMPREHENSIVE_ANALYSIS',
              distanceFromStartKm: this.calculateDistanceFromStart(route.routePoints, segment),
              timeOfDayRisk: riskFactors.timeRisks,
              weatherRelatedRisk: riskFactors.weatherRisk,
              infrastructureRisk: riskFactors.infrastructureRisk,
              trafficVolumeRisk: riskFactors.trafficRisk
            });
            
            await accidentArea.save();
            accidentAreas.push(accidentArea);
          }
          
        } catch (accidentError) {
          console.warn('Failed to analyze accident risk for segment:', accidentError.message);
        }
      }
      
      return {
        total: accidentAreas.length,
        highRiskAreas: accidentAreas.filter(a => a.riskScore > 7).length,
        mediumRiskAreas: accidentAreas.filter(a => a.riskScore >= 5 && a.riskScore <= 7).length,
        averageRisk: accidentAreas.length > 0 ? 
          accidentAreas.reduce((sum, a) => sum + a.riskScore, 0) / accidentAreas.length : 0,
        fatalAccidentZones: accidentAreas.filter(a => a.accidentSeverity === 'fatal').length,
        weatherRelatedZones: accidentAreas.filter(a => a.weatherRelatedRisk > 6).length
      };
      
    } catch (error) {
      console.error('Accident-prone areas collection failed:', error);
      throw error;
    }
  }

  // Additional helper methods for enhanced functionality

  getInstitutionType(serviceKey) {
    const types = {
      'school': 'school',
      'university': 'university',
      'college': 'college'
    };
    return types[serviceKey] || 'educational';
  }

  estimateStudentCapacity(serviceKey) {
    const capacities = {
      'school': Math.floor(Math.random() * 1000) + 500,
      'university': Math.floor(Math.random() * 10000) + 5000,
      'college': Math.floor(Math.random() * 5000) + 2000
    };
    return capacities[serviceKey] || 1000;
  }

  getEducationalSafetyFeatures() {
    return ['Security Guards', 'CCTV', 'Emergency Exits', 'Fire Safety', 'Medical Room'];
  }

  getStopType(serviceKey) {
    const types = {
      'restaurant': 'restaurant',
      'food': 'restaurant',
      'meal_delivery': 'restaurant',
      'cafe': 'cafe',
      'lodging': 'lodging'
    };
    return types[serviceKey] || 'food_service';
  }

  getCuisineType(name) {
    if (name.toLowerCase().includes('chinese')) return 'Chinese';
    if (name.toLowerCase().includes('pizza')) return 'Italian';
    if (name.toLowerCase().includes('dhaba')) return 'Indian';
    if (name.toLowerCase().includes('mc') || name.toLowerCase().includes('kfc')) return 'Fast Food';
    return 'Multi-cuisine';
  }

  getFoodAmenities(serviceKey) {
    const amenities = {
      'restaurant': ['Dining', 'Parking', 'Restrooms', 'AC'],
      'lodging': ['Rooms', 'Restaurant', 'Parking', 'WiFi', 'AC'],
      'cafe': ['Coffee', 'Snacks', 'WiFi', 'Seating']
    };
    return amenities[serviceKey] || ['Basic Facilities'];
  }

  estimateParkingAvailability(serviceKey) {
    const parking = {
      'restaurant': true,
      'lodging': true,
      'cafe': Math.random() > 0.5
    };
    return parking[serviceKey] || false;
  }

  assessTruckFriendliness(serviceKey) {
    return serviceKey === 'lodging' || Math.random() > 0.7;
  }

  getRestFacilities(serviceKey) {
    const facilities = {
      'restaurant': ['Restrooms', 'Seating'],
      'lodging': ['Rooms', 'Restrooms', 'Common Area'],
      'cafe': ['Seating', 'Restrooms']
    };
    return facilities[serviceKey] || ['Basic Facilities'];
  }

  calculateTrafficRiskScore(trafficData) {
    const speedRatio = trafficData.currentSpeed / (trafficData.freeFlowSpeed || 60);
    const riskScore = Math.round((1 - speedRatio) * 10);
    return Math.max(1, Math.min(10, riskScore));
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

  // Method to analyze comprehensive accident risk factors
  async analyzeAccidentRiskFactors(segment, route) {
    const factors = {
      overallRisk: 5,
      estimatedFrequency: Math.floor(Math.random() * 10) + 1,
      severity: Math.random() > 0.7 ? 'major' : 'minor',
      accidentTypes: ['collision', 'overtaking'],
      contributingFactors: ['traffic_density', 'road_conditions'],
      timeRisks: { night: 7, day: 4, peak: 6 },
      weatherRisk: 6,
      infrastructureRisk: 5,
      trafficRisk: 6
    };

    // Enhance risk based on route characteristics
    if (route.terrain === 'hilly') {
      factors.overallRisk += 2;
      factors.contributingFactors.push('steep_slopes');
    }

    if (route.terrain === 'rural') {
      factors.overallRisk += 1;
      factors.contributingFactors.push('limited_lighting');
    }

    return factors;
  }

   getFinancialServiceType(serviceKey) {
    const types = {
      'bank': 'bank',
      'atm': 'atm',
      'post_office': 'post_office'
    };
    return types[serviceKey] || 'financial';
  }

  getFinancialServices(serviceKey) {
    const services = {
      'bank': ['Cash Withdrawal', 'Deposits', 'Money Transfer', 'Account Services'],
      'atm': ['Cash Withdrawal', 'Balance Inquiry', 'Mini Statement'],
      'post_office': ['Mail Services', 'Money Order', 'Savings Account', 'Insurance']
    };
    return services[serviceKey] || ['Basic Services'];
  }

  getAccessibleHours(serviceKey) {
    const hours = {
      'bank': '10:00 AM - 4:00 PM',
      'atm': '24/7',
      'post_office': '10:00 AM - 5:00 PM'
    };
    return hours[serviceKey] || 'Business Hours';
  }

  // Transportation Helper Methods
  getTransportationType(serviceKey) {
    const types = {
      'bus_station': 'bus_station',
      'train_station': 'train_station',
      'airport': 'airport',
      'taxi_stand': 'taxi_stand'
    };
    return types[serviceKey] || 'transport';
  }

  getTransportModes(serviceKey) {
    const modes = {
      'bus_station': ['Local Bus', 'Interstate Bus', 'Private Bus'],
      'train_station': ['Local Train', 'Express Train', 'Passenger Train'],
      'airport': ['Domestic Flights', 'International Flights'],
      'taxi_stand': ['Local Taxi', 'Auto Rickshaw', 'Cab Services']
    };
    return modes[serviceKey] || ['General Transport'];
  }

  assessConnectivity(serviceKey) {
    const connectivity = {
      'bus_station': 'Regional',
      'train_station': 'National',
      'airport': 'International',
      'taxi_stand': 'Local'
    };
    return connectivity[serviceKey] || 'Local';
  }

  getTransportFacilities(serviceKey) {
    const facilities = {
      'bus_station': ['Waiting Area', 'Ticket Counter', 'Restrooms', 'Food Court'],
      'train_station': ['Platform', 'Booking Office', 'Waiting Room', 'Parking'],
      'airport': ['Terminal', 'Check-in', 'Security', 'Lounges', 'Duty Free'],
      'taxi_stand': ['Waiting Area', 'Fare Chart', 'Phone Booking']
    };
    return facilities[serviceKey] || ['Basic Facilities'];
  }

  // Traffic Analysis Helper Methods
  checkAlternativeRoutes(segment) {
    // Mock implementation - would use routing APIs to check alternative paths
    return Math.random() > 0.6;
  }

  estimateSpeedLimit(segment) {
    // Estimate speed limit based on area type and coordinates
    const speedLimits = [40, 50, 60, 80, 100];
    return speedLimits[Math.floor(Math.random() * speedLimits.length)];
  }

  determineRoadType(segment) {
    // Determine road type based on segment characteristics
    const roadTypes = ['highway', 'arterial', 'collector', 'local'];
    return roadTypes[Math.floor(Math.random() * roadTypes.length)];
  }

  estimateTrafficLights(segment) {
    // Estimate number of traffic lights in the segment area
    return Math.floor(Math.random() * 3);
  }

  identifyTollPoints(segment) {
    // Identify potential toll points
    return Math.random() > 0.8 ? 1 : 0;
  }

  identifyConstructionZones(segment) {
    // Identify construction zones
    return Math.random() > 0.9 ? 1 : 0;
  }

  // Enhanced Road Condition Assessment
  assessDetailedRoadQuality(segment, route) {
    let riskScore = 5;
    
    // Adjust based on route characteristics
    if (route.terrain === 'hilly') riskScore += 1;
    if (route.terrain === 'rural') riskScore += 2;
    if (route.majorHighways?.some(h => h.startsWith('NH'))) riskScore -= 1;
    
    const roadQuality = {
      surface: riskScore > 6 ? 'poor' : riskScore > 4 ? 'fair' : 'good',
      width: route.majorHighways?.length > 0 ? 7.5 : 3.5,
      lanes: route.majorHighways?.length > 0 ? 2 : 1,
      potholes: riskScore > 6,
      construction: Math.random() > 0.9,
      riskScore: Math.max(1, Math.min(10, riskScore)),
      shoulderWidth: Math.random() * 2 + 1, // 1-3 meters
      median: route.majorHighways?.length > 0 && Math.random() > 0.5,
      lighting: this.assessLightingQuality(segment),
      drainage: this.assessDrainageQuality(riskScore),
      bridges: Math.random() > 0.8 ? 1 : 0,
      slope: this.calculateSlopeGradient(segment, route)
    };
    
    return roadQuality;
  }

  determineDetailedRoadType(majorHighways, segment) {
    if (!majorHighways || majorHighways.length === 0) return 'rural';
    if (majorHighways.some(h => h.startsWith('NH'))) return 'highway';
    if (majorHighways.some(h => h.startsWith('SH'))) return 'state';
    return 'district';
  }

  assessLightingQuality(segment) {
    // Assess lighting quality based on area type
    const lightingLevels = ['poor', 'fair', 'good', 'excellent'];
    return lightingLevels[Math.floor(Math.random() * lightingLevels.length)];
  }

  assessDrainageQuality(riskScore) {
    // Assess drainage quality based on risk score
    if (riskScore > 7) return 'poor';
    if (riskScore > 5) return 'fair';
    return 'good';
  }

  calculateSlopeGradient(segment, route) {
    // Calculate slope gradient for hilly terrain
    if (route.terrain === 'hilly') {
      return Math.random() * 8 + 2; // 2-10% gradient
    }
    return Math.random() * 3; // 0-3% gradient for flat terrain
  }

  // 13. COMPREHENSIVE NETWORK COVERAGE ANALYSIS
  async collectNetworkCoverage(route) {
    try {
      console.log('📶 Analyzing comprehensive network coverage...');
      
      const coverageAnalysis = {
        routeId: route._id,
        totalDistance: route.totalDistance,
        terrain: route.terrain,
        estimatedDeadZones: this.estimateDeadZones(route),
        coverageQuality: this.assessOverallCoverage(route),
        riskScore: this.calculateNetworkRiskScore(route),
        cellTowerDensity: this.estimateCellTowerDensity(route),
        emergencyCommRisk: this.assessEmergencyCommRisk(route),
        alternativeCommMethods: this.getAlternativeCommMethods(),
        coverageByOperator: this.estimateCoverageByOperator(route),
        dataSpeedEstimate: this.estimateDataSpeeds(route),
        roamingConsiderations: this.getRoamingConsiderations(route)
      };
      
      return coverageAnalysis;
      
    } catch (error) {
      console.error('Network coverage analysis failed:', error);
      throw error;
    }
  }

  // 14. COMPREHENSIVE SECURITY ANALYSIS
  async collectSecurityAnalysis(route) {
    try {
      console.log('🔒 Conducting comprehensive security analysis...');
      
      const securityAnalysis = {
        routeId: route._id,
        overallSecurityRisk: this.calculateOverallSecurityRisk(route),
        crimeRiskAreas: this.identifyCrimeRiskAreas(route),
        isolatedAreas: this.identifyIsolatedAreas(route),
        lightingAssessment: this.assessRouteLighting(route),
        emergencyResponseTime: this.assessEmergencyResponseCapability(route),
        securityRecommendations: this.generateSecurityRecommendations(route),
        checkpoints: this.identifySecurityCheckpoints(route),
        safeHavens: this.identifySafeHavens(route),
        nightTravelRisk: this.assessNightTravelRisk(route),
        crimePrevention: this.getCrimePreventionMeasures()
      };
      
      return securityAnalysis;
      
    } catch (error) {
      console.error('Security analysis failed:', error);
      throw error;
    }
  }

  // Network Coverage Helper Methods
  estimateDeadZones(route) {
    let deadZones = Math.floor(route.totalDistance / 50); // Base estimate
    
    if (route.terrain === 'hilly') deadZones += 2;
    if (route.terrain === 'rural') deadZones += 1;
    if (route.terrain === 'urban') deadZones = Math.max(0, deadZones - 1);
    
    return deadZones;
  }

  assessOverallCoverage(route) {
    if (route.terrain === 'urban') return 'excellent';
    if (route.terrain === 'rural') return 'fair';
    if (route.terrain === 'hilly') return 'poor';
    return 'good';
  }

  calculateNetworkRiskScore(route) {
    let risk = 4; // Base risk
    
    if (route.terrain === 'rural') risk += 2;
    if (route.terrain === 'hilly') risk += 3;
    if (route.totalDistance > 200) risk += 1;
    if (route.terrain === 'urban') risk -= 1;
    
    return Math.max(1, Math.min(10, risk));
  }

  estimateCellTowerDensity(route) {
    const densities = {
      'urban': 'high',
      'rural': 'low',
      'hilly': 'very_low',
      'mixed': 'medium'
    };
    return densities[route.terrain] || 'medium';
  }

  assessEmergencyCommRisk(route) {
    const networkRisk = this.calculateNetworkRiskScore(route);
    if (networkRisk > 7) return 'high';
    if (networkRisk > 5) return 'medium';
    return 'low';
  }

  getAlternativeCommMethods() {
    return ['Satellite Phone', 'Two-way Radio', 'Emergency Beacons', 'Landline Phones'];
  }

  estimateCoverageByOperator(route) {
    return {
      'Airtel': this.getOperatorCoverage(route, 'airtel'),
      'Jio': this.getOperatorCoverage(route, 'jio'),
      'Vi': this.getOperatorCoverage(route, 'vi'),
      'BSNL': this.getOperatorCoverage(route, 'bsnl')
    };
  }

  getOperatorCoverage(route, operator) {
    // Mock operator coverage based on route characteristics
    const baseCoverage = route.terrain === 'urban' ? 95 : 
                        route.terrain === 'rural' ? 70 : 60;
    return Math.max(30, baseCoverage + (Math.random() * 20 - 10));
  }

  estimateDataSpeeds(route) {
    const speeds = {
      'urban': '4G+ (50-100 Mbps)',
      'rural': '3G/4G (5-25 Mbps)',
      'hilly': '2G/3G (1-10 Mbps)',
      'mixed': '3G/4G (10-50 Mbps)'
    };
    return speeds[route.terrain] || '3G/4G (10-30 Mbps)';
  }

  getRoamingConsiderations(route) {
    return {
      'stateChanges': this.identifyStateBoundaries(route),
      'internationalBorders': false, // Assuming domestic route
      'roamingCharges': 'Check with operator for interstate charges',
      'emergencyNumbers': ['112', '100', '101', '108']
    };
  }

  identifyStateBoundaries(route) {
    // Mock state boundary detection
    return route.totalDistance > 100 ? ['Possible state boundary crossing'] : [];
  }

  // Security Analysis Helper Methods
  calculateOverallSecurityRisk(route) {
    let risk = 4; // Base risk
    
    if (route.terrain === 'rural') risk += 2;
    if (route.terrain === 'urban') risk += 1;
    if (route.totalDistance > 300) risk += 1;
    if (route.terrain === 'hilly') risk += 1;
    
    return Math.max(1, Math.min(10, risk));
  }

  identifyCrimeRiskAreas(route) {
    const riskAreas = [];
    const segmentCount = Math.floor(route.totalDistance / 25);
    
    for (let i = 0; i < segmentCount; i++) {
      if (Math.random() > 0.8) { // 20% chance of risk area
        riskAreas.push({
          location: `${25 * i}-${25 * (i + 1)}km from start`,
          riskLevel: Math.random() > 0.5 ? 'medium' : 'high',
          crimeTypes: ['theft', 'robbery'],
          timeOfRisk: Math.random() > 0.5 ? 'night' : 'any'
        });
      }
    }
    
    return riskAreas;
  }

  identifyIsolatedAreas(route) {
    const isolatedAreas = [];
    
    if (route.terrain === 'rural' || route.terrain === 'hilly') {
      const areaCount = Math.floor(route.totalDistance / 40);
      for (let i = 0; i < areaCount; i++) {
        isolatedAreas.push({
          location: `${40 * i}-${40 * (i + 1)}km from start`,
          isolationLevel: route.terrain === 'hilly' ? 'high' : 'medium',
          nearestHelp: `${Math.floor(Math.random() * 20 + 10)}km away`
        });
      }
    }
    
    return isolatedAreas;
  }

  assessRouteLighting(route) {
    const lighting = {
      'urban': 'good',
      'rural': 'poor',
      'hilly': 'very_poor',
      'mixed': 'fair'
    };
    
    return {
      overallQuality: lighting[route.terrain] || 'fair',
      wellLitSections: route.terrain === 'urban' ? 80 : 20,
      poorlyLitSections: route.terrain === 'rural' ? 70 : 30,
      noLightingSections: route.terrain === 'hilly' ? 50 : 10
    };
  }

  assessEmergencyResponseCapability(route) {
    const responseTime = route.terrain === 'urban' ? '10-15 minutes' :
                        route.terrain === 'rural' ? '20-45 minutes' :
                        '30-60 minutes';
    
    return {
      averageResponseTime: responseTime,
      policeResponse: responseTime,
      medicalResponse: responseTime,
      fireResponse: responseTime,
      communicationReliability: route.terrain === 'urban' ? 'high' : 'medium'
    };
  }

  generateSecurityRecommendations(route) {
    const recommendations = [
      'Maintain constant communication with control room',
      'Carry emergency contact numbers',
      'Keep vehicle doors locked while driving'
    ];
    
    if (route.terrain === 'rural') {
      recommendations.push('Travel during daylight hours when possible');
      recommendations.push('Carry extra fuel and emergency supplies');
    }
    
    if (route.terrain === 'hilly') {
      recommendations.push('Use convoy travel for added security');
      recommendations.push('Inform authorities about travel plans');
    }
    
    if (route.totalDistance > 200) {
      recommendations.push('Plan rest stops at secure locations');
      recommendations.push('Carry satellite communication device');
    }
    
    return recommendations;
  }

  identifySecurityCheckpoints(route) {
    const checkpoints = [];
    const checkpointCount = Math.floor(route.totalDistance / 100);
    
    for (let i = 0; i < checkpointCount; i++) {
      checkpoints.push({
        location: `${100 * i}km from start`,
        type: Math.random() > 0.5 ? 'Police Checkpoint' : 'Toll Plaza',
        operatingHours: '24/7',
        contact: '+91-100'
      });
    }
    
    return checkpoints;
  }

  identifySafeHavens(route) {
    const safeHavens = [];
    const havenCount = Math.floor(route.totalDistance / 50);
    
    for (let i = 0; i < havenCount; i++) {
      safeHavens.push({
        location: `${50 * i}km from start`,
        type: Math.random() > 0.5 ? 'Police Station' : 'Government Office',
        facilities: ['Security', 'Communication', 'Rest Area'],
        contact: '+91-100'
      });
    }
    
    return safeHavens;
  }

  assessNightTravelRisk(route) {
    let nightRisk = 5; // Base risk
    
    if (route.terrain === 'rural') nightRisk += 3;
    if (route.terrain === 'hilly') nightRisk += 2;
    if (route.terrain === 'urban') nightRisk -= 1;
    if (route.totalDistance > 200) nightRisk += 1;
    
    return {
      riskScore: Math.max(1, Math.min(10, nightRisk)),
      riskLevel: nightRisk > 7 ? 'high' : nightRisk > 5 ? 'medium' : 'low',
      recommendations: nightRisk > 6 ? ['Avoid night travel', 'Use convoy', 'Extra security'] : 
                      ['Normal precautions', 'Maintain communication']
    };
  }

  getCrimePreventionMeasures() {
    return [
      'Install GPS tracking systems',
      'Use two-way radio communication',
      'Carry emergency alert devices',
      'Follow designated routes only',
      'Report suspicious activities immediately',
      'Keep emergency contact numbers accessible',
      'Maintain fuel levels above 50%',
      'Avoid isolated stops',
      'Travel in groups when possible'
    ];
  }

  // Final utility method for processing results
  processResult(result) {
    return result.status === 'fulfilled' ? result.value : { error: result.reason?.message };
  }

}

module.exports = new EnhancedDataCollectionService();