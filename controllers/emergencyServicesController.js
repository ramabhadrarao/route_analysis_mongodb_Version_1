// File: controllers/emergencyServicesController.js (ENHANCED VERSION)
// Purpose: Dynamic emergency services data from database models
// UPDATED: Uses real data from EmergencyService, Route, and related models

const EmergencyService = require('../models/EmergencyService');
const Route = require('../models/Route');
const BlindSpot = require('../models/BlindSpot');
const SharpTurn = require('../models/SharpTurn');
const AccidentProneArea = require('../models/AccidentProneArea');
const NetworkCoverage = require('../models/NetworkCoverage');

const emergencyServicesController = {

  // GET /api/routes/:routeId/emergency-services - ENHANCED WITH DYNAMIC DATA
  getEmergencyServices: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { serviceType, maxDistance = 50 } = req.query;
      
      // Get route information with validation
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      // Build dynamic query filter
      const query = { routeId };
      if (serviceType) {
        query.serviceType = serviceType;
      }
      
      // Add distance filter if specified
      if (maxDistance) {
        query.distanceFromRouteKm = { $lte: parseFloat(maxDistance) };
      }

      // Get emergency services from database
      const emergencyServices = await EmergencyService.find(query)
        .sort({ 
          serviceType: 1, 
          distanceFromRouteKm: 1, 
          priority: -1 
        });

      // Group services by type dynamically
      const servicesByType = {
        medical: emergencyServices.filter(service => 
          ['hospital', 'ambulance'].includes(service.serviceType)
        ),
        police: emergencyServices.filter(service => 
          service.serviceType === 'police'
        ),
        fire: emergencyServices.filter(service => 
          service.serviceType === 'fire_station'
        ),
        fuel: emergencyServices.filter(service => 
          service.serviceType === 'transport' && 
          service.fuelTypes && service.fuelTypes.length > 0
        ),
        educational: emergencyServices.filter(service => 
          service.serviceType === 'educational'
        ),
        amenities: emergencyServices.filter(service => 
          service.serviceType === 'amenity'
        )
      };

      // Generate dynamic coverage analysis based on route data
      const coverageAnalysis = await this.analyzeCoverageAdvanced(servicesByType, route);

      res.json({
        success: true,
        data: {
          route: {
            routeId: route.routeId,
            routeName: route.routeName,
            totalDistance: route.totalDistance,
            fromAddress: route.fromAddress,
            toAddress: route.toAddress
          },
          emergencyServices: servicesByType,
          coverageAnalysis: coverageAnalysis,
          summary: {
            totalServices: emergencyServices.length,
            medicalFacilities: servicesByType.medical.length,
            policeFacilities: servicesByType.police.length,
            fireFacilities: servicesByType.fire.length,
            fuelStations: servicesByType.fuel.length,
            educationalInstitutions: servicesByType.educational.length,
            amenities: servicesByType.amenities.length,
            searchRadius: `${maxDistance}km`,
            lastUpdated: new Date().toISOString()
          }
        },
        message: `Found ${emergencyServices.length} emergency services within ${maxDistance}km of route`
      });

    } catch (error) {
      console.error('Error fetching emergency services:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving emergency services',
        error: error.message
      });
    }
  },

  // GET /api/routes/:routeId/medical-facilities - ENHANCED WITH REAL DATA
  getMedicalFacilities: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { maxDistance = 30 } = req.query;
      
      // Get route data
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }
      
      // Get medical facilities from database
      const medicalFacilities = await EmergencyService.find({
        routeId,
        serviceType: { $in: ['hospital', 'ambulance'] },
        distanceFromRouteKm: { $lte: parseFloat(maxDistance) }
      }).sort({ distanceFromRouteKm: 1 });

      // Format medical facilities with dynamic data
      const formattedFacilities = medicalFacilities.map(facility => ({
        facilityName: facility.name,
        serviceType: facility.serviceType,
        location: facility.address || 'Address not available',
        distanceFromSupply: `${facility.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(facility.distanceFromStartKm, route.totalDistance)} km`,
        distanceFromRoute: `${facility.distanceFromRouteKm || 0} km`,
        coordinates: {
          lat: facility.latitude,
          lng: facility.longitude
        },
        phoneNumber: facility.phoneNumber || 'Not available',
        emergencyNumber: facility.emergencyNumber || facility.phoneNumber || 'Not available',
        mapLink: this.generateGoogleSearchLink(facility.name, facility.address),
        specializations: facility.specializations || [],
        emergencyServices: facility.emergencyServices || [],
        priority: facility.priority,
        isOpen24Hours: facility.isOpen24Hours || false,
        rating: facility.rating || 0,
        operatingHours: facility.operatingHours || 'Contact for hours',
        lastUpdated: facility.lastUpdated
      }));

      // Calculate dynamic statistics
      const statistics = this.calculateMedicalStatistics(formattedFacilities);

      res.json({
        success: true,
        data: {
          route: {
            routeId: route.routeId,
            routeName: route.routeName,
            totalDistance: route.totalDistance
          },
          medicalFacilities: formattedFacilities,
          summary: {
            totalFacilities: formattedFacilities.length,
            hospitalsWithin10km: formattedFacilities.filter(f => 
              parseFloat(f.distanceFromRoute.replace(' km', '')) <= 10
            ).length,
            twentyFourHourFacilities: formattedFacilities.filter(f => f.isOpen24Hours).length,
            averageDistance: statistics.averageDistance,
            nearestFacility: statistics.nearestFacility,
            highPriorityFacilities: formattedFacilities.filter(f => 
              ['critical', 'high'].includes(f.priority)
            ).length,
            searchRadius: `${maxDistance}km`
          }
        },
        message: `Found ${formattedFacilities.length} medical facilities within ${maxDistance}km`
      });

    } catch (error) {
      console.error('Error fetching medical facilities:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving medical facilities',
        error: error.message
      });
    }
  },

  // GET /api/routes/:routeId/police-stations - ENHANCED WITH REAL DATA
  getPoliceStations: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { maxDistance = 50 } = req.query;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }
      
      const policeStations = await EmergencyService.find({
        routeId,
        serviceType: 'police',
        distanceFromRouteKm: { $lte: parseFloat(maxDistance) }
      }).sort({ distanceFromRouteKm: 1 });

      const formattedStations = policeStations.map(station => ({
        facilityName: station.name,
        location: station.address || 'Address not available',
        distanceFromSupply: `${station.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(station.distanceFromStartKm, route.totalDistance)} km`,
        distanceFromRoute: `${station.distanceFromRouteKm || 0} km`,
        coordinates: {
          lat: station.latitude,
          lng: station.longitude
        },
        phoneNumber: station.phoneNumber || '--',
        emergencyNumber: station.emergencyNumber || '100',
        mapLink: this.generateGoogleMapsLink(station.latitude, station.longitude),
        jurisdiction: station.jurisdiction || 'Local',
        specializedUnits: station.specializedUnits || [],
        priority: station.priority,
        operatingHours: station.operatingHours || '24 hours',
        responseTimeMinutes: station.responseTimeMinutes || 20,
        lastUpdated: station.lastUpdated
      }));

      const statistics = this.calculatePoliceStatistics(formattedStations);

      res.json({
        success: true,
        data: {
          route: {
            routeId: route.routeId,
            routeName: route.routeName,
            totalDistance: route.totalDistance
          },
          policeStations: formattedStations,
          summary: {
            totalStations: formattedStations.length,
            stationsWithin20km: formattedStations.filter(s => 
              parseFloat(s.distanceFromRoute.replace(' km', '')) <= 20
            ).length,
            averageResponseTime: statistics.averageResponseTime,
            nearestStation: statistics.nearestStation,
            specializedUnits: statistics.specializedUnits,
            searchRadius: `${maxDistance}km`
          }
        },
        message: `Found ${formattedStations.length} police stations within ${maxDistance}km`
      });

    } catch (error) {
      console.error('Error fetching police stations:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving police stations',
        error: error.message
      });
    }
  },

  // GET /api/routes/:routeId/fire-stations - ENHANCED WITH REAL DATA
  getFireStations: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { maxDistance = 40 } = req.query;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }
      
      const fireStations = await EmergencyService.find({
        routeId,
        serviceType: 'fire_station',
        distanceFromRouteKm: { $lte: parseFloat(maxDistance) }
      }).sort({ distanceFromRouteKm: 1 });

      const formattedStations = fireStations.map(station => ({
        facilityName: station.name,
        location: station.address || 'Address not available',
        distanceFromSupply: `${station.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(station.distanceFromStartKm, route.totalDistance)} km`,
        distanceFromRoute: `${station.distanceFromRouteKm || 0} km`,
        coordinates: {
          lat: station.latitude,
          lng: station.longitude
        },
        phoneNumber: station.phoneNumber || '--',
        emergencyNumber: station.emergencyNumber || '101',
        mapLink: this.generateGoogleMapsLink(station.latitude, station.longitude),
        equipment: station.equipment || [],
        responseTimeMinutes: station.responseTimeMinutes || 20,
        operatingHours: station.operatingHours || '24 hours',
        priority: station.priority,
        lastUpdated: station.lastUpdated
      }));

      const statistics = this.calculateFireStatistics(formattedStations);

      res.json({
        success: true,
        data: {
          route: {
            routeId: route.routeId,
            routeName: route.routeName,
            totalDistance: route.totalDistance
          },
          fireStations: formattedStations,
          summary: {
            totalStations: formattedStations.length,
            averageResponseTime: statistics.averageResponseTime,
            stationsWithSpecialEquipment: formattedStations.filter(s => s.equipment.length > 0).length,
            nearestStation: statistics.nearestStation,
            equipmentTypes: statistics.equipmentTypes,
            searchRadius: `${maxDistance}km`
          }
        },
        message: `Found ${formattedStations.length} fire stations within ${maxDistance}km`
      });

    } catch (error) {
      console.error('Error fetching fire stations:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving fire stations',
        error: error.message
      });
    }
  },

  // GET /api/routes/:routeId/fuel-stations - ENHANCED WITH REAL DATA
  getFuelStations: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { maxDistance = 25, fuelType } = req.query;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      let query = {
        routeId,
        $or: [
          { serviceType: 'transport' },
          { fuelTypes: { $exists: true, $ne: [] } }
        ],
        distanceFromRouteKm: { $lte: parseFloat(maxDistance) }
      };

      // Add fuel type filter if specified
      if (fuelType) {
        query.fuelTypes = { $in: [fuelType] };
      }
      
      const fuelStations = await EmergencyService.find(query)
        .sort({ distanceFromRouteKm: 1 });

      const formattedStations = fuelStations.map(station => ({
        facilityName: station.name,
        location: station.address || 'Address not available',
        distanceFromSupply: `${station.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(station.distanceFromStartKm, route.totalDistance)} km`,
        distanceFromRoute: `${station.distanceFromRouteKm || 0} km`,
        coordinates: {
          lat: station.latitude,
          lng: station.longitude
        },
        phoneNumber: station.phoneNumber || '--',
        mapLink: this.generateGoogleMapsLink(station.latitude, station.longitude),
        fuelTypes: station.fuelTypes || ['Petrol', 'Diesel'],
        amenities: {
          hasATM: station.hasATM || false,
          hasRestroom: station.hasRestroom || false,
          hasConvenienceStore: station.hasConvenienceStore || false,
          truckFriendly: station.truckFriendly || false
        },
        operatingHours: station.operatingHours || '24 hours',
        isOpen24Hours: station.isOpen24Hours || false,
        priceLevel: station.priceLevel || 0,
        rating: station.rating || 0,
        lastUpdated: station.lastUpdated
      }));

      const statistics = this.calculateFuelStatistics(formattedStations);

      res.json({
        success: true,
        data: {
          route: {
            routeId: route.routeId,
            routeName: route.routeName,
            totalDistance: route.totalDistance
          },
          fuelStations: formattedStations,
          summary: {
            totalStations: formattedStations.length,
            twentyFourHourStations: formattedStations.filter(s => s.isOpen24Hours).length,
            truckFriendlyStations: formattedStations.filter(s => s.amenities.truckFriendly).length,
            stationsWithATM: formattedStations.filter(s => s.amenities.hasATM).length,
            fuelTypesAvailable: statistics.fuelTypesAvailable,
            averageDistance: statistics.averageDistance,
            searchRadius: `${maxDistance}km`
          }
        },
        message: `Found ${formattedStations.length} fuel stations within ${maxDistance}km`
      });

    } catch (error) {
      console.error('Error fetching fuel stations:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving fuel stations',
        error: error.message
      });
    }
  },

  // GET /api/routes/:routeId/educational-institutions - ENHANCED WITH REAL DATA
  getEducationalInstitutions: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { maxDistance = 20 } = req.query;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }
      
      const institutions = await EmergencyService.find({
        routeId,
        serviceType: 'educational',
        distanceFromRouteKm: { $lte: parseFloat(maxDistance) }
      }).sort({ distanceFromRouteKm: 1 });

      const formattedInstitutions = institutions.map(institution => ({
        facilityName: institution.name,
        location: institution.address || 'Address not available',
        distanceFromSupply: `${institution.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(institution.distanceFromStartKm, route.totalDistance)} km`,
        distanceFromRoute: `${institution.distanceFromRouteKm || 0} km`,
        coordinates: {
          lat: institution.latitude,
          lng: institution.longitude
        },
        phoneNumber: institution.phoneNumber || 'N/A',
        emergencyContact: institution.emergencyContact || institution.phoneNumber || 'N/A',
        mapLink: this.generateGoogleMapsLink(institution.latitude, institution.longitude),
        institutionType: institution.institutionType || 'School',
        speedLimit: '40 km/h', // Standard speed limit near schools
        safetyFeatures: institution.safetyFeatures || [],
        operatingHours: institution.operatingHours || '8:00 AM - 4:00 PM',
        studentCapacity: institution.studentCapacity || 'Not specified',
        lastUpdated: institution.lastUpdated
      }));

      const statistics = this.calculateEducationalStatistics(formattedInstitutions);

      res.json({
        success: true,
        data: {
          route: {
            routeId: route.routeId,
            routeName: route.routeName,
            totalDistance: route.totalDistance
          },
          educationalInstitutions: formattedInstitutions,
          summary: {
            totalInstitutions: formattedInstitutions.length,
            schoolZones: formattedInstitutions.filter(i => i.institutionType === 'School').length,
            collegeZones: formattedInstitutions.filter(i => i.institutionType === 'College').length,
            specialSpeedLimitZones: formattedInstitutions.length,
            institutionTypes: statistics.institutionTypes,
            searchRadius: `${maxDistance}km`
          }
        },
        message: `Found ${formattedInstitutions.length} educational institutions requiring speed reduction to 40 km/h`
      });

    } catch (error) {
      console.error('Error fetching educational institutions:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving educational institutions',
        error: error.message
      });
    }
  },

  // GET /api/routes/:routeId/food-rest-stops - ENHANCED WITH REAL DATA
  getFoodRestStops: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { maxDistance = 15, cuisineType } = req.query;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      let query = {
        routeId,
        serviceType: 'amenity',
        $or: [
          { stopType: { $in: ['restaurant', 'dhaba', 'rest_area'] } },
          { amenities: { $in: ['food', 'restaurant', 'rest'] } }
        ],
        distanceFromRouteKm: { $lte: parseFloat(maxDistance) }
      };

      if (cuisineType) {
        query.cuisineType = cuisineType;
      }
      
      const restStops = await EmergencyService.find(query)
        .sort({ distanceFromRouteKm: 1 });

      const formattedStops = restStops.map(stop => ({
        facilityName: stop.name,
        location: stop.address || 'Address not available',
        distanceFromSupply: `${stop.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(stop.distanceFromStartKm, route.totalDistance)} km`,
        distanceFromRoute: `${stop.distanceFromRouteKm || 0} km`,
        coordinates: {
          lat: stop.latitude,
          lng: stop.longitude
        },
        phoneNumber: stop.phoneNumber || '--',
        mapLink: this.generateGoogleMapsLink(stop.latitude, stop.longitude),
        cuisineType: stop.cuisineType || 'Indian',
        parkingAvailable: stop.parkingAvailable !== false,
        truckFriendly: stop.truckFriendly || false,
        restFacilities: stop.restFacilities || ['Restroom', 'Seating'],
        operatingHours: stop.operatingHours || '6:00 AM - 10:00 PM',
        rating: stop.rating || 0,
        priceLevel: stop.priceLevel || 0,
        stopType: stop.stopType || 'restaurant',
        lastUpdated: stop.lastUpdated
      }));

      const statistics = this.calculateRestStopStatistics(formattedStops);

      res.json({
        success: true,
        data: {
          route: {
            routeId: route.routeId,
            routeName: route.routeName,
            totalDistance: route.totalDistance
          },
          foodRestStops: formattedStops,
          summary: {
            totalStops: formattedStops.length,
            truckFriendlyStops: formattedStops.filter(s => s.truckFriendly).length,
            stopsWithParking: formattedStops.filter(s => s.parkingAvailable).length,
            averageDistance: statistics.averageDistance,
            cuisineTypes: statistics.cuisineTypes,
            averageRating: statistics.averageRating,
            searchRadius: `${maxDistance}km`
          }
        },
        message: `Found ${formattedStops.length} food and rest stops within ${maxDistance}km`
      });

    } catch (error) {
      console.error('Error fetching food and rest stops:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving food and rest stops',
        error: error.message
      });
    }
  },

  // GET /api/routes/:routeId/emergency-contacts - ENHANCED WITH ROUTE-SPECIFIC DATA
  getEmergencyContacts: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      // Get route-specific emergency data for enhanced protocols
      const [blindSpots, sharpTurns, accidentAreas, networkCoverage] = await Promise.all([
        BlindSpot.find({ routeId }).select('riskScore spotType'),
        SharpTurn.find({ routeId }).select('riskScore turnSeverity'),
        AccidentProneArea.find({ routeId }).select('riskScore accidentSeverity'),
        NetworkCoverage.find({ routeId, isDeadZone: true }).select('deadZoneSeverity deadZoneDuration')
      ]);

      // Standard emergency contacts (unchanged)
      const emergencyContacts = [
        {
          service: "National Emergency",
          number: "112",
          whenToCall: "Any life-threatening situation",
          responseType: "Police / Fire / Medical"
        },
        {
          service: "Police Emergency",
          number: "100",
          whenToCall: "Crime, accidents, theft",
          responseType: "Law Enforcement"
        },
        {
          service: "Fire Services",
          number: "101",
          whenToCall: "Fire, rescue, hazardous material incidents",
          responseType: "Fire & Rescue Team"
        },
        {
          service: "Medical Emergency",
          number: "108",
          whenToCall: "Accidents, health emergencies",
          responseType: "Ambulance Service"
        },
        {
          service: "Highway Patrol",
          number: "1033",
          whenToCall: "Highway accidents, traffic support",
          responseType: "Traffic Police"
        },
        {
          service: "Tourist Helpline",
          number: "1363",
          whenToCall: "Tourist-related emergencies or support",
          responseType: "Tourist Support"
        },
        {
          service: "Women Helpline",
          number: "1091",
          whenToCall: "Women in distress or danger",
          responseType: "Women Safety Assistance"
        },
        {
          service: "Disaster Management",
          number: "1078",
          whenToCall: "Natural disasters, large-scale emergencies",
          responseType: "Disaster Response Team"
        }
      ];

      // Generate enhanced emergency protocols based on route data
      const enhancedProtocols = this.getEnhancedEmergencyProtocols(route, {
        blindSpots,
        sharpTurns,
        accidentAreas,
        networkCoverage
      });

      res.json({
        success: true,
        data: {
          route: {
            routeId: route.routeId,
            routeName: route.routeName,
            totalDistance: route.totalDistance,
            riskLevel: route.riskLevel
          },
          emergencyContacts: emergencyContacts,
          emergencyProtocols: enhancedProtocols,
          routeSpecificRisks: {
            highRiskBlindSpots: blindSpots.filter(spot => spot.riskScore >= 7).length,
            criticalSharpTurns: sharpTurns.filter(turn => turn.riskScore >= 8).length,
            accidentProneAreas: accidentAreas.length,
            communicationDeadZones: networkCoverage.length
          }
        },
        message: 'Emergency contacts and route-specific protocols retrieved successfully'
      });

    } catch (error) {
      console.error('Error fetching emergency contacts:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving emergency contacts',
        error: error.message
      });
    }
  },

  // ============================================================================
  // ENHANCED HELPER METHODS WITH DYNAMIC CALCULATIONS
  // ============================================================================

  calculateDistanceFromEnd: (distanceFromStart, totalDistance) => {
    const remaining = totalDistance - (distanceFromStart || 0);
    return Math.max(0, Math.round(remaining * 10) / 10);
  },

  generateGoogleMapsLink: (lat, lng) => {
    return `https://www.google.com/maps?q=${lat}%2C${lng}`;
  },

  generateGoogleSearchLink: (name, address) => {
    const query = encodeURIComponent(`${name} ${address || ''}`);
    return `https://www.google.com/search?q=${query}`;
  },

  // Enhanced coverage analysis with route-specific data
  analyzeCoverageAdvanced: async function(servicesByType, route) {
    const analysis = {
      medical: this.analyzeMedicalCoverage(servicesByType.medical, route.totalDistance),
      police: this.analyzeSecurityCoverage(servicesByType.police, route.totalDistance),
      fire: this.analyzeFireCoverage(servicesByType.fire, route.totalDistance),
      fuel: this.analyzeFuelCoverage(servicesByType.fuel, route.totalDistance),
      overall: 'EXCELLENT'
    };

    // Calculate overall coverage score
    const scores = [analysis.medical.score, analysis.police.score, analysis.fire.score, analysis.fuel.score];
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    if (avgScore >= 85) analysis.overall = 'EXCELLENT';
    else if (avgScore >= 70) analysis.overall = 'GOOD';
    else if (avgScore >= 50) analysis.overall = 'FAIR';
    else analysis.overall = 'POOR';

    return analysis;
  },

  // Statistics calculation methods
  calculateMedicalStatistics: (facilities) => {
    if (facilities.length === 0) return { averageDistance: 0, nearestFacility: null };
    
    const distances = facilities.map(f => parseFloat(f.distanceFromRoute.replace(' km', '')));
    return {
      averageDistance: Math.round((distances.reduce((sum, d) => sum + d, 0) / distances.length) * 10) / 10,
      nearestFacility: Math.min(...distances)
    };
  },

  calculatePoliceStatistics: (stations) => {
    if (stations.length === 0) return { averageResponseTime: 'N/A', nearestStation: null, specializedUnits: [] };
    
    const distances = stations.map(s => parseFloat(s.distanceFromRoute.replace(' km', '')));
    const responseTimes = stations.map(s => s.responseTimeMinutes).filter(t => t > 0);
    const allUnits = stations.flatMap(s => s.specializedUnits || []);
    
    return {
      averageResponseTime: responseTimes.length > 0 ? 
        `${Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)} minutes` : 
        '15-25 minutes',
      nearestStation: Math.min(...distances),
      specializedUnits: [...new Set(allUnits)]
    };
  },

  calculateFireStatistics: (stations) => {
    if (stations.length === 0) return { averageResponseTime: 'N/A', nearestStation: null, equipmentTypes: [] };
    
    const distances = stations.map(s => parseFloat(s.distanceFromRoute.replace(' km', '')));
    const responseTimes = stations.map(s => s.responseTimeMinutes).filter(t => t > 0);
    const allEquipment = stations.flatMap(s => s.equipment || []);
    
    return {
      averageResponseTime: responseTimes.length > 0 ? 
        Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length) : 
        20,
      nearestStation: Math.min(...distances),
      equipmentTypes: [...new Set(allEquipment)]
    };
  },

  calculateFuelStatistics: (stations) => {
    if (stations.length === 0) return { averageDistance: 0, fuelTypesAvailable: [] };
    
    const distances = stations.map(s => parseFloat(s.distanceFromRoute.replace(' km', '')));
    const allFuelTypes = stations.flatMap(s => s.fuelTypes || []);
    
    return {
      averageDistance: Math.round((distances.reduce((sum, d) => sum + d, 0) / distances.length) * 10) / 10,
      fuelTypesAvailable: [...new Set(allFuelTypes)]
    };
  },

  calculateEducationalStatistics: (institutions) => {
    if (institutions.length === 0) return { institutionTypes: [] };
    
    const types = institutions.map(i => i.institutionType).filter(t => t);
    
    return {
      institutionTypes: [...new Set(types)]
    };
  },

  calculateRestStopStatistics: (stops) => {
    if (stops.length === 0) return { averageDistance: 0, cuisineTypes: [], averageRating: 0 };
    
    const distances = stops.map(s => parseFloat(s.distanceFromRoute.replace(' km', '')));
    const cuisines = stops.map(s => s.cuisineType).filter(c => c);
    const ratings = stops.map(s => s.rating).filter(r => r > 0);
    
    return {
      averageDistance: Math.round((distances.reduce((sum, d) => sum + d, 0) / distances.length) * 10) / 10,
      cuisineTypes: [...new Set(cuisines)],
      averageRating: ratings.length > 0 ? 
        Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10 : 0
    };
  },

  // Enhanced emergency protocols based on route-specific risks
  getEnhancedEmergencyProtocols: function(route, riskData) {
    const { blindSpots, sharpTurns, accidentAreas, networkCoverage } = riskData;
    
    // Base protocols
    const protocols = {
      roadAccident: {
        immediateActions: [
          "Stop the vehicle safely; engage handbrake, switch on hazard lights",
          "Check for injuries; call 108 for ambulance if required",
          "Inform control room or transport coordinator",
          "Take photographs of damage and surrounding conditions",
          "Record witness contact information if available"
        ],
        requiredItems: ["First aid kit", "Emergency contact card", "Accident report form"]
      },
      vehicleBreakdown: {
        immediateActions: [
          "Pull over to safe zone; place reflective triangle 15m behind vehicle",
          "Use flashers and hazard lights to alert other road users",
          "Inform Control Room and nearest Highway Patrol (1033)",
          "Attempt minor fixes if safe (replace tire, check fuses)",
          "Call backup vehicle if repair not possible within 30 min"
        ],
        caution: "Do not attempt repair in curves, blind spots, or eco-sensitive zones"
      },
      medicalEmergency: {
        immediateActions: [
          "Park vehicle safely",
          "Apply basic first aid from onboard kit", 
          "Call 108 or direct to nearest hospital",
          "Guide emergency team using GPS coordinates",
          "Record incident time, symptoms, action taken"
        ]
      }
    };

    // Add route-specific enhancements
    if (blindSpots.length > 0) {
      const criticalSpots = blindSpots.filter(spot => spot.riskScore >= 7);
      if (criticalSpots.length > 0) {
        protocols.blindSpotProtocol = {
          immediateActions: [
            `CAUTION: ${criticalSpots.length} high-risk blind spots identified on route`,
            "Reduce speed to 30-40 km/h when approaching blind spots",
            "Use horn to signal presence before entering blind curves/crests",
            "Maintain extra vigilance and be prepared for sudden stops"
          ],
          emergencyResponse: [
            "If accident occurs in blind spot, immediately activate hazard lights",
            "Place warning triangles 100m before the blind spot area",
            "Radio ahead to warn oncoming traffic"
          ]
        };
      }
    }

    if (sharpTurns.length > 0) {
      const criticalTurns = sharpTurns.filter(turn => turn.riskScore >= 8);
      if (criticalTurns.length > 0) {
        protocols.sharpTurnProtocol = {
          immediateActions: [
            `WARNING: ${criticalTurns.length} critical sharp turns on route`,
            "Reduce speed to 25-35 km/h before entering sharp turns",
            "Never attempt overtaking in turn areas",
            "Use engine braking on downhill turns"
          ],
          emergencyResponse: [
            "If vehicle becomes unstable in turn, do not brake suddenly",
            "Steer gently in direction of turn and gradually reduce speed",
            "Call 108 immediately if vehicle leaves roadway"
          ]
        };
      }
    }

    if (accidentAreas.length > 0) {
      const fatalAreas = accidentAreas.filter(area => area.accidentSeverity === 'fatal');
      if (fatalAreas.length > 0) {
        protocols.accidentProneProtocol = {
          immediateActions: [
            `CRITICAL: ${fatalAreas.length} fatal accident zones identified`,
            "Exercise extreme caution and reduce speed by 20-30%",
            "Maintain convoy formation if traveling in group",
            "Avoid travel during night hours if possible"
          ],
          emergencyResponse: [
            "In case of accident in prone area, call 112 immediately",
            "Request priority emergency response due to location history",
            "Ensure immediate medical evacuation is arranged"
          ]
        };
      }
    }

    if (networkCoverage.length > 0) {
      const severeDead = networkCoverage.filter(zone => zone.deadZoneSeverity === 'severe');
      if (severeDead.length > 0) {
        protocols.communicationDeadZoneProtocol = {
          immediateActions: [
            `ALERT: ${severeDead.length} severe communication dead zones on route`,
            "Inform control room before entering dead zones",
            "Carry satellite phone or emergency beacon",
            "Travel in convoy with lead/follow vehicle communication"
          ],
          emergencyResponse: [
            "If emergency occurs in dead zone, send vehicle to nearest coverage area",
            "Use emergency beacon or satellite communication",
            "Follow predetermined emergency contact protocols"
          ]
        };
      }
    }

    // Add route-specific emergency numbers based on route location
    protocols.routeSpecificContacts = {
      localPolice: "Contact local police station nearest to route midpoint",
      nearestHospital: "Primary hospital contact along route corridor",
      routeControlRoom: "HPCL Route Control Room: [To be configured]",
      emergencyCoordinator: "Route Emergency Coordinator: [To be assigned]"
    };

    return protocols;
  },

  // Coverage analysis methods (enhanced)
  analyzeMedicalCoverage: (medicalFacilities, routeDistance) => {
    const facilityCount = medicalFacilities.length;
    const coverageRatio = facilityCount / (routeDistance / 50); // Expected: 1 facility per 50km
    
    if (facilityCount >= 5 && coverageRatio >= 1) {
      return { score: 95, level: 'EXCELLENT', gaps: 0, recommendation: 'Excellent medical coverage' };
    } else if (facilityCount >= 3 && coverageRatio >= 0.7) {
      return { score: 80, level: 'GOOD', gaps: 1, recommendation: 'Good medical coverage' };
    } else if (facilityCount >= 1 && coverageRatio >= 0.4) {
      return { score: 60, level: 'FAIR', gaps: 2, recommendation: 'Adequate medical coverage' };
    } else {
      return { score: 20, level: 'POOR', gaps: 5, recommendation: 'Medical coverage needs improvement' };
    }
  },

  analyzeSecurityCoverage: (policeStations, routeDistance) => {
    const stationCount = policeStations.length;
    const coverageRatio = stationCount / (routeDistance / 75); // Expected: 1 station per 75km
    
    if (stationCount >= 3 && coverageRatio >= 1) {
      return { score: 90, level: 'EXCELLENT', gaps: 0, recommendation: 'Excellent security coverage' };
    } else if (stationCount >= 2 && coverageRatio >= 0.7) {
      return { score: 75, level: 'GOOD', gaps: 0, recommendation: 'Good security coverage' };
    } else if (stationCount >= 1 && coverageRatio >= 0.4) {
      return { score: 55, level: 'FAIR', gaps: 1, recommendation: 'Adequate security coverage' };
    } else {
      return { score: 25, level: 'POOR', gaps: 3, recommendation: 'Security coverage needs improvement' };
    }
  },

  analyzeFireCoverage: (fireStations, routeDistance) => {
    const stationCount = fireStations.length;
    const coverageRatio = stationCount / (routeDistance / 100); // Expected: 1 station per 100km
    
    if (stationCount >= 2 && coverageRatio >= 1) {
      return { score: 85, level: 'EXCELLENT', gaps: 0, recommendation: 'Excellent fire coverage' };
    } else if (stationCount >= 1 && coverageRatio >= 0.6) {
      return { score: 70, level: 'GOOD', gaps: 0, recommendation: 'Good fire coverage' };
    } else {
      return { score: 40, level: 'FAIR', gaps: 2, recommendation: 'Fire coverage needs improvement' };
    }
  },

  analyzeFuelCoverage: (fuelStations, routeDistance) => {
    const stationCount = fuelStations.length;
    const coverageRatio = stationCount / (routeDistance / 40); // Expected: 1 station per 40km
    
    if (stationCount >= 4 && coverageRatio >= 1) {
      return { score: 95, level: 'EXCELLENT', gaps: 0, recommendation: 'Excellent fuel coverage' };
    } else if (stationCount >= 2 && coverageRatio >= 0.7) {
      return { score: 80, level: 'GOOD', gaps: 0, recommendation: 'Good fuel coverage' };
    } else if (stationCount >= 1 && coverageRatio >= 0.4) {
      return { score: 60, level: 'FAIR', gaps: 1, recommendation: 'Adequate fuel coverage' };
    } else {
      return { score: 30, level: 'POOR', gaps: 3, recommendation: 'Fuel coverage needs improvement' };
    }
  }
};

module.exports = emergencyServicesController;