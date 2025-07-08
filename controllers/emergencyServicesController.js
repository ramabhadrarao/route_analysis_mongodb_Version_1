// File: controllers/emergencyServicesController.js
// Purpose: Handle emergency services data for medical, police, fire stations

const EmergencyService = require('../models/EmergencyService');
const Route = require('../models/Route');

const emergencyServicesController = {

  // GET /api/routes/:routeId/emergency-services
  getEmergencyServices: async (req, res) => {
    try {
      const { routeId } = req.params;
      const { serviceType, maxDistance = 50 } = req.query;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      // Build query filter
      const query = { routeId };
      if (serviceType) {
        query.serviceType = serviceType;
      }
      
      // Add distance filter if specified
      if (maxDistance) {
        query.distanceFromRouteKm = { $lte: parseFloat(maxDistance) };
      }

      const emergencyServices = await EmergencyService.find(query)
        .sort({ 
          serviceType: 1, 
          distanceFromRouteKm: 1, 
          priority: -1 
        });

      // Group services by type
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

      // Generate coverage analysis
      const coverageAnalysis = this.analyzeCoverage(servicesByType, route.totalDistance);

      res.json({
        success: true,
        data: {
          emergencyServices: servicesByType,
          coverageAnalysis: coverageAnalysis,
          summary: {
            totalServices: emergencyServices.length,
            medicalFacilities: servicesByType.medical.length,
            policeFacilities: servicesByType.police.length,
            fireFacilities: servicesByType.fire.length,
            fuelStations: servicesByType.fuel.length,
            educationalInstitutions: servicesByType.educational.length,
            amenities: servicesByType.amenities.length
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

  // GET /api/routes/:routeId/medical-facilities
  getMedicalFacilities: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const medicalFacilities = await EmergencyService.find({
        routeId,
        serviceType: { $in: ['hospital', 'ambulance'] },
        distanceFromRouteKm: { $lte: 30 }
      }).sort({ distanceFromRouteKm: 1 });

      // Format medical facilities according to PDF structure
      const formattedFacilities = medicalFacilities.map(facility => ({
        facilityName: facility.name,
        location: facility.address || 'Address not available',
        distanceFromSupply: `${facility.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(facility.distanceFromStartKm, 131)} km`,
        coordinates: {
          lat: facility.latitude,
          lng: facility.longitude
        },
        phoneNumber: facility.phoneNumber || 'Not available',
        mapLink: this.generateGoogleSearchLink(facility.name, facility.address),
        specializations: facility.specializations || [],
        emergencyServices: facility.emergencyServices || [],
        priority: facility.priority,
        isOpen24Hours: facility.isOpen24Hours || false,
        rating: facility.rating || 0
      }));

      res.json({
        success: true,
        data: {
          medicalFacilities: formattedFacilities,
          summary: {
            totalFacilities: formattedFacilities.length,
            hospitalsWithin10km: formattedFacilities.filter(f => 
              parseFloat(f.distanceFromSupply.replace(' km', '')) <= 10
            ).length,
            twentyFourHourFacilities: formattedFacilities.filter(f => f.isOpen24Hours).length,
            averageDistance: formattedFacilities.length > 0 ? 
              Math.round((formattedFacilities.reduce((sum, f) => 
                sum + parseFloat(f.distanceFromSupply.replace(' km', '')), 0
              ) / formattedFacilities.length) * 10) / 10 : 0
          }
        },
        message: `Found ${formattedFacilities.length} medical facilities`
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

  // GET /api/routes/:routeId/police-stations
  getPoliceStations: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const policeStations = await EmergencyService.find({
        routeId,
        serviceType: 'police',
        distanceFromRouteKm: { $lte: 50 }
      }).sort({ distanceFromRouteKm: 1 });

      const formattedStations = policeStations.map(station => ({
        facilityName: station.name,
        location: station.address || 'Address not available',
        distanceFromSupply: `${station.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(station.distanceFromStartKm, 131)} km`,
        coordinates: {
          lat: station.latitude,
          lng: station.longitude
        },
        phoneNumber: station.phoneNumber || '--',
        mapLink: this.generateGoogleMapsLink(station.latitude, station.longitude),
        jurisdiction: station.jurisdiction || 'Local',
        specializedUnits: station.specializedUnits || [],
        priority: station.priority
      }));

      res.json({
        success: true,
        data: {
          policeStations: formattedStations,
          summary: {
            totalStations: formattedStations.length,
            stationsWithin20km: formattedStations.filter(s => 
              parseFloat(s.distanceFromSupply.replace(' km', '')) <= 20
            ).length,
            averageResponseTime: '15-25 minutes' // Default estimate
          }
        },
        message: `Found ${formattedStations.length} police stations`
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

  // GET /api/routes/:routeId/fire-stations
  getFireStations: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const fireStations = await EmergencyService.find({
        routeId,
        serviceType: 'fire_station',
        distanceFromRouteKm: { $lte: 40 }
      }).sort({ distanceFromRouteKm: 1 });

      const formattedStations = fireStations.map(station => ({
        facilityName: station.name,
        location: station.address || 'Address not available',
        distanceFromSupply: `${station.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(station.distanceFromStartKm, 131)} km`,
        coordinates: {
          lat: station.latitude,
          lng: station.longitude
        },
        phoneNumber: station.phoneNumber || '--',
        mapLink: this.generateGoogleMapsLink(station.latitude, station.longitude),
        equipment: station.equipment || [],
        responseTimeMinutes: station.responseTimeMinutes || 20
      }));

      res.json({
        success: true,
        data: {
          fireStations: formattedStations,
          summary: {
            totalStations: formattedStations.length,
            averageResponseTime: formattedStations.length > 0 ? 
              Math.round(formattedStations.reduce((sum, s) => sum + s.responseTimeMinutes, 0) / formattedStations.length) : 20,
            stationsWithSpecialEquipment: formattedStations.filter(s => s.equipment.length > 0).length
          }
        },
        message: `Found ${formattedStations.length} fire stations`
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

  // GET /api/routes/:routeId/fuel-stations
  getFuelStations: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const fuelStations = await EmergencyService.find({
        routeId,
        $or: [
          { serviceType: 'transport' },
          { fuelTypes: { $exists: true, $ne: [] } }
        ],
        distanceFromRouteKm: { $lte: 25 }
      }).sort({ distanceFromRouteKm: 1 });

      const formattedStations = fuelStations.map(station => ({
        facilityName: station.name,
        location: station.address || 'Address not available',
        distanceFromSupply: `${station.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(station.distanceFromStartKm, 131)} km`,
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
        isOpen24Hours: station.isOpen24Hours || false
      }));

      res.json({
        success: true,
        data: {
          fuelStations: formattedStations,
          summary: {
            totalStations: formattedStations.length,
            twentyFourHourStations: formattedStations.filter(s => s.isOpen24Hours).length,
            truckFriendlyStations: formattedStations.filter(s => s.amenities.truckFriendly).length,
            stationsWithATM: formattedStations.filter(s => s.amenities.hasATM).length
          }
        },
        message: `Found ${formattedStations.length} fuel stations`
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

  // GET /api/routes/:routeId/educational-institutions
  getEducationalInstitutions: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const institutions = await EmergencyService.find({
        routeId,
        serviceType: 'educational',
        distanceFromRouteKm: { $lte: 20 }
      }).sort({ distanceFromRouteKm: 1 });

      const formattedInstitutions = institutions.map(institution => ({
        facilityName: institution.name,
        location: institution.address || 'Address not available',
        distanceFromSupply: `${institution.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(institution.distanceFromStartKm, 131)} km`,
        coordinates: {
          lat: institution.latitude,
          lng: institution.longitude
        },
        phoneNumber: institution.phoneNumber || 'N/A',
        mapLink: this.generateGoogleMapsLink(institution.latitude, institution.longitude),
        institutionType: institution.institutionType || 'School',
        speedLimit: '40 km/h', // Standard speed limit near schools
        safetyFeatures: institution.safetyFeatures || [],
        operatingHours: institution.operatingHours || '8:00 AM - 4:00 PM'
      }));

      res.json({
        success: true,
        data: {
          educationalInstitutions: formattedInstitutions,
          summary: {
            totalInstitutions: formattedInstitutions.length,
            schoolZones: formattedInstitutions.filter(i => i.institutionType === 'School').length,
            collegeZones: formattedInstitutions.filter(i => i.institutionType === 'College').length,
            specialSpeedLimitZones: formattedInstitutions.length // All educational zones have 40 km/h limit
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

  // GET /api/routes/:routeId/food-rest-stops
  getFoodRestStops: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const restStops = await EmergencyService.find({
        routeId,
        serviceType: 'amenity',
        $or: [
          { stopType: { $in: ['restaurant', 'dhaba', 'rest_area'] } },
          { amenities: { $in: ['food', 'restaurant', 'rest'] } }
        ],
        distanceFromRouteKm: { $lte: 15 }
      }).sort({ distanceFromRouteKm: 1 });

      const formattedStops = restStops.map(stop => ({
        facilityName: stop.name,
        location: stop.address || 'Address not available',
        distanceFromSupply: `${stop.distanceFromStartKm || 0} km`,
        distanceFromCustomer: `${this.calculateDistanceFromEnd(stop.distanceFromStartKm, 131)} km`,
        coordinates: {
          lat: stop.latitude,
          lng: stop.longitude
        },
        phoneNumber: stop.phoneNumber || '--',
        mapLink: this.generateGoogleMapsLink(stop.latitude, stop.longitude),
        cuisineType: stop.cuisineType || 'Indian',
        parkingAvailable: stop.parkingAvailable || true,
        truckFriendly: stop.truckFriendly || false,
        restFacilities: stop.restFacilities || ['Restroom', 'Seating'],
        operatingHours: stop.operatingHours || '6:00 AM - 10:00 PM'
      }));

      res.json({
        success: true,
        data: {
          foodRestStops: formattedStops,
          summary: {
            totalStops: formattedStops.length,
            truckFriendlyStops: formattedStops.filter(s => s.truckFriendly).length,
            stopsWithParking: formattedStops.filter(s => s.parkingAvailable).length,
            averageDistance: formattedStops.length > 0 ? 
              Math.round((formattedStops.reduce((sum, s) => 
                sum + parseFloat(s.distanceFromSupply.replace(' km', '')), 0
              ) / formattedStops.length) * 10) / 10 : 0
          }
        },
        message: `Found ${formattedStops.length} food and rest stops`
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

  // GET /api/routes/:routeId/emergency-contacts
  getEmergencyContacts: async (req, res) => {
    try {
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

      res.json({
        success: true,
        data: {
          emergencyContacts: emergencyContacts,
          emergencyProtocols: this.getEmergencyProtocols()
        },
        message: 'Emergency contacts and protocols retrieved successfully'
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

  // Helper methods
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

  analyzeCoverage: (servicesByType, routeDistance) => {
    const analysis = {
      medical: this.analyzeMedicalCoverage(servicesByType.medical, routeDistance),
      police: this.analyzeSecurityCoverage(servicesByType.police, routeDistance),
      fire: this.analyzeFireCoverage(servicesByType.fire, routeDistance),
      fuel: this.analyzeFuelCoverage(servicesByType.fuel, routeDistance),
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

  analyzeMedicalCoverage: (medicalFacilities, routeDistance) => {
    if (medicalFacilities.length >= 5) {
      return { score: 95, level: 'EXCELLENT', gaps: 0 };
    } else if (medicalFacilities.length >= 3) {
      return { score: 80, level: 'GOOD', gaps: 1 };
    } else if (medicalFacilities.length >= 1) {
      return { score: 60, level: 'FAIR', gaps: 2 };
    } else {
      return { score: 20, level: 'POOR', gaps: 5 };
    }
  },

  analyzeSecurityCoverage: (policeStations, routeDistance) => {
    if (policeStations.length >= 3) {
      return { score: 90, level: 'EXCELLENT', gaps: 0 };
    } else if (policeStations.length >= 2) {
      return { score: 75, level: 'GOOD', gaps: 0 };
    } else if (policeStations.length >= 1) {
      return { score: 55, level: 'FAIR', gaps: 1 };
    } else {
      return { score: 25, level: 'POOR', gaps: 3 };
    }
  },

  analyzeFireCoverage: (fireStations, routeDistance) => {
    if (fireStations.length >= 2) {
      return { score: 85, level: 'EXCELLENT', gaps: 0 };
    } else if (fireStations.length >= 1) {
      return { score: 70, level: 'GOOD', gaps: 0 };
    } else {
      return { score: 40, level: 'FAIR', gaps: 2 };
    }
  },

  analyzeFuelCoverage: (fuelStations, routeDistance) => {
    if (fuelStations.length >= 4) {
      return { score: 95, level: 'EXCELLENT', gaps: 0 };
    } else if (fuelStations.length >= 2) {
      return { score: 80, level: 'GOOD', gaps: 0 };
    } else if (fuelStations.length >= 1) {
      return { score: 60, level: 'FAIR', gaps: 1 };
    } else {
      return { score: 30, level: 'POOR', gaps: 3 };
    }
  },

  getEmergencyProtocols: () => {
    return {
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
  }
};

module.exports = emergencyServicesController;