// File: controllers/routeBasicInfoController.js
// Purpose: Handle basic route information for PDF generation

const Route = require('../models/Route');
const EmergencyService = require('../models/EmergencyService');

const routeBasicInfoController = {
  
  // GET /api/routes/:routeId/basic-info
  getBasicInfo: async (req, res) => {
    try {
      const { routeId } = req.params;
      
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
      
      const basicInfo = {
        route: {
          routeId: route.routeId,
          originName: route.fromName || route.fromAddress.split(',')[0],
          originCode: route.fromCode || `[${route.routeId.slice(-4)}]`,
          destinationName: route.toName || route.toAddress.split(',')[0],
          destinationCode: route.toCode || `[${route.routeId.slice(-8)}]`,
          totalDistance: `${route.totalDistance} km`,
          estimatedDuration: this.formatDuration(route.estimatedDuration),
          majorHighways: majorHighways,
          terrain: terrain
        },
        coordinates: {
          origin: route.fromCoordinates,
          destination: route.toCoordinates
        },
        metadata: {
          createdAt: route.createdAt,
          lastUpdated: route.updatedAt,
          status: route.status,
          processingCompletion: route.processingCompletion
        }
      };

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
        error: error.message
      });
    }
  },

  // Helper method to format duration
  formatDuration: (minutes) => {
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
  },

  // GET /api/routes/:routeId/safety-measures
  getSafetyMeasures: async (req, res) => {
    try {
      const { routeId } = req.params;
      
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
        ]
      };

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
  }
};

module.exports = routeBasicInfoController;