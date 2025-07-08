// File: controllers/complianceController.js
const Route = require('../models/Route');

const complianceController = {
  
  // GET /api/routes/:routeId/compliance-requirements
  getComplianceRequirements: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      const vehicleCompliance = {
        vehicleType: "Heavy Goods Vehicle",
        vehicleCategory: "Heavy Goods Vehicle", 
        ais140Required: true,
        routeOrigin: `${route.fromName || route.fromAddress} [${route.fromCode || route.routeId.slice(-4)}]`,
        routeDestination: `${route.toName || route.toAddress} [${route.toCode || route.routeId.slice(-8)}]`,
        totalDistance: `${route.totalDistance} km`,
        estimatedDuration: this.formatDuration(route.estimatedDuration),
        interstateTravel: false
      };

      const complianceRequirements = [
        {
          category: "Valid Driving License",
          status: "REQUIRED",
          action: "Verify license category matches vehicle type"
        },
        {
          category: "Vehicle Registration", 
          status: "REQUIRED",
          action: "Ensure current registration is valid"
        },
        {
          category: "Vehicle Insurance",
          status: "REQUIRED", 
          action: "Valid comprehensive insurance is necessary"
        },
        {
          category: "Route Permits",
          status: "CONDITIONAL",
          action: "Required for interstate/heavy vehicle operations"
        },
        {
          category: "AIS-140 GPS Device",
          status: "REQUIRED",
          action: "Install certified GPS tracking device"
        },
        {
          category: "Driving Time Limits", 
          status: "REQUIRED",
          action: "Maximum 10 hours of continuous driving"
        },
        {
          category: "Vehicle Fitness Certificate",
          status: "REQUIRED",
          action: "Ensure valid pollution & fitness certificates"
        },
        {
          category: "Driver Medical Certificate",
          status: "REQUIRED", 
          action: "Maintain a valid medical fitness certificate"
        }
      ];

      const complianceIssues = [
        {
          issue: "AIS-140 GPS tracking device required",
          severity: "HIGH",
          action: "Address before travel"
        },
        {
          issue: "Heavy vehicle - weight restrictions may apply", 
          severity: "MEDIUM",
          action: "Address before travel"
        }
      ];

      const regulatoryFramework = [
        "Motor Vehicles Act, 1988 - Vehicle registration and licensing requirements",
        "Central Motor Vehicles Rules, 1989 - Technical specifications and safety", 
        "AIS-140 Standards - GPS tracking and panic button requirements",
        "Road Transport and Safety Policy (RTSP) - Driver working hours",
        "Interstate Transport Permits - Required for commercial interstate travel",
        "Pollution Control Board Norms - Emission standards compliance",
        "Goods and Services Tax (GST) - Tax compliance for commercial transport",
        "Road Safety and Transport Authority - State-specific requirements"
      ];

      res.json({
        success: true,
        data: {
          vehicleCompliance: vehicleCompliance,
          complianceRequirements: complianceRequirements,
          complianceIssues: complianceIssues,
          regulatoryFramework: regulatoryFramework,
          penalties: this.getCompliancePenalties()
        },
        message: 'Compliance requirements retrieved successfully'
      });

    } catch (error) {
      console.error('Error fetching compliance requirements:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving compliance requirements',
        error: error.message
      });
    }
  },

  formatDuration: (minutes) => {
    if (!minutes) return 'Unknown';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours} hours ${mins} mins` : `${mins} mins`;
  },

  getCompliancePenalties: () => {
    return [
      "Driving without valid license: Fine up to Rs 5,000 + imprisonment",
      "Vehicle without registration: Fine up to Rs 10,000 + vehicle seizure", 
      "No insurance: Fine up to Rs 2,000 + vehicle seizure",
      "AIS-140 non-compliance: Permit cancellation + heavy fines",
      "Overloading violations: Fine Rs 20,000 + per excess ton",
      "Driving time violations: License suspension + fines",
      "Interstate without permits: Vehicle seizure + penalty",
      "Environmental violations: Fine up to Rs 10,000 + registration cancellation"
    ];
  }
};