// File: routes/dashboard.js
// Purpose: Dashboard API endpoints for analytics and overview

const express = require('express');
const Route = require('../models/Route');
const { auth } = require('../middleware/auth'); // FIXED: Added destructuring
const mongoose = require('mongoose');

const router = express.Router();

// All dashboard routes require authentication
router.use(auth);

// Dashboard overview
router.get('/overview', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Basic route statistics
    const totalRoutes = await Route.countDocuments({ 
      userId, 
      status: { $ne: 'deleted' } 
    });
    
    // Risk level distribution (simplified)
    const routes = await Route.find({
      userId,
      status: { $ne: 'deleted' }
    }).select('riskLevel');
    
    const riskDistribution = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };
    
    routes.forEach(route => {
      const level = route.riskLevel || 'LOW';
      riskDistribution[level]++;
    });
    
    // Recent routes
    const recentRoutes = await Route.find({
      userId,
      status: { $ne: 'deleted' }
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('routeId routeName fromName toName riskLevel totalDistance createdAt');
    
    // High risk routes
    const highRiskRoutes = await Route.find({
      userId,
      riskLevel: { $in: ['HIGH', 'CRITICAL'] },
      status: 'active'
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('routeId routeName fromName toName riskLevel');
    
    // Calculate total distance
    const totalDistanceResult = await Route.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: { $ne: 'deleted' } }},
      { $group: { _id: null, totalDistance: { $sum: '$totalDistance' }}}
    ]);
    
    const totalDistance = totalDistanceResult[0]?.totalDistance || 0;
    
    res.status(200).json({
      success: true,
      data: {
        totalRoutes,
        riskDistribution,
        recentRoutes,
        highRiskRoutes,
        summary: {
          totalDistance: Math.round(totalDistance),
          averageRiskScore: 4.5, // Mock value
          lastUpdated: new Date()
        }
      }
    });
    
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data'
    });
  }
});

// Route statistics
router.get('/statistics', async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    
    // Routes created in timeframe
    const routesInTimeframe = await Route.countDocuments({
      userId,
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'deleted' }
    });
    
    // Distance in timeframe
    const distanceResult = await Route.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: 'deleted' }
        }
      },
      {
        $group: {
          _id: null,
          totalDistance: { $sum: '$totalDistance' }
        }
      }
    ]);
    
    const totalDistanceInPeriod = distanceResult[0]?.totalDistance || 0;
    
    // Mock trend data
    const routeCreationTrend = [
      { date: '2024-12-01', count: 2, totalDistance: 1500 },
      { date: '2024-12-15', count: 3, totalDistance: 2200 },
      { date: '2024-12-30', count: 5, totalDistance: 3500 }
    ];
    
    res.status(200).json({
      success: true,
      data: {
        timeframe,
        routeCreationTrend,
        summary: {
          totalRoutesInPeriod: routesInTimeframe,
          totalDistanceInPeriod: Math.round(totalDistanceInPeriod)
        }
      }
    });
    
  } catch (error) {
    console.error('Route statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching route statistics'
    });
  }
});

// Risk alerts
router.get('/alerts', async (req, res) => {
  try {
    const userId = req.user.id;
    const { priority = 'all' } = req.query;
    
    // Find routes with high risk
    let matchCondition = {
      userId,
      status: 'active'
    };
    
    if (priority === 'critical') {
      matchCondition.riskLevel = 'CRITICAL';
    } else if (priority === 'high') {
      matchCondition.riskLevel = { $in: ['HIGH', 'CRITICAL'] };
    }
    
    const routes = await Route.find(matchCondition)
      .sort({ createdAt: -1 })
      .limit(20)
      .select('routeId routeName fromName toName riskLevel riskScores createdAt');
    
    // Generate alert messages
    const alerts = routes.map(route => {
      const routeAlerts = [];
      
      if (route.riskLevel === 'CRITICAL') {
        routeAlerts.push({
          type: 'CRITICAL',
          message: `Route ${route.routeName} has critical risk level`,
          recommendation: 'Consider alternative routes or additional safety measures'
        });
      } else if (route.riskLevel === 'HIGH') {
        routeAlerts.push({
          type: 'WARNING',
          message: `Route ${route.routeName} has high risk level`,
          recommendation: 'Exercise extra caution and monitor conditions'
        });
      }
      
      return {
        routeId: route.routeId,
        routeName: route.routeName,
        fromName: route.fromName,
        toName: route.toName,
        riskLevel: route.riskLevel,
        totalRiskScore: route.riskScores?.totalWeightedScore || 0,
        alerts: routeAlerts,
        lastUpdated: route.createdAt
      };
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalAlerts: alerts.length,
        alerts,
        summary: {
          critical: alerts.filter(a => a.riskLevel === 'CRITICAL').length,
          high: alerts.filter(a => a.riskLevel === 'HIGH').length,
          medium: alerts.filter(a => a.riskLevel === 'MEDIUM').length
        }
      }
    });
    
  } catch (error) {
    console.error('Risk alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching risk alerts'
    });
  }
});

module.exports = router;