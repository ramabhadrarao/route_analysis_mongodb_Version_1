// File: routes/networkCoverage.js
// Purpose: Network coverage and dead zone analysis API endpoints

const express = require('express');
const { auth } = require('../middleware/auth');
const { NetworkCoverageService, NetworkCoverage } = require('../services/networkCoverageService');
const Route = require('../models/Route');

const router = express.Router();

// All network coverage routes require authentication
router.use(auth);

// ============================================================================
// MAIN ANALYSIS ENDPOINTS
// ============================================================================

// Analyze network coverage for a route
router.post('/routes/:routeId/analyze', async (req, res) => {
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

    console.log(`🔄 Starting network coverage analysis for route: ${route.routeId}`);
    
    // Run comprehensive network analysis
    const coverageReport = await NetworkCoverageService.analyzeNetworkCoverage(routeId);

    res.status(200).json({
      success: true,
      message: 'Network coverage analysis completed successfully',
      data: coverageReport
    });

  } catch (error) {
    console.error('Network coverage analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing network coverage',
      error: error.message
    });
  }
});

// Get network coverage overview for a route
router.get('/routes/:routeId/overview', async (req, res) => {
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

    const coverageData = await NetworkCoverageService.getNetworkCoverageForRoute(routeId);
    
    if (!coverageData.exists) {
      return res.status(404).json({
        success: false,
        message: 'No network coverage data found for this route',
        recommendation: 'Run network analysis first using POST /analyze endpoint'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          totalDistance: route.totalDistance,
          terrain: route.terrain
        },
        coverageOverview: {
          totalAnalysisPoints: coverageData.totalPoints,
          deadZones: coverageData.deadZones,
          deadZonePercentage: Math.round((coverageData.deadZones / coverageData.totalPoints) * 100),
          averageSignalStrength: coverageData.averageSignal,
          communicationRisk: coverageData.communicationRisk,
          riskLevel: coverageData.communicationRisk > 7 ? 'HIGH' : 
                    coverageData.communicationRisk > 5 ? 'MEDIUM' : 'LOW'
        }
      }
    });

  } catch (error) {
    console.error('Network coverage overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching network coverage overview'
    });
  }
});

// ============================================================================
// DEAD ZONE SPECIFIC ENDPOINTS
// ============================================================================

// Get all dead zones for a route
router.get('/routes/:routeId/dead-zones', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { severity, includeDetails = 'true' } = req.query;
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

    const deadZonesData = await NetworkCoverageService.getDeadZonesForRoute(routeId);
    
    let filteredDeadZones = deadZonesData.deadZones;
    
    // Filter by severity if specified
    if (severity) {
      filteredDeadZones = deadZonesData.deadZones.filter(dz => dz.severity === severity);
    }

    // Calculate additional statistics
    const statistics = {
      total: deadZonesData.total,
      filtered: filteredDeadZones.length,
      bySeverity: {
        critical: deadZonesData.deadZones.filter(dz => dz.severity === 'critical').length,
        severe: deadZonesData.deadZones.filter(dz => dz.severity === 'severe').length,
        moderate: deadZonesData.deadZones.filter(dz => dz.severity === 'moderate').length,
        minor: deadZonesData.deadZones.filter(dz => dz.severity === 'minor').length
      },
      totalDuration: deadZonesData.deadZones.reduce((sum, dz) => sum + dz.duration, 0),
      averageRadius: deadZonesData.deadZones.length > 0 ? 
        Math.round(deadZonesData.deadZones.reduce((sum, dz) => sum + dz.radius, 0) / deadZonesData.deadZones.length) : 0
    };

    const response = {
      success: true,
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          totalDistance: route.totalDistance
        },
        statistics,
        deadZones: filteredDeadZones
      }
    };

    // Include detailed recommendations if requested
    if (includeDetails === 'true') {
      response.data.urgentRecommendations = this.generateUrgentDeadZoneRecommendations(deadZonesData.deadZones);
      response.data.equipmentRecommendations = this.generateEquipmentRecommendations(statistics);
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Dead zones fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dead zones data'
    });
  }
});

// Get critical dead zones only
router.get('/routes/:routeId/critical-dead-zones', async (req, res) => {
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

    const criticalDeadZones = await NetworkCoverage.find({
      routeId,
      isDeadZone: true,
      deadZoneSeverity: { $in: ['critical', 'severe'] }
    }).sort({ distanceFromStartKm: 1 });

    const criticalAlerts = criticalDeadZones.map(zone => ({
      location: {
        latitude: zone.latitude,
        longitude: zone.longitude,
        distanceFromStart: zone.distanceFromStartKm
      },
      severity: zone.deadZoneSeverity,
      duration: zone.deadZoneDuration,
      radius: zone.deadZoneRadius,
      terrain: zone.terrain,
      emergencyRisk: zone.emergencyRisk,
      criticalFactors: this.identifyCriticalFactors(zone),
      immediateActions: this.generateImmediateActions(zone)
    }));

    res.status(200).json({
      success: true,
      data: {
        routeId: route.routeId,
        criticalDeadZones: criticalAlerts,
        totalCritical: criticalAlerts.length,
        overallEmergencyRisk: criticalAlerts.length > 0 ? 
          Math.max(...criticalAlerts.map(z => z.emergencyRisk)) : 0,
        routeRecommendation: this.generateRouteRecommendation(criticalAlerts, route)
      }
    });

  } catch (error) {
    console.error('Critical dead zones error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching critical dead zones'
    });
  }
});

// ============================================================================
// OPERATOR SPECIFIC ENDPOINTS
// ============================================================================

// Get coverage by specific operator
router.get('/routes/:routeId/operator/:operator', async (req, res) => {
  try {
    const { routeId, operator } = req.params;
    const userId = req.user.id;
    
    if (!['airtel', 'jio', 'vi', 'bsnl'].includes(operator.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid operator. Supported: airtel, jio, vi, bsnl'
      });
    }
    
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

    const operatorCoverage = await NetworkCoverageService.getCoverageByOperator(routeId, operator.toLowerCase());
    
    if (operatorCoverage.error) {
      return res.status(404).json({
        success: false,
        message: operatorCoverage.error
      });
    }

    res.status(200).json({
      success: true,
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName
        },
        operatorCoverage,
        recommendations: this.generateOperatorRecommendations(operatorCoverage, operator)
      }
    });

  } catch (error) {
    console.error('Operator coverage error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching operator coverage'
    });
  }
});

// Compare all operators for a route
router.get('/routes/:routeId/operator-comparison', async (req, res) => {
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

    const operators = ['airtel', 'jio', 'vi', 'bsnl'];
    const operatorComparison = {};
    
    for (const operator of operators) {
      try {
        const coverage = await NetworkCoverageService.getCoverageByOperator(routeId, operator);
        if (!coverage.error) {
          operatorComparison[operator] = coverage;
        }
      } catch (error) {
        console.warn(`Failed to get coverage for ${operator}:`, error.message);
      }
    }

    // Calculate best and worst operators
    const operatorRankings = this.rankOperators(operatorComparison);
    
    res.status(200).json({
      success: true,
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName
        },
        operatorComparison,
        rankings: operatorRankings,
        recommendations: this.generateMultiOperatorRecommendations(operatorComparison)
      }
    });

  } catch (error) {
    console.error('Operator comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Error comparing operator coverage'
    });
  }
});

// ============================================================================
// DETAILED ANALYSIS ENDPOINTS
// ============================================================================

// Get detailed network coverage data for a route
router.get('/routes/:routeId/detailed', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { includeAll = 'false', minSignal = '0' } = req.query;
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

    let query = { routeId };
    
    // Filter by signal strength if specified
    if (minSignal !== '0') {
      query.signalStrength = { $gte: parseFloat(minSignal) };
    }

    const coveragePoints = await NetworkCoverage.find(query).sort({ distanceFromStartKm: 1 });

    if (coveragePoints.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No network coverage data found for this route'
      });
    }

    // Process data based on detail level requested
    const processedData = includeAll === 'true' ? 
      this.getFullDetailedData(coveragePoints) :
      this.getSummaryDetailedData(coveragePoints);

    res.status(200).json({
      success: true,
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          totalDistance: route.totalDistance
        },
        analysisDetails: {
          totalPoints: coveragePoints.length,
          dataQuality: this.assessDataQuality(coveragePoints),
          analysisDate: coveragePoints[0]?.lastUpdated
        },
        coverageData: processedData
      }
    });

  } catch (error) {
    console.error('Detailed coverage error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching detailed coverage data'
    });
  }
});

// Get network coverage statistics
router.get('/routes/:routeId/statistics', async (req, res) => {
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

    const coveragePoints = await NetworkCoverage.find({ routeId });

    if (coveragePoints.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No network coverage data found'
      });
    }

    const statistics = this.calculateComprehensiveStatistics(coveragePoints, route);

    res.status(200).json({
      success: true,
      data: {
        routeInfo: {
          routeId: route.routeId,
          routeName: route.routeName,
          totalDistance: route.totalDistance,
          terrain: route.terrain
        },
        statistics
      }
    });

  } catch (error) {
    console.error('Coverage statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating coverage statistics'
    });
  }
});

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

// Delete network coverage data for a route
router.delete('/routes/:routeId', async (req, res) => {
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

    const deleteResult = await NetworkCoverage.deleteMany({ routeId });

    res.status(200).json({
      success: true,
      message: 'Network coverage data deleted successfully',
      data: {
        deletedPoints: deleteResult.deletedCount
      }
    });

  } catch (error) {
    console.error('Delete coverage data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting coverage data'
    });
  }
});

// Check if network analysis exists for a route
router.get('/routes/:routeId/exists', async (req, res) => {
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

    const count = await NetworkCoverage.countDocuments({ routeId });
    const lastAnalysis = await NetworkCoverage.findOne({ routeId }).sort({ lastUpdated: -1 });

    res.status(200).json({
      success: true,
      data: {
        exists: count > 0,
        analysisPoints: count,
        lastAnalyzed: lastAnalysis?.lastUpdated || null,
        needsReanalysis: lastAnalysis ? 
          (Date.now() - lastAnalysis.lastUpdated.getTime() > 7 * 24 * 60 * 60 * 1000) : true // 7 days old
      }
    });

  } catch (error) {
    console.error('Check analysis existence error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking analysis existence'
    });
  }
});

// ============================================================================
// HELPER METHODS
// ============================================================================

function generateUrgentDeadZoneRecommendations(deadZones) {
  const recommendations = [];
  const criticalZones = deadZones.filter(dz => dz.severity === 'critical');
  const severeZones = deadZones.filter(dz => dz.severity === 'severe');
  
  if (criticalZones.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      message: `${criticalZones.length} critical dead zones detected`,
      action: 'Mandatory satellite communication equipment required'
    });
  }
  
  if (severeZones.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      message: `${severeZones.length} severe dead zones identified`,
      action: 'Convoy travel and backup communication methods required'
    });
  }
  
  const totalDuration = deadZones.reduce((sum, dz) => sum + dz.duration, 0);
  if (totalDuration > 60) {
    recommendations.push({
      priority: 'CRITICAL',
      message: `Total ${totalDuration} minutes without coverage`,
      action: 'Consider alternative route or emergency positioning'
    });
  }
  
  return recommendations;
}

function generateEquipmentRecommendations(statistics) {
  const recommendations = [];
  
  if (statistics.bySeverity.critical > 0) {
    recommendations.push({
      equipment: 'Satellite Phone',
      necessity: 'MANDATORY',
      reason: 'Critical dead zones present',
      cost: 'High'
    });
    
    recommendations.push({
      equipment: 'Emergency Beacon',
      necessity: 'MANDATORY',
      reason: 'Emergency location in dead zones',
      cost: 'Medium'
    });
  }
  
  if (statistics.total > 5) {
    recommendations.push({
      equipment: 'Two-Way Radio',
      necessity: 'HIGHLY RECOMMENDED',
      reason: 'Multiple dead zones detected',
      cost: 'Medium'
    });
  }
  
  recommendations.push({
    equipment: 'External Antenna',
    necessity: 'RECOMMENDED',
    reason: 'Improve signal in weak areas',
    cost: 'Low'
  });
  
  return recommendations;
}

function identifyCriticalFactors(zone) {
  const factors = [];
  
  if (zone.deadZoneDuration > 30) {
    factors.push('Extended coverage gap (>30 minutes)');
  }
  
  if (zone.deadZoneRadius > 3000) {
    factors.push('Large coverage area (>3km radius)');
  }
  
  if (zone.terrain === 'mountainous') {
    factors.push('Mountainous terrain - physical obstruction');
  }
  
  if (zone.emergencyRisk > 8) {
    factors.push('High emergency response risk');
  }
  
  return factors;
}

function generateImmediateActions(zone) {
  const actions = [];
  
  actions.push('Brief all drivers on dead zone location and duration');
  actions.push('Test communication immediately before entering area');
  actions.push('Establish check-in protocol before and after dead zone');
  
  if (zone.deadZoneSeverity === 'critical') {
    actions.push('Use satellite communication or postpone travel');
    actions.push('Coordinate with emergency services for route monitoring');
  }
  
  return actions;
}

function generateRouteRecommendation(criticalAlerts, route) {
  const totalCritical = criticalAlerts.length;
  const maxEmergencyRisk = criticalAlerts.length > 0 ? 
    Math.max(...criticalAlerts.map(z => z.emergencyRisk)) : 0;
  
  if (totalCritical > 3 || maxEmergencyRisk > 9) {
    return {
      recommendation: 'NOT RECOMMENDED',
      reason: 'Too many critical dead zones present significant safety risk',
      alternative: 'Seek alternative route or upgrade to satellite communication'
    };
  } else if (totalCritical > 0) {
    return {
      recommendation: 'PROCEED WITH EXTREME CAUTION',
      reason: 'Critical dead zones require enhanced safety measures',
      alternative: 'Enhanced communication equipment and convoy travel required'
    };
  } else {
    return {
      recommendation: 'PROCEED WITH STANDARD SAFETY MEASURES',
      reason: 'No critical dead zones detected',
      alternative: 'Standard communication protocols sufficient'
    };
  }
}

function generateOperatorRecommendations(operatorCoverage, operator) {
  const recommendations = [];
  
  if (operatorCoverage.averageCoverage < 50) {
    recommendations.push(`${operator.toUpperCase()} has poor coverage on this route (${operatorCoverage.averageCoverage}%)`);
    recommendations.push('Consider using multiple operators for redundancy');
  }
  
  if (operatorCoverage.deadZones > 5) {
    recommendations.push(`${operatorCoverage.deadZones} dead zones detected for ${operator.toUpperCase()}`);
    recommendations.push('Use alternative communication methods in dead zones');
  }
  
  return recommendations;
}

function rankOperators(operatorComparison) {
  const rankings = Object.entries(operatorComparison)
    .map(([operator, data]) => ({
      operator: operator.toUpperCase(),
      score: this.calculateOperatorScore(data),
      averageCoverage: data.averageCoverage,
      deadZones: data.deadZones
    }))
    .sort((a, b) => b.score - a.score);
  
  return {
    best: rankings[0]?.operator || 'None',
    worst: rankings[rankings.length - 1]?.operator || 'None',
    rankings
  };
}

function calculateOperatorScore(operatorData) {
  // Calculate composite score based on coverage and reliability
  let score = operatorData.averageCoverage;
  score -= operatorData.deadZones * 5; // Penalty for dead zones
  score += operatorData.averageSignal * 5; // Bonus for signal strength
  
  return Math.max(0, Math.min(100, score));
}

function generateMultiOperatorRecommendations(operatorComparison) {
  const recommendations = [];
  const operators = Object.keys(operatorComparison);
  
  if (operators.length > 1) {
    recommendations.push('Use multiple SIM cards for redundancy');
    
    const bestOperator = this.rankOperators(operatorComparison).best;
    recommendations.push(`Primary: ${bestOperator} (best overall coverage)`);
    
    recommendations.push('Configure automatic network switching');
  }
  
  recommendations.push('Test all operators before journey');
  
  return recommendations;
}

function getFullDetailedData(coveragePoints) {
  return coveragePoints.map(point => ({
    location: {
      latitude: point.latitude,
      longitude: point.longitude,
      distanceFromStart: point.distanceFromStartKm
    },
    coverage: {
      type: point.coverageType,
      signalStrength: point.signalStrength,
      isDeadZone: point.isDeadZone
    },
    operators: point.operatorCoverage,
    riskAssessment: {
      communicationRisk: point.communicationRisk,
      emergencyRisk: point.emergencyRisk
    },
    environment: {
      terrain: point.terrain,
      elevation: point.elevation,
      interferenceFactors: point.interferenceFactors
    },
    recommendations: point.recommendations
  }));
}

function getSummaryDetailedData(coveragePoints) {
  return coveragePoints.map(point => ({
    location: {
      latitude: point.latitude,
      longitude: point.longitude,
      distanceFromStart: point.distanceFromStartKm
    },
    signalStrength: point.signalStrength,
    isDeadZone: point.isDeadZone,
    communicationRisk: point.communicationRisk,
    terrain: point.terrain
  }));
}

function assessDataQuality(coveragePoints) {
  const totalPoints = coveragePoints.length;
  const completePoints = coveragePoints.filter(p => 
    p.operatorCoverage && 
    p.signalStrength !== undefined && 
    p.terrain
  ).length;
  
  const completeness = (completePoints / totalPoints) * 100;
  
  let quality = 'poor';
  if (completeness >= 95) quality = 'excellent';
  else if (completeness >= 85) quality = 'good';
  else if (completeness >= 70) quality = 'fair';
  
  return {
    level: quality,
    completeness: Math.round(completeness),
    totalPoints,
    completePoints
  };
}

function calculateComprehensiveStatistics(coveragePoints, route) {
  const deadZones = coveragePoints.filter(p => p.isDeadZone);
  const weakSignalAreas = coveragePoints.filter(p => p.signalStrength < 4 && !p.isDeadZone);
  
  return {
    coverage: {
      totalAnalysisPoints: coveragePoints.length,
      averageSignalStrength: Math.round((coveragePoints.reduce((sum, p) => sum + p.signalStrength, 0) / coveragePoints.length) * 10) / 10,
      coverageQuality: this.determineCoverageQuality(coveragePoints)
    },
    deadZones: {
      total: deadZones.length,
      percentage: Math.round((deadZones.length / coveragePoints.length) * 100),
      bySeverity: this.groupBySeverity(deadZones),
      totalDuration: deadZones.reduce((sum, dz) => sum + dz.deadZoneDuration, 0),
      averageRadius: deadZones.length > 0 ? 
        Math.round(deadZones.reduce((sum, dz) => sum + dz.deadZoneRadius, 0) / deadZones.length) : 0
    },
    weakSignalAreas: {
      total: weakSignalAreas.length,
      percentage: Math.round((weakSignalAreas.length / coveragePoints.length) * 100)
    },
    riskAssessment: {
      averageCommunicationRisk: Math.round((coveragePoints.reduce((sum, p) => sum + p.communicationRisk, 0) / coveragePoints.length) * 10) / 10,
      averageEmergencyRisk: Math.round((coveragePoints.reduce((sum, p) => sum + p.emergencyRisk, 0) / coveragePoints.length) * 10) / 10,
      highRiskAreas: coveragePoints.filter(p => p.communicationRisk > 7).length
    },
    terrainBreakdown: this.groupByTerrain(coveragePoints),
    operatorPerformance: this.calculateOperatorPerformance(coveragePoints)
  };
}

function determineCoverageQuality(coveragePoints) {
  const averageSignal = coveragePoints.reduce((sum, p) => sum + p.signalStrength, 0) / coveragePoints.length;
  const deadZonePercentage = (coveragePoints.filter(p => p.isDeadZone).length / coveragePoints.length) * 100;
  
  if (averageSignal >= 7 && deadZonePercentage < 5) return 'excellent';
  if (averageSignal >= 5 && deadZonePercentage < 15) return 'good';
  if (averageSignal >= 3 && deadZonePercentage < 30) return 'fair';
  return 'poor';
}

function groupBySeverity(deadZones) {
  return {
    critical: deadZones.filter(dz => dz.deadZoneSeverity === 'critical').length,
    severe: deadZones.filter(dz => dz.deadZoneSeverity === 'severe').length,
    moderate: deadZones.filter(dz => dz.deadZoneSeverity === 'moderate').length,
    minor: deadZones.filter(dz => dz.deadZoneSeverity === 'minor').length
  };
}

function groupByTerrain(coveragePoints) {
  const terrainGroups = {};
  coveragePoints.forEach(point => {
    const terrain = point.terrain || 'unknown';
    if (!terrainGroups[terrain]) {
      terrainGroups[terrain] = {
        count: 0,
        averageSignal: 0,
        deadZones: 0
      };
    }
    terrainGroups[terrain].count++;
    terrainGroups[terrain].averageSignal += point.signalStrength;
    if (point.isDeadZone) terrainGroups[terrain].deadZones++;
  });
  
  // Calculate averages
  Object.values(terrainGroups).forEach(group => {
    group.averageSignal = Math.round((group.averageSignal / group.count) * 10) / 10;
  });
  
  return terrainGroups;
}

function calculateOperatorPerformance(coveragePoints) {
  const operators = ['airtel', 'jio', 'vi', 'bsnl'];
  const performance = {};
  
  operators.forEach(operator => {
    const operatorData = coveragePoints.map(p => p.operatorCoverage[operator]);
    const averageCoverage = operatorData.reduce((sum, data) => sum + data.coverage, 0) / operatorData.length;
    const deadZones = operatorData.filter(data => data.coverage === 0).length;
    
    performance[operator] = {
      averageCoverage: Math.round(averageCoverage),
      deadZones,
      reliability: deadZones === 0 ? 'excellent' : 
                  deadZones < coveragePoints.length * 0.1 ? 'good' :
                  deadZones < coveragePoints.length * 0.3 ? 'fair' : 'poor'
    };
  });
  
  return performance;
}

module.exports = router;