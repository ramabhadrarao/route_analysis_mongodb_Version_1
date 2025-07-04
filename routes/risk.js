// File: routes/risk.js
// Purpose: Risk assessment and calculation endpoints

const express = require('express');
// const riskCalculationService = require('../services/riskCalculationService'); // Commented out for now
const Route = require('../models/Route');
const { auth } = require('../middleware/auth'); // FIXED: Added destructuring
const logger = require('../utils/logger');

const router = express.Router();

// All risk routes require authentication
router.use(auth);

// Calculate risk for specific route (simplified version)
router.get('/calculate/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const userId = req.user.id;
    
    const route = await Route.findOne({
      _id: routeId,
      userId,
      status: { $ne: 'deleted' }
    });
    
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // REAL RISK CALCULATION - Replace mock implementation
    const riskCalculationService = require('../services/riskCalculationService');
    const realRiskScore = await riskCalculationService.calculateRouteRisk(routeId);
    
    // Real risk explanation based on actual data
    const explanation = {
      grade: realRiskScore.riskGrade,
      score: realRiskScore.totalWeightedScore,
      explanation: this.generateRiskExplanation(realRiskScore),
      recommendations: realRiskScore.safetyRecommendations,
      dataQuality: realRiskScore.dataQuality,
      confidence: realRiskScore.confidenceLevel
    };
    
    res.status(200).json({
      success: true,
      data: {
        routeId: route.routeId,
        riskScore: realRiskScore,
        explanation
      }
    });
    
  } catch (error) {
    logger.error('Real risk calculation API error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating route risk'
    });
  }
});

// Get risk calculation history
router.get('/history/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const userId = req.user.id;
    
    // Verify route ownership
    const route = await Route.findOne({
      _id: routeId,
      userId,
      status: { $ne: 'deleted' }
    });
    
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }
    
    // Return current risk score as history
    res.status(200).json({
      success: true,
      data: {
        routeId: route.routeId,
        history: [{
          calculatedAt: route.metadata?.lastCalculated || route.updatedAt,
          riskScore: route.riskScores?.totalWeightedScore || 0,
          riskGrade: route.riskScores?.riskGrade || 'A',
          riskLevel: route.riskLevel || 'LOW'
        }]
      }
    });
    
  } catch (error) {
    logger.error('Risk history API error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching risk history'
    });
  }
});

// Batch calculate risks for multiple routes
router.post('/batch-calculate', async (req, res) => {
  try {
    const { routeIds } = req.body;
    const userId = req.user.id;
    
    if (!routeIds || !Array.isArray(routeIds)) {
      return res.status(400).json({
        success: false,
        message: 'Route IDs array is required'
      });
    }
    
    // Verify all routes belong to user
    const routes = await Route.find({
      _id: { $in: routeIds },
      userId,
      status: { $ne: 'deleted' }
    });
    
    if (routes.length !== routeIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some routes not found or not accessible'
      });
    }
    
    // Calculate risks for all routes (simplified)
    const results = [];
    
    for (const route of routes) {
      try {
        // Mock risk calculation
        const mockRiskScore = {
          roadConditions: Math.random() * 10,
          accidentProne: Math.random() * 10,
          totalWeightedScore: Math.random() * 10,
          riskGrade: Math.random() > 0.5 ? 'B' : 'C',
          calculatedAt: new Date()
        };
        
        await Route.findByIdAndUpdate(route._id, {
          riskScores: mockRiskScore,
          riskLevel: mockRiskScore.totalWeightedScore > 6 ? 'HIGH' : 'MEDIUM',
          'metadata.lastCalculated': new Date()
        });
        
        results.push({
          routeId: route.routeId,
          success: true,
          riskScore: mockRiskScore.totalWeightedScore,
          riskGrade: mockRiskScore.riskGrade
        });
        
      } catch (error) {
        results.push({
          routeId: route.routeId,
          success: false,
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Batch risk calculation completed',
      data: {
        totalProcessed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }
    });
    
  } catch (error) {
    logger.error('Batch risk calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error in batch risk calculation'
    });
  }
});

module.exports = router;