// File: server.js - UPDATED WITH NETWORK COVERAGE INTEGRATION
// Purpose: Server with all routes including network coverage

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hpcl_journey_risk', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Import routes with error handling
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
}

try {
  const routeRoutes = require('./routes/routes');
  app.use('/api/routes', routeRoutes);
  console.log('✅ Route routes loaded');
} catch (error) {
  console.error('❌ Error loading route routes:', error.message);
}

try {
  const riskRoutes = require('./routes/risk');
  app.use('/api/risk', riskRoutes);
  console.log('✅ Risk routes loaded');
} catch (error) {
  console.error('❌ Error loading risk routes:', error.message);
}

try {
  const dashboardRoutes = require('./routes/dashboard');
  app.use('/api/dashboard', dashboardRoutes);
  console.log('✅ Dashboard routes loaded');
} catch (error) {
  console.error('❌ Error loading dashboard routes:', error.message);
}

try {
  const sharpTurnsRoutes = require('./routes/sharpTurnsBlindSpots');
  app.use('/api/visibility', sharpTurnsRoutes);
  console.log('✅ Sharp turns & blind spots routes loaded');
} catch (error) {
  console.error('❌ Error loading sharp turns routes:', error.message);
}

// ✅ NEW: Network Coverage Routes Integration
try {
  const networkCoverageRoutes = require('./routes/networkCoverage');
  app.use('/api/network-coverage', networkCoverageRoutes);
  console.log('✅ Network coverage routes loaded');
} catch (error) {
  console.error('❌ Error loading network coverage routes:', error.message);
}

try {
  const sharpTurnImageRoutes = require('./routes/sharpTurnImageDownloader');
  app.use('/api/sharp-turn-images', sharpTurnImageRoutes);
  console.log('✅ Sharp turn image download routes loaded');
} catch (error) {
  console.error('❌ Error loading sharp turn image routes:', error.message);
}
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'connected',
      networkCoverage: 'available'
    }
  });
});

// Root endpoint with updated API list
app.get('/', (req, res) => {
  res.json({
    message: 'HPCL Journey Risk Management System API',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      routes: '/api/routes',
      risk: '/api/risk',
      dashboard: '/api/dashboard',
      visibility: '/api/visibility',
      networkCoverage: '/api/network-coverage', // ✅ NEW
      health: '/health'
    },
    networkCoverageEndpoints: {
      analyzeRoute: 'POST /api/network-coverage/routes/:routeId/analyze',
      getOverview: 'GET /api/network-coverage/routes/:routeId/overview',
      getDeadZones: 'GET /api/network-coverage/routes/:routeId/dead-zones',
      getCriticalDeadZones: 'GET /api/network-coverage/routes/:routeId/critical-dead-zones',
      getOperatorCoverage: 'GET /api/network-coverage/routes/:routeId/operator/:operator',
      compareOperators: 'GET /api/network-coverage/routes/:routeId/operator-comparison',
      getStatistics: 'GET /api/network-coverage/routes/:routeId/statistics',
      checkExists: 'GET /api/network-coverage/routes/:routeId/exists',
      deleteData: 'DELETE /api/network-coverage/routes/:routeId'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    availableEndpoints: [
      '/api/auth',
      '/api/routes', 
      '/api/risk',
      '/api/dashboard',
      '/api/visibility',
      '/api/network-coverage',
      '/health'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 HPCL Journey Risk Management Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}`);
  console.log(`📶 Network Coverage API: http://localhost:${PORT}/api/network-coverage`);
  console.log('');
  console.log('Available API Endpoints:');
  console.log('├── Authentication: /api/auth');
  console.log('├── Routes: /api/routes');
  console.log('├── Risk Assessment: /api/risk');
  console.log('├── Dashboard: /api/dashboard');
  console.log('├── Visibility Analysis: /api/visibility');
  console.log('├── Network Coverage: /api/network-coverage ✨ NEW');
  console.log('└── Health Check: /health');
});

module.exports = app;