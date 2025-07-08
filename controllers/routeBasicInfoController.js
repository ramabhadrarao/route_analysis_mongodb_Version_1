// File: controllers/routeBasicInfoController.js (FIXED VERSION)
// Purpose: Handle basic route information for PDF generation

const Route = require('../models/Route');
const EmergencyService = require('../models/EmergencyService');

// Helper function (moved outside the object)
const formatDuration = (minutes) => {
  if (!minutes) return 'Unknown';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins} mins`;
  } else if (mins === 0) {
    return `${hours} hours`;
  } else {
    return `${hours} hours ${mins} mins`;
  }
};

const routeBasicInfoController = {
  
  // GET /api/routes/:routeId/basic-info
  getBasicInfo: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      console.log(`📊 Basic info request for route: ${routeId}`);
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      // Calculate major highways from route points or use stored data
      const majorHighways = route.majorHighways || ['NH-344', 'NH-709'];
      
      // Determine terrain type
      const terrain = route.terrain || 'Rural Plains';
      
      // Safe access to nested properties
      const fromAddress = route.fromAddress || route.fromName || 'Origin Location';
      const toAddress = route.toAddress || route.toName || 'Destination Location';
      
      const basicInfo = {
        route: {
          routeId: route.routeId,
          originName: route.fromName || (typeof fromAddress === 'string' ? fromAddress.split(',')[0] : 'Origin'),
          originCode: route.fromCode || `[${(route.routeId || 'ROUTE').slice(-4)}]`,
          destinationName: route.toName || (typeof toAddress === 'string' ? toAddress.split(',')[0] : 'Destination'),
          destinationCode: route.toCode || `[${(route.routeId || 'ROUTE').slice(-8)}]`,
          totalDistance: `${route.totalDistance || 0} km`,
          estimatedDuration: formatDuration(route.estimatedDuration), // ✅ FIXED: Direct function call
          majorHighways: majorHighways,
          terrain: terrain
        },
        coordinates: {
          origin: route.fromCoordinates || { latitude: 0, longitude: 0 },
          destination: route.toCoordinates || { latitude: 0, longitude: 0 }
        },
        metadata: {
          createdAt: route.createdAt,
          lastUpdated: route.updatedAt,
          status: route.status || 'active',
          processingCompletion: route.processingCompletion || 0
        }
      };

      console.log(`   ✅ Basic info retrieved for route: ${route.routeName || route.routeId}`);

      res.json({
        success: true,
        data: basicInfo,
        message: 'Basic route information retrieved successfully'
      });

    } catch (error) {
      console.error('Error fetching basic route info:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving basic route information',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  // GET /api/routes/:routeId/safety-measures
  getSafetyMeasures: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      console.log(`🛡️ Safety measures request for route: ${routeId}`);
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      const safetyMeasures = {
        speedLimits: {
          NH: "60 km/h",
          SH: "55 km/h", 
          MDR: "55 km/h",
          rural: "25-30 km/h",
          accidentZone: "30 km/h"
        },
        nightDriving: "Prohibited: 2300hrs - 0500hrs",
        restBreaks: "Mandatory 15-30 min every 3 hours",
        vehicleCompliance: "Check brakes, tires, lights, and emergency equipment",
        permits: "Valid transport permits, Hazardous vehicle license, MSDS sheets, TREM CARD",
        vts: "VTS & EMERGENCY LOCKING DEVICE shall be functional",
        additionalRequirements: [
          "Carry valid transport permits",
          "Hazardous vehicle license required", 
          "MSDS sheets must be available",
          "TREM CARD mandatory",
          "Emergency equipment check before journey"
        ],
        routeSpecificMeasures: {
          terrain: route.terrain || 'mixed',
          distance: route.totalDistance || 0,
          duration: formatDuration(route.estimatedDuration),
          specialConsiderations: generateSpecialConsiderations(route)
        }
      };

      console.log(`   ✅ Safety measures retrieved for route: ${route.routeName || route.routeId}`);

      res.json({
        success: true,
        data: safetyMeasures,
        message: 'Safety measures retrieved successfully'
      });

    } catch (error) {
      console.error('Error fetching safety measures:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving safety measures',
        error: error.message
      });
    }
  },

  // Additional helper method for format duration (for backward compatibility)
  formatDuration: formatDuration
};

// Helper function for generating route-specific safety considerations
function generateSpecialConsiderations(route) {
  const considerations = [];
  
  if (route.terrain === 'hilly') {
    considerations.push('Mountain driving: Use engine braking on descents');
    considerations.push('Check brake temperature regularly');
  }
  
  if (route.terrain === 'rural') {
    considerations.push('Rural roads: Watch for agricultural vehicles');
    considerations.push('Limited lighting - carry extra flashlights');
  }
  
  if (route.totalDistance > 200) {
    considerations.push('Long distance: Plan overnight stops');
    considerations.push('Driver fatigue management critical');
  }
  
  if (route.majorHighways && route.majorHighways.length > 0) {
    considerations.push('Highway travel: Maintain safe following distance');
    considerations.push('Use hazard lights during adverse weather');
  }
  
  // Default considerations if none specific
  if (considerations.length === 0) {
    considerations.push('Standard safety protocols apply');
    considerations.push('Monitor weather conditions');
    considerations.push('Maintain vehicle in good condition');
  }
  
  return considerations;
}

module.exports = routeBasicInfoController;