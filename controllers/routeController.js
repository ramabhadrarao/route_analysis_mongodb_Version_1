// File: controllers/routeController.js
// Purpose: Handle GPS route CSV upload with metadata
// GPS CSV format: Each line contains "latitude,longitude" coordinates

const fs = require('fs');
const csv = require('csv-parser');
const { validationResult } = require('express-validator');
const Route = require('../models/Route');

// Simple distance calculation function
function calculateSimpleDistance(coord1, coord2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return Math.round(distance * 100) / 100;
}

// Calculate total route distance from GPS points
function calculateTotalRouteDistance(gpsPoints) {
  let totalDistance = 0;
  for (let i = 1; i < gpsPoints.length; i++) {
    totalDistance += calculateSimpleDistance(gpsPoints[i-1], gpsPoints[i]);
  }
  return totalDistance;
}

// Create Route Manually
exports.createRoute = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      routeName,
      fromAddress, fromCode, fromName, fromCoordinates,
      toAddress, toCode, toName, toCoordinates,
      terrain, majorHighways
    } = req.body;

    // Calculate distance and duration (simplified)
    const distance = calculateSimpleDistance(fromCoordinates, toCoordinates);
    const duration = Math.round(distance * 1.2); // Rough estimate
    
    // Generate simple route points
    const routePoints = [
      {
        latitude: fromCoordinates.latitude,
        longitude: fromCoordinates.longitude,
        pointOrder: 0,
        distanceFromStart: 0,
        distanceToEnd: distance
      },
      {
        latitude: toCoordinates.latitude,
        longitude: toCoordinates.longitude,
        pointOrder: 1,
        distanceFromStart: distance,
        distanceToEnd: 0
      }
    ];

    const route = new Route({
      userId: req.user.id,
      routeName,
      fromAddress,
      fromCode,
      fromName,
      fromCoordinates,
      toAddress,
      toCode,
      toName,
      toCoordinates,
      totalDistance: distance,
      estimatedDuration: duration,
      routePoints,
      terrain: terrain || 'mixed',
      majorHighways: majorHighways || [],
      metadata: {
        uploadSource: 'manual',
        processingNotes: ['Route created manually']
      }
    });

    // Generate live map link
    route.generateLiveMapLink();

    await route.save();

    console.log(`Route created manually: ${route.routeId} by user: ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Route created successfully',
      route: {
        id: route._id,
        routeId: route.routeId,
        routeName: route.routeName,
        fromAddress: route.fromAddress,
        toAddress: route.toAddress,
        totalDistance: route.totalDistance,
        estimatedDuration: route.estimatedDuration,
        liveMapLink: route.liveMapLink
      }
    });

  } catch (error) {
    console.error('Create route error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating route',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Upload GPS Route CSV with Metadata
exports.uploadGPSRoute = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No GPS CSV file uploaded'
      });
    }

    // Get route metadata from request body
    const {
      fromCode,
      fromName,
      toCode,
      toName,
      routeName,
      terrain,
      majorHighways,
      fromAddress,
      toAddress
    } = req.body;

    // Validate required metadata
    if (!fromCode || !fromName || !toCode || !toName) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Required metadata missing: fromCode, fromName, toCode, toName are mandatory'
      });
    }

    const gpsPoints = [];
    const errors = [];
    let lineNumber = 0;

    // Parse GPS CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv({ headers: false })) // No headers, just coordinate data
      .on('data', (data) => {
        lineNumber++;
        try {
          // Each row should contain coordinates like "28.94966,77.65908"
          const coordinateString = Object.values(data)[0]; // Get first column value
          
          if (!coordinateString || typeof coordinateString !== 'string') {
            errors.push({
              line: lineNumber,
              error: 'Invalid coordinate format',
              data: coordinateString
            });
            return;
          }

          // Parse coordinates - handle both comma-separated and space-separated
          const coords = coordinateString.trim().split(/[,\s]+/);
          
          if (coords.length < 2) {
            errors.push({
              line: lineNumber,
              error: 'Insufficient coordinate data (need lat,lng)',
              data: coordinateString
            });
            return;
          }

          const latitude = parseFloat(coords[0]);
          const longitude = parseFloat(coords[1]);

          if (isNaN(latitude) || isNaN(longitude)) {
            errors.push({
              line: lineNumber,
              error: 'Invalid coordinate values (not numbers)',
              data: coordinateString
            });
            return;
          }

          // Validate coordinate ranges
          if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            errors.push({
              line: lineNumber,
              error: 'Coordinates out of valid range',
              data: coordinateString
            });
            return;
          }

          gpsPoints.push({
            latitude,
            longitude,
            pointOrder: lineNumber - 1,
            originalLine: coordinateString
          });

        } catch (parseError) {
          errors.push({
            line: lineNumber,
            error: `Parse error: ${parseError.message}`,
            data: Object.values(data)[0]
          });
        }
      })
      .on('end', async () => {
        try {
          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          if (gpsPoints.length < 2) {
            return res.status(400).json({
              success: false,
              message: `Insufficient GPS points. Need at least 2 points, got ${gpsPoints.length}`,
              errors
            });
          }

          console.log(`Parsed ${gpsPoints.length} GPS points from CSV`);

          // Extract start and end coordinates
          const startPoint = gpsPoints[0];
          const endPoint = gpsPoints[gpsPoints.length - 1];

          const fromCoordinates = {
            latitude: startPoint.latitude,
            longitude: startPoint.longitude
          };

          const toCoordinates = {
            latitude: endPoint.latitude,
            longitude: endPoint.longitude
          };

          // Calculate total route distance from GPS tracking
          const totalDistance = calculateTotalRouteDistance(gpsPoints);
          const estimatedDuration = Math.round(totalDistance * 1.5); // Estimate based on distance

          // Prepare route points with distances
          let cumulativeDistance = 0;
          const routePoints = gpsPoints.map((point, index) => {
            if (index > 0) {
              cumulativeDistance += calculateSimpleDistance(gpsPoints[index - 1], point);
            }

            return {
              latitude: point.latitude,
              longitude: point.longitude,
              pointOrder: index,
              distanceFromStart: Math.round(cumulativeDistance * 100) / 100,
              distanceToEnd: Math.round((totalDistance - cumulativeDistance) * 100) / 100,
              elevation: null // Would be calculated with elevation API
            };
          });

          // Create route in database
          const route = new Route({
            userId: req.user.id,
            routeName: routeName || `${fromName} to ${toName}`,
            fromAddress: fromAddress || fromName,
            fromCode: fromCode.trim(),
            fromName: fromName.trim(),
            fromCoordinates,
            toAddress: toAddress || toName,
            toCode: toCode.trim(),
            toName: toName.trim(),
            toCoordinates,
            totalDistance,
            estimatedDuration,
            routePoints,
            terrain: terrain || 'mixed',
            majorHighways: majorHighways ? majorHighways.split(',').map(h => h.trim()) : [],
            metadata: {
              uploadSource: 'gps_csv',
              originalFileName: req.file.originalname,
              processingNotes: [
                `GPS route imported with ${gpsPoints.length} tracking points`,
                `Total distance calculated: ${totalDistance}km`,
                `Start: ${startPoint.latitude}, ${startPoint.longitude}`,
                `End: ${endPoint.latitude}, ${endPoint.longitude}`,
                `Parse errors: ${errors.length}`
              ],
              gpsTrackingPoints: gpsPoints.length,
              trackingAccuracy: errors.length === 0 ? 'perfect' : 'good'
            }
          });

          // Generate live map link with all GPS points
          route.generateLiveMapLink();

          await route.save();

          console.log(`✅ GPS Route created: ${route.routeId} with ${gpsPoints.length} points`);

          res.status(201).json({
            success: true,
            message: `GPS route created successfully with ${gpsPoints.length} tracking points`,
            data: {
              route: {
                id: route._id,
                routeId: route.routeId,
                routeName: route.routeName,
                fromCode: route.fromCode,
                fromName: route.fromName,
                toCode: route.toCode,
                toName: route.toName,
                totalDistance: route.totalDistance,
                estimatedDuration: route.estimatedDuration,
                liveMapLink: route.liveMapLink,
                coordinates: {
                  start: fromCoordinates,
                  end: toCoordinates
                },
                gpsTracking: {
                  totalPoints: gpsPoints.length,
                  startPoint: `${startPoint.latitude}, ${startPoint.longitude}`,
                  endPoint: `${endPoint.latitude}, ${endPoint.longitude}`,
                  parseErrors: errors.length
                }
              },
              processing: {
                totalGPSPoints: gpsPoints.length,
                successfulPoints: gpsPoints.length,
                parseErrors: errors.length,
                trackingAccuracy: `${Math.round(((gpsPoints.length - errors.length) / gpsPoints.length) * 100)}%`
              },
              errors: errors.length > 0 ? errors.slice(0, 10) : [], // Show first 10 errors
              nextSteps: [
                'GPS route has been created with detailed tracking points',
                'You can view the route on Google Maps using the live link',
                'Route analysis and risk assessment can be performed',
                'Individual GPS points are stored for detailed analysis'
              ]
            }
          });

        } catch (processingError) {
          console.error('GPS CSV processing error:', processingError);
          res.status(500).json({
            success: false,
            message: 'Error processing GPS CSV file',
            error: processingError.message
          });
        }
      })
      .on('error', (streamError) => {
        console.error('GPS CSV stream error:', streamError);
        // Clean up file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
          success: false,
          message: 'Error reading GPS CSV file',
          error: streamError.message
        });
      });

  } catch (error) {
    console.error('GPS route upload error:', error);
    // Clean up file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Server error during GPS route upload',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Legacy CSV upload (for backward compatibility)
exports.uploadCSV = async (req, res) => {
  // Keep the existing CSV upload functionality for routes with metadata
  return res.status(200).json({
    success: true,
    message: 'Use /upload-gps-route for GPS tracking files, or /upload-routes-csv for route metadata files'
  });
};

// Get All Routes for User
exports.getRoutes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { 
      userId: req.user.id,
      status: { $ne: 'deleted' }
    };

    // Add search filter
    if (req.query.search) {
      filter.$or = [
        { routeName: { $regex: req.query.search, $options: 'i' } },
        { fromName: { $regex: req.query.search, $options: 'i' } },
        { toName: { $regex: req.query.search, $options: 'i' } },
        { routeId: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Add risk level filter
    if (req.query.riskLevel) {
      filter.riskLevel = req.query.riskLevel;
    }

    const routes = await Route.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-routePoints -metadata.processingNotes');

    const total = await Route.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        routes,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRoutes: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching routes'
    });
  }
};

// Get Single Route Details with GPS Points
exports.getRoute = async (req, res) => {
  try {
    const route = await Route.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    res.status(200).json({
      success: true,
      route
    });

  } catch (error) {
    console.error('Get route error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching route details'
    });
  }
};

// Update Route
exports.updateRoute = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { routeName, terrain, majorHighways } = req.body;

    const route = await Route.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
        status: { $ne: 'deleted' }
      },
      {
        routeName,
        terrain,
        majorHighways
      },
      { new: true, runValidators: true }
    );

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    console.log(`Route updated: ${route.routeId} by user: ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Route updated successfully',
      route
    });

  } catch (error) {
    console.error('Update route error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating route'
    });
  }
};

// Delete Route (Soft Delete)
exports.deleteRoute = async (req, res) => {
  try {
    const route = await Route.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
        status: { $ne: 'deleted' }
      },
      {
        status: 'deleted'
      },
      { new: true }
    );

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    console.log(`Route deleted: ${route.routeId} by user: ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Route deleted successfully'
    });

  } catch (error) {
    console.error('Delete route error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting route'
    });
  }
};

// Recalculate Route Risk (Placeholder)
exports.recalculateRisk = async (req, res) => {
  try {
    const route = await Route.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Risk recalculation feature coming soon',
      routeId: route.routeId
    });

  } catch (error) {
    console.error('Recalculate risk error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while recalculating risk'
    });
  }
};

module.exports = {
  createRoute: exports.createRoute,
  uploadGPSRoute: exports.uploadGPSRoute,
  uploadCSV: exports.uploadCSV,
  getRoutes: exports.getRoutes,
  getRoute: exports.getRoute,
  updateRoute: exports.updateRoute,
  deleteRoute: exports.deleteRoute,
  recalculateRisk: exports.recalculateRisk
};