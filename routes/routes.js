// File: routes/routes.js
// Purpose: Route management endpoints with GPS CSV upload support
// Dependencies: multer for file uploads, express-validator for validation

const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, query } = require('express-validator');
const routeController = require('../controllers/routeController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_PATH || './uploads');
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const prefix = file.fieldname === 'gpsFile' ? 'gps-route-' : 'route-';
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = ['.csv', '.txt'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV and TXT files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE?.replace('mb', '')) * 1024 * 1024 || 50 * 1024 * 1024 // 50MB default
  }
});

// Validation rules for manual route creation
const createRouteValidation = [
  body('routeName')
    .notEmpty()
    .withMessage('Route name is required')
    .isLength({ min: 3, max: 255 })
    .withMessage('Route name must be between 3 and 255 characters'),
    
  body('fromAddress')
    .notEmpty()
    .withMessage('From address is required'),
    
  body('toAddress')
    .notEmpty()
    .withMessage('To address is required'),
    
  body('fromCoordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('From latitude must be between -90 and 90'),
    
  body('fromCoordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('From longitude must be between -180 and 180'),
    
  body('toCoordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('To latitude must be between -90 and 90'),
    
  body('toCoordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('To longitude must be between -180 and 180'),
    
  body('terrain')
    .optional()
    .isIn(['flat', 'hilly', 'urban', 'rural', 'mixed'])
    .withMessage('Terrain must be one of: flat, hilly, urban, rural, mixed'),
    
  body('majorHighways')
    .optional()
    .isArray()
    .withMessage('Major highways must be an array'),
    
  body('fromCode')
    .optional()
    .isLength({ max: 50 })
    .withMessage('From code cannot exceed 50 characters'),
    
  body('toCode')
    .optional()
    .isLength({ max: 50 })
    .withMessage('To code cannot exceed 50 characters')
];

// Validation rules for GPS route upload
const gpsRouteValidation = [
  body('fromCode')
    .notEmpty()
    .withMessage('From code is required')
    .isLength({ max: 50 })
    .withMessage('From code cannot exceed 50 characters'),
    
  body('fromName')
    .notEmpty()
    .withMessage('From name is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('From name must be between 1 and 255 characters'),
    
  body('toCode')
    .notEmpty()
    .withMessage('To code is required')
    .isLength({ max: 50 })
    .withMessage('To code cannot exceed 50 characters'),
    
  body('toName')
    .notEmpty()
    .withMessage('To name is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('To name must be between 1 and 255 characters'),
    
  body('routeName')
    .optional()
    .isLength({ min: 3, max: 255 })
    .withMessage('Route name must be between 3 and 255 characters'),
    
  body('terrain')
    .optional()
    .isIn(['flat', 'hilly', 'urban', 'rural', 'mixed'])
    .withMessage('Terrain must be one of: flat, hilly, urban, rural, mixed'),
    
  body('fromAddress')
    .optional()
    .isLength({ max: 255 })
    .withMessage('From address cannot exceed 255 characters'),
    
  body('toAddress')
    .optional()
    .isLength({ max: 255 })
    .withMessage('To address cannot exceed 255 characters')
];

const updateRouteValidation = [
  body('routeName')
    .optional()
    .isLength({ min: 3, max: 255 })
    .withMessage('Route name must be between 3 and 255 characters'),
    
  body('terrain')
    .optional()
    .isIn(['flat', 'hilly', 'urban', 'rural', 'mixed'])
    .withMessage('Terrain must be one of: flat, hilly, urban, rural, mixed'),
    
  body('majorHighways')
    .optional()
    .isArray()
    .withMessage('Major highways must be an array')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('riskLevel')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .withMessage('Risk level must be one of: LOW, MEDIUM, HIGH, CRITICAL'),
    
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
];

// All routes require authentication
router.use(auth);

// Route CRUD operations
router.post('/', createRouteValidation, routeController.createRoute);
router.get('/', queryValidation, routeController.getRoutes);
router.get('/:id', routeController.getRoute);
router.put('/:id', updateRouteValidation, routeController.updateRoute);
router.delete('/:id', routeController.deleteRoute);

// GPS Route Upload - NEW ENDPOINT for your requirement
router.post('/upload-gps-route', 
  upload.single('gpsFile'), 
  gpsRouteValidation, 
  routeController.uploadGPSRoute
);

// Legacy CSV upload (for backward compatibility)
router.post('/upload-csv', upload.single('csvFile'), routeController.uploadCSV);

// Risk calculation
router.post('/:id/recalculate-risk', routeController.recalculateRisk);

// Route analytics endpoints
router.get('/:id/analytics', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Route analytics endpoint - coming soon',
      routeId: req.params.id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching route analytics'
    });
  }
});

// Export route data
router.get('/:id/export', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Route export endpoint - coming soon',
      routeId: req.params.id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting route data'
    });
  }
});

// Route sharing (generate shareable link)
router.post('/:id/share', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Route sharing endpoint - coming soon',
      routeId: req.params.id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating shareable link'
    });
  }
});

// Get GPS tracking points for a route
router.get('/:id/gps-points', async (req, res) => {
  try {
    const Route = require('../models/Route');
    
    const route = await Route.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    }).select('routePoints routeName fromName toName totalDistance');

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        routeId: req.params.id,
        routeName: route.routeName,
        fromName: route.fromName,
        toName: route.toName,
        totalDistance: route.totalDistance,
        gpsPoints: route.routePoints,
        totalPoints: route.routePoints.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching GPS points'
    });
  }
});

// Bulk operations
router.post('/bulk/delete', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Bulk delete endpoint - coming soon'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error in bulk delete operation'
    });
  }
});

router.post('/bulk/recalculate', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Bulk recalculate endpoint - coming soon'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error in bulk recalculate operation'
    });
  }
});

module.exports = router;