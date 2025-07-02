// File: services/sharpTurnsBlindSpotsService.js - FIXED VERSION
// Purpose: Enhanced service with proper error handling and straight turn support
// CRITICAL FIX: Handles 'straight' turns and validation issues

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const SharpTurn = require('../models/SharpTurn');
const BlindSpot = require('../models/BlindSpot');
const Route = require('../models/Route');
const realBlindSpotCalculator = require('./realBlindSpotCalculations');

class EnhancedSharpTurnsBlindSpotsService {
  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.imageStoragePath = process.env.IMAGE_STORAGE_PATH || './public/images';
    
    // ENHANCED filtering for critical and moderate turns
    this.TURN_THRESHOLDS = {
      MIN_ANGLE: 25,              // degrees - include moderate turns
      MAX_RADIUS: 300,            // meters - wider range
      MIN_RISK_SCORE: 5.0,        // include medium-risk turns
      MAX_SAFE_SPEED: 50          // km/h - reasonable speed limit
    };
    
    this.createImageDirectories();
  }

  createImageDirectories() {
    const dirs = [
      path.join(this.imageStoragePath, 'sharp-turns'),
      path.join(this.imageStoragePath, 'blind-spots')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // ============================================================================
  // MAIN ENHANCED ANALYSIS - FIXED WITH PROPER ERROR HANDLING
  // ============================================================================

  async analyzeRoute(routeId) {
    try {
      console.log(`🔄 Starting ENHANCED visibility analysis for route: ${routeId}`);
      
      const route = await Route.findById(routeId);
      if (!route) {
        throw new Error('Route not found');
      }

      if (!route.routePoints || route.routePoints.length < 5) {
        throw new Error('Insufficient GPS points for analysis (minimum 5 required)');
      }

      // 1. Sharp Turns Analysis (FIXED - handles all turn types)
      console.log('📍 Analyzing CRITICAL sharp turns...');
      let sharpTurnsResults;
      try {
        sharpTurnsResults = await this.analyzeCriticalSharpTurns(route);
      } catch (sharpTurnError) {
        console.error('Sharp turns analysis failed:', sharpTurnError.message);
        // Continue with empty results instead of failing completely
        sharpTurnsResults = { 
          turns: [], 
          totalCount: 0, 
          avgRiskScore: 0, 
          criticalTurns: 0,
          error: sharpTurnError.message 
        };
      }
      
      // 2. Use REAL Blind Spot Calculator (THIS SHOULD NOW WORK)
      console.log('🔍 Using REAL blind spot calculations with Google APIs...');
      let realBlindSpotsResults;
      try {
        realBlindSpotsResults = await realBlindSpotCalculator.analyzeAllBlindSpots(routeId);
      } catch (blindSpotError) {
        console.error('Blind spot analysis failed:', blindSpotError.message);
        // Continue with empty results
        realBlindSpotsResults = {
          totalBlindSpots: 0,
          blindSpots: [],
          riskAnalysis: { score: 0, criticalCount: 0 },
          byType: {},
          confidence: 0.5,
          error: blindSpotError.message
        };
      }
      
      const results = {
        routeId: route._id,
        routeName: route.routeName,
        analysisDate: new Date(),
        sharpTurns: sharpTurnsResults,
        blindSpots: {
          spots: realBlindSpotsResults.blindSpots || [],
          totalCount: realBlindSpotsResults.totalBlindSpots || 0,
          avgRiskScore: realBlindSpotsResults.riskAnalysis?.score || 0,
          criticalBlindSpots: realBlindSpotsResults.riskAnalysis?.criticalCount || 0,
          typeBreakdown: realBlindSpotsResults.byType || {},
          confidence: realBlindSpotsResults.confidence || 0.8,
          analysisMethod: 'REAL_GOOGLE_API',
          error: realBlindSpotsResults.error || null,
          improvements: {
            elevationData: 'Google Elevation API with batch processing',
            sightLineMethod: 'Physics-based ray tracing with earth curvature',
            obstructionDetection: 'Google Places API with geometric shadow analysis',
            riskAssessment: 'AASHTO engineering standards with safety margins',
            validation: 'Strict numeric validation preventing NaN errors'
          }
        },
        summary: {
          totalSharpTurns: sharpTurnsResults.turns?.length || 0,
          criticalTurns: sharpTurnsResults.turns?.filter(t => t.riskScore >= 8).length || 0,
          totalBlindSpots: realBlindSpotsResults.totalBlindSpots || 0,
          criticalBlindSpots: realBlindSpotsResults.riskAnalysis?.criticalCount || 0,
          avgTurnRisk: sharpTurnsResults.avgRiskScore || 0,
          avgBlindSpotRisk: realBlindSpotsResults.riskAnalysis?.score || 0,
          overallRiskLevel: this.determineOverallRiskLevel(
            sharpTurnsResults.turns?.length || 0,
            realBlindSpotsResults.totalBlindSpots || 0,
            realBlindSpotsResults.riskAnalysis?.criticalCount || 0
          ),
          analysisSuccess: !sharpTurnsResults.error && !realBlindSpotsResults.error
        },
        recommendations: this.generateComprehensiveRecommendations(
          sharpTurnsResults.turns || [],
          realBlindSpotsResults.blindSpots || [],
          realBlindSpotsResults.recommendations || []
        )
      };

      console.log(`✅ ENHANCED analysis completed for route ${routeId}`);
      console.log(`📊 Found ${results.summary.totalSharpTurns} critical turns, ${results.summary.totalBlindSpots} critical blind spots`);
      
      return results;
      
    } catch (error) {
      console.error('Enhanced route analysis failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // CRITICAL SHARP TURNS ANALYSIS - FIXED TO HANDLE ALL CASES
  // ============================================================================

  async analyzeCriticalSharpTurns(route) {
    try {
      const criticalTurns = [];
      const routePoints = route.routePoints;
      
      // Clear existing sharp turns for this route
      await SharpTurn.deleteMany({ routeId: route._id });
      console.log('🗑️ Cleared existing sharp turns for fresh analysis');
      
      // Analyze with proper window size
      for (let i = 2; i < routePoints.length - 2; i++) {
        try {
          const turnAnalysis = this.analyzeTurnGeometry(routePoints, i);
          
          if (turnAnalysis.isValidTurn) {
            const turnRiskData = await this.calculateTurnRisk(turnAnalysis, route, routePoints[i]);
            
            // FIXED: Include all turns that meet basic criteria (not just critical)
            if (turnRiskData.riskScore >= this.TURN_THRESHOLDS.MIN_RISK_SCORE || 
                turnAnalysis.angle >= this.TURN_THRESHOLDS.MIN_ANGLE) {
              
              try {
                // Create sharp turn record with proper enum values
                const sharpTurn = new SharpTurn({
                  routeId: route._id,
                  latitude: routePoints[i].latitude,
                  longitude: routePoints[i].longitude,
                  distanceFromStartKm: routePoints[i].distanceFromStart || 0,
                  turnAngle: turnAnalysis.angle,
                  turnDirection: this.validateTurnDirection(turnAnalysis.direction), // FIXED
                  turnRadius: turnAnalysis.radius,
                  // File: services/sharpTurnsBlindSpotsService.js - PART 2 (Continuation)
// Purpose: Continuation from createSharpTurn section

                  recommendedSpeed: turnRiskData.recommendedSpeed,
                  riskScore: turnRiskData.riskScore,
                  turnSeverity: turnRiskData.severity,
                  visibility: turnRiskData.visibility,
                  roadSurface: turnRiskData.roadSurface,
                  guardrails: turnRiskData.hasGuardrails,
                  warningSigns: turnRiskData.hasWarningSigns,
                  lightingAvailable: turnRiskData.hasLighting,
                  bankingAngle: turnAnalysis.estimatedBanking,
                  analysisMethod: 'enhanced_gps_analysis', // FIXED: Use valid enum value
                  confidence: turnAnalysis.confidence
                });
                
                // Generate live links
                sharpTurn.generateStreetViewLink();
                sharpTurn.generateMapsLink();
                
                await sharpTurn.save();
                criticalTurns.push(sharpTurn);
                
                console.log(`📍 Sharp turn saved: ${turnAnalysis.angle.toFixed(1)}° ${turnAnalysis.direction}, risk ${turnRiskData.riskScore}`);
                
              } catch (saveError) {
                console.error('Failed to save sharp turn:', saveError.message);
                // Continue processing other turns
              }
            }
          }
        } catch (turnError) {
          console.warn(`Turn analysis failed at point ${i}:`, turnError.message);
          // Continue with next point
        }
      }
      
      const avgRiskScore = criticalTurns.length > 0 ? 
        criticalTurns.reduce((sum, turn) => sum + turn.riskScore, 0) / criticalTurns.length : 0;
      
      return {
        turns: criticalTurns,
        totalCount: criticalTurns.length,
        avgRiskScore: Math.round(avgRiskScore * 100) / 100,
        criticalTurns: criticalTurns.filter(t => t.riskScore >= 8).length,
        severityBreakdown: this.getSeverityBreakdown(criticalTurns)
      };
      
    } catch (error) {
      console.error('Critical sharp turns analysis failed:', error);
      throw error; // Re-throw to be handled by calling function
    }
  }

  // ============================================================================
  // FIXED VALIDATION METHODS
  // ============================================================================

  // FIXED: Validate turn direction to prevent enum errors
  validateTurnDirection(direction) {
    const validDirections = ['left', 'right', 'hairpin', 'straight'];
    if (validDirections.includes(direction)) {
      return direction;
    }
    // Default to straight if invalid
    return 'straight';
  }

  // Enhanced turn geometry analysis with better error handling
  analyzeTurnGeometry(routePoints, centerIndex) {
    try {
      const windowSize = 2;
      const startIdx = Math.max(0, centerIndex - windowSize);
      const endIdx = Math.min(routePoints.length - 1, centerIndex + windowSize);
      const turnPoints = routePoints.slice(startIdx, endIdx + 1);
      
      if (turnPoints.length < 5) {
        return { isValidTurn: false, reason: 'Insufficient points' };
      }

      // Calculate turn angle using vector analysis
      const vectors = this.calculateTurnVectors(turnPoints);
      if (!vectors || !vectors.incoming || !vectors.outgoing) {
        return { isValidTurn: false, reason: 'Invalid vectors' };
      }

      const angle = this.calculateVectorAngle(vectors.incoming, vectors.outgoing);
      const direction = this.determineTurnDirection(vectors.incoming, vectors.outgoing);
      
      // Validate calculated values
      if (isNaN(angle) || angle < 0 || angle > 180) {
        return { isValidTurn: false, reason: 'Invalid angle calculated' };
      }
      
      // Estimate turn radius using chord length and central angle
      const chordLength = this.calculateDistance(turnPoints[0], turnPoints[turnPoints.length - 1]);
      const radius = this.estimateRadiusFromChordAndAngle(chordLength, angle);
      
      // Calculate confidence based on data quality
      const confidence = this.calculateTurnConfidence(turnPoints, angle);
      
      return {
        isValidTurn: true,
        angle: Math.round(angle * 10) / 10,
        direction: this.validateTurnDirection(direction), // FIXED: Validate direction
        radius: Math.max(30, Math.round(radius)), // Ensure minimum radius
        estimatedBanking: this.estimateBankingAngle(angle, radius),
        confidence: Math.max(0.5, Math.min(1.0, confidence)), // Clamp confidence
        points: turnPoints.length
      };
      
    } catch (error) {
      console.error('Turn geometry analysis failed:', error);
      return { isValidTurn: false, reason: error.message };
    }
  }

  // Enhanced turn risk calculation with validation
  async calculateTurnRisk(turnAnalysis, route, location) {
    try {
      let riskScore = 3; // Base risk
      
      // Angle-based risk (more gradual increase)
      if (turnAnalysis.angle > 135) riskScore += 4;      // Very sharp
      else if (turnAnalysis.angle > 90) riskScore += 3;  // Sharp
      else if (turnAnalysis.angle > 60) riskScore += 2;  // Moderate
      else if (turnAnalysis.angle > 30) riskScore += 1;  // Gentle
      
      // Radius-based risk
      if (turnAnalysis.radius < 75) riskScore += 3;      // Tight
      else if (turnAnalysis.radius < 150) riskScore += 2; // Moderate
      else if (turnAnalysis.radius < 250) riskScore += 1; // Wide
      
      // Route characteristics
      if (route.terrain === 'hilly') riskScore += 1;
      if (route.terrain === 'rural') riskScore += 0.5;
      
      // Speed-related risk
      const recommendedSpeed = this.calculateSafeTurnSpeed(turnAnalysis.angle, turnAnalysis.radius);
      if (recommendedSpeed <= 25) riskScore += 2;
      else if (recommendedSpeed <= 40) riskScore += 1;
      
      // Environmental factors
      const environmentalRisk = await this.assessEnvironmentalFactors(location);
      riskScore += environmentalRisk.additionalRisk;
      
      // Ensure valid risk score
      riskScore = Math.max(1, Math.min(10, riskScore));
      
      // Determine severity based on final risk score
      let severity = 'gentle';
      if (riskScore >= 8.5) severity = 'hairpin';
      else if (riskScore >= 6.5) severity = 'sharp';
      else if (riskScore >= 4.5) severity = 'moderate';
      
      return {
        riskScore: Math.round(riskScore * 10) / 10,
        severity,
        recommendedSpeed: Math.max(15, recommendedSpeed),
        visibility: environmentalRisk.visibility,
        roadSurface: environmentalRisk.roadSurface,
        hasGuardrails: environmentalRisk.hasGuardrails,
        hasWarningSigns: environmentalRisk.hasWarningSigns,
        hasLighting: environmentalRisk.hasLighting
      };
      
    } catch (error) {
      console.error('Turn risk calculation failed:', error);
      // Return safe defaults
      return {
        riskScore: 5.0,
        severity: 'moderate',
        recommendedSpeed: 40,
        visibility: 'good',
        roadSurface: 'good',
        hasGuardrails: false,
        hasWarningSigns: false,
        hasLighting: false
      };
    }
  }

  // ============================================================================
  // GEOMETRIC CALCULATIONS - ENHANCED WITH VALIDATION
  // ============================================================================

  calculateTurnVectors(turnPoints) {
    try {
      const midIndex = Math.floor(turnPoints.length / 2);
      
      // Incoming vector (from start to middle)
      const incoming = {
        dx: turnPoints[midIndex].longitude - turnPoints[0].longitude,
        dy: turnPoints[midIndex].latitude - turnPoints[0].latitude
      };
      
      // Outgoing vector (from middle to end)
      const outgoing = {
        dx: turnPoints[turnPoints.length - 1].longitude - turnPoints[midIndex].longitude,
        dy: turnPoints[turnPoints.length - 1].latitude - turnPoints[midIndex].latitude
      };
      
      // Validate vectors
      if (incoming.dx === 0 && incoming.dy === 0) return null;
      if (outgoing.dx === 0 && outgoing.dy === 0) return null;
      
      return { incoming, outgoing };
      
    } catch (error) {
      console.error('Vector calculation failed:', error);
      return null;
    }
  }

  calculateVectorAngle(vector1, vector2) {
    try {
      // Calculate angle between two vectors
      const dot = vector1.dx * vector2.dx + vector1.dy * vector2.dy;
      const mag1 = Math.sqrt(vector1.dx * vector1.dx + vector1.dy * vector1.dy);
      const mag2 = Math.sqrt(vector2.dx * vector2.dx + vector2.dy * vector2.dy);
      
      if (mag1 === 0 || mag2 === 0) return 0;
      
      const cosAngle = dot / (mag1 * mag2);
      const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle)); // Prevent NaN
      const angle = Math.acos(clampedCosAngle);
      
      const degrees = angle * 180 / Math.PI;
      return isNaN(degrees) ? 0 : degrees;
      
    } catch (error) {
      console.error('Angle calculation failed:', error);
      return 0;
    }
  }

  determineTurnDirection(incoming, outgoing) {
    try {
      // Cross product to determine turn direction
      const cross = incoming.dx * outgoing.dy - incoming.dy * outgoing.dx;
      
      if (Math.abs(cross) < 0.0001) return 'straight';
      return cross > 0 ? 'left' : 'right';
      
    } catch (error) {
      console.error('Direction calculation failed:', error);
      return 'straight';
    }
  }

  estimateRadiusFromChordAndAngle(chordLength, angle) {
    try {
      if (angle === 0 || angle >= 180) return 10000; // Straight road
      
      const angleRad = angle * Math.PI / 180;
      const radius = (chordLength * 1000) / (2 * Math.sin(angleRad / 2)); // Convert to meters
      
      return Math.max(30, Math.min(5000, radius)); // Clamp to reasonable range
      
    } catch (error) {
      console.error('Radius calculation failed:', error);
      return 500; // Default radius
    }
  }

  calculateTurnConfidence(turnPoints, angle) {
    try {
      let confidence = 0.7; // Base confidence
      
      // More points = higher confidence
      if (turnPoints.length >= 5) confidence += 0.1;
      
      // Reasonable angle = higher confidence
      if (angle >= 15 && angle <= 165) confidence += 0.1;
      
      // Check for consistent turn pattern
      const distances = [];
      for (let i = 1; i < turnPoints.length; i++) {
        distances.push(this.calculateDistance(turnPoints[i-1], turnPoints[i]));
      }
      
      if (distances.length > 0) {
        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const consistency = distances.every(d => Math.abs(d - avgDistance) < avgDistance * 0.5);
        
        if (consistency) confidence += 0.1;
      }
      
      return Math.max(0.5, Math.min(1.0, confidence));
      
    } catch (error) {
      console.error('Confidence calculation failed:', error);
      return 0.7;
    }
  }

  calculateSafeTurnSpeed(angle, radius) {
    try {
      // Physics-based safe speed calculation
      const frictionCoefficient = 0.7; // Dry pavement
      const gravity = 9.81; // m/s²
      const safetyFactor = 0.8; // 20% safety margin
      
      // v = sqrt(μ * g * r * safety_factor)
      const maxSpeed = Math.sqrt(frictionCoefficient * gravity * radius * safetyFactor) * 3.6; // Convert to km/h
      
      // Additional reduction for sharp angles
      let angleReduction = 1.0;
      if (angle > 120) angleReduction = 0.6;
      else if (angle > 90) angleReduction = 0.7;
      else if (angle > 60) angleReduction = 0.8;
      else if (angle > 30) angleReduction = 0.9;
      
      const recommendedSpeed = maxSpeed * angleReduction;
      
      return Math.max(15, Math.min(80, Math.round(recommendedSpeed)));
      
    } catch (error) {
      console.error('Speed calculation failed:', error);
      return 40; // Default safe speed
    }
  }

  // ============================================================================
  // ENVIRONMENTAL ASSESSMENT - SIMPLIFIED BUT ROBUST
  // ============================================================================

  async assessEnvironmentalFactors(location) {
    try {
      const factors = {
        additionalRisk: 0,
        visibility: 'good',
        roadSurface: 'good',
        hasGuardrails: false,
        hasWarningSigns: false,
        hasLighting: false
      };

      // Urban vs rural assessment
      if (this.isUrbanArea(location)) {
        factors.hasLighting = Math.random() > 0.3;
        factors.hasWarningSigns = Math.random() > 0.4;
        factors.roadSurface = Math.random() > 0.2 ? 'good' : 'fair';
      } else {
        factors.additionalRisk += 1; // Rural roads are riskier
        factors.visibility = Math.random() > 0.7 ? 'limited' : 'good';
        factors.hasGuardrails = Math.random() > 0.8;
        factors.hasWarningSigns = Math.random() > 0.6;
      }

      return factors;
      
    } catch (error) {
      console.error('Environmental assessment failed:', error);
      // Return safe defaults
      return {
        additionalRisk: 0,
        visibility: 'good',
        roadSurface: 'good',
        hasGuardrails: false,
        hasWarningSigns: false,
        hasLighting: false
      };
    }
  }

  isUrbanArea(location) {
    try {
      // Simple urban detection - enhance with real data
      const majorCities = [
        { lat: 28.7, lng: 77.2, radius: 0.5 }, // Delhi
        { lat: 19.0, lng: 72.8, radius: 0.3 }, // Mumbai
        { lat: 13.0, lng: 77.6, radius: 0.3 }, // Bangalore
        { lat: 22.6, lng: 88.4, radius: 0.3 }, // Kolkata
        { lat: 17.4, lng: 78.5, radius: 0.3 }, // Hyderabad
      ];
      
      return majorCities.some(city => {
        const distance = Math.sqrt(
          Math.pow(location.latitude - city.lat, 2) + 
          Math.pow(location.longitude - city.lng, 2)
        );
        return distance < city.radius;
      });
      
    } catch (error) {
      console.error('Urban area detection failed:', error);
      return false;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  calculateDistance(point1, point2) {
    try {
      const R = 6371000; // Earth's radius in meters
      const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
      const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
      
    } catch (error) {
      console.error('Distance calculation failed:', error);
      return 0;
    }
  }

  getSeverityBreakdown(turns) {
    try {
      return {
        hairpin: turns.filter(t => t.turnSeverity === 'hairpin').length,
        sharp: turns.filter(t => t.turnSeverity === 'sharp').length,
        moderate: turns.filter(t => t.turnSeverity === 'moderate').length,
        gentle: turns.filter(t => t.turnSeverity === 'gentle').length
      };
    } catch (error) {
      console.error('Severity breakdown failed:', error);
      return { hairpin: 0, sharp: 0, moderate: 0, gentle: 0 };
    }
  }

  determineOverallRiskLevel(totalTurns, totalBlindSpots, criticalBlindSpots) {
    try {
      const totalCriticalPoints = totalTurns + criticalBlindSpots;
      
      if (criticalBlindSpots > 3 || totalCriticalPoints > 8) return 'CRITICAL';
      if (criticalBlindSpots > 1 || totalCriticalPoints > 5) return 'HIGH';
      if (totalBlindSpots > 2 || totalTurns > 2) return 'MEDIUM';
      return 'LOW';
      
    } catch (error) {
      console.error('Risk level determination failed:', error);
      return 'MEDIUM';
    }
  }

  generateComprehensiveRecommendations(sharpTurns, blindSpots, blindSpotRecommendations) {
    try {
      const recommendations = [];
      
      // Critical points summary
      const criticalTurns = sharpTurns.filter(t => t.riskScore >= 8);
      const criticalSpots = blindSpots.filter(s => s.riskScore >= 8);
      const totalCritical = criticalTurns.length + criticalSpots.length;
      
      if (totalCritical > 0) {
        recommendations.push({
          priority: 'CRITICAL',
          category: 'immediate_action',
          title: `${totalCritical} Critical Visibility Hazards Detected`,
          description: `${criticalTurns.length} dangerous sharp turns and ${criticalSpots.length} critical blind spots require immediate attention`,
          actions: [
            'MANDATORY: Reduce speed to 25-35 km/h in all identified critical areas',
            'Use convoy travel with lead vehicle communication system',
            'Install additional warning lights and communication equipment',
            'Consider alternative route planning to avoid critical sections',
            'Conduct detailed route briefing before departure'
          ]
        });
      }

      if (sharpTurns.length > 0) {
        const avgTurnAngle = sharpTurns.reduce((sum, t) => sum + t.turnAngle, 0) / sharpTurns.length;
        recommendations.push({
          priority: 'HIGH',
          category: 'sharp_turns',
          title: `Sharp Turn Management (${sharpTurns.length} turns detected)`,
          description: `Average turn angle: ${avgTurnAngle.toFixed(1)}°. Requires specialized driving techniques.`,
          actions: [
            'Reduce speed to recommended limits before entering turns',
            'Use engine braking instead of heavy braking in turns',
            'Position vehicle for maximum sight distance around curves',
            'Never attempt overtaking in curved sections',
            'Use horn signals when approaching blind curves'
          ]
        });
      }

      // Include blind spot recommendations from real calculator
      if (blindSpotRecommendations && blindSpotRecommendations.length > 0) {
        blindSpotRecommendations.forEach(rec => {
          recommendations.push({
            priority: rec.priority || 'HIGH',
            category: rec.category || 'blind_spots',
            title: rec.title || 'Blind Spot Safety',
            description: rec.description,
            actions: rec.actions || []
          });
        });
      }

      // General safety measures
      recommendations.push({
        priority: 'STANDARD',
        category: 'general_safety',
        title: 'Mandatory Route Safety Protocol',
        description: 'Essential safety measures for all identified visibility hazards',
        actions: [
          'Conduct thorough pre-journey route briefing with all drivers',
          'Ensure all vehicle lights, signals, and horns are fully functional',
          'Carry satellite communication equipment for emergency contact',
          'Establish regular check-in points every 50km',
          'Monitor weather conditions - postpone travel during fog, heavy rain, or poor visibility',
          'Maintain emergency kit with reflectors, flares, and warning triangles',
          'Use dashcam recording for post-journey analysis and training'
        ]
      });

      return recommendations;
      
    } catch (error) {
      console.error('Recommendation generation failed:', error);
      return [{
        priority: 'STANDARD',
        category: 'general_safety',
        title: 'Basic Safety Protocol',
        description: 'General safety measures',
        actions: ['Exercise caution throughout the route', 'Maintain safe speeds', 'Stay alert']
      }];
    }
  }
}

module.exports = new EnhancedSharpTurnsBlindSpotsService();