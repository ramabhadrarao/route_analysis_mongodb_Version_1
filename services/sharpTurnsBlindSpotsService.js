// File: services/sharpTurnsBlindSpotsService.js - FIXED VERSION
// Purpose: Enhanced service using REAL blind spot calculator with Google APIs
// Fixed: Integration with validated calculations and proper error handling

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
    
    // STRICT filtering for only CRITICAL sharp turns
    this.CRITICAL_TURN_THRESHOLDS = {
      MIN_ANGLE: 75,              // degrees - only very sharp turns
      MAX_RADIUS: 150,            // meters - tight turns only
      MIN_RISK_SCORE: 7.0,        // only high-risk turns
      MAX_SAFE_SPEED: 30          // km/h - dangerous speed limit
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
  // MAIN ENHANCED ANALYSIS - FIXED TO USE REAL CALCULATOR
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

      // 1. Sharp Turns Analysis (Enhanced but focused on critical turns only)
      console.log('📍 Analyzing CRITICAL sharp turns...');
      const sharpTurnsResults = await this.analyzeCriticalSharpTurns(route);
      
      // 2. Use REAL Blind Spot Calculator
      console.log('🔍 Using REAL blind spot calculations with Google APIs...');
      const realBlindSpotsResults = await realBlindSpotCalculator.analyzeAllBlindSpots(routeId);
      
      const results = {
        routeId: route._id,
        routeName: route.routeName,
        analysisDate: new Date(),
        sharpTurns: sharpTurnsResults,
        blindSpots: {
          // REAL analysis results from validated calculator
          spots: realBlindSpotsResults.blindSpots || [],
          totalCount: realBlindSpotsResults.totalBlindSpots || 0,
          avgRiskScore: realBlindSpotsResults.riskAnalysis?.score || 0,
          criticalBlindSpots: realBlindSpotsResults.riskAnalysis?.criticalCount || 0,
          typeBreakdown: realBlindSpotsResults.byType || {},
          confidence: realBlindSpotsResults.confidence || 0.8,
          analysisMethod: 'REAL_GOOGLE_API',
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
          )
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
  // CRITICAL SHARP TURNS ANALYSIS - FOCUSED ON HIGH-RISK ONLY
  // ============================================================================

  async analyzeCriticalSharpTurns(route) {
    try {
      const criticalTurns = [];
      const routePoints = route.routePoints;
      
      // Analyze with larger windows for better accuracy
      for (let i = 2; i < routePoints.length - 2; i++) {
        const turnAnalysis = this.analyzeTurnGeometry(routePoints, i);
        
        // STRICT filtering - only truly dangerous turns
        if (this.isCriticalTurn(turnAnalysis)) {
          const turnRiskData = await this.calculateTurnRisk(turnAnalysis, route, routePoints[i]);
          
          if (turnRiskData.riskScore >= this.CRITICAL_TURN_THRESHOLDS.MIN_RISK_SCORE) {
            // Capture visual data for critical turns
            const visualData = await this.captureSharpTurnVisuals(routePoints[i], turnAnalysis);
            
            const sharpTurn = new SharpTurn({
              routeId: route._id,
              latitude: routePoints[i].latitude,
              longitude: routePoints[i].longitude,
              distanceFromStartKm: routePoints[i].distanceFromStart || 0,
              turnAngle: turnAnalysis.angle,
              turnDirection: turnAnalysis.direction,
              turnRadius: turnAnalysis.radius,
              recommendedSpeed: turnRiskData.recommendedSpeed,
              riskScore: turnRiskData.riskScore,
              turnSeverity: turnRiskData.severity,
              streetViewImage: visualData.streetView,
              mapImage: visualData.mapImage,
              visibility: turnRiskData.visibility,
              roadSurface: turnRiskData.roadSurface,
              guardrails: turnRiskData.hasGuardrails,
              warningSigns: turnRiskData.hasWarningSigns,
              lightingAvailable: turnRiskData.hasLighting,
              bankingAngle: turnAnalysis.estimatedBanking,
              analysisMethod: 'enhanced_gps_analysis',
              confidence: turnAnalysis.confidence
            });
            
            // Generate live links
            sharpTurn.generateStreetViewLink();
            sharpTurn.generateMapsLink();
            
            await sharpTurn.save();
            criticalTurns.push(sharpTurn);
            
            console.log(`📍 CRITICAL sharp turn: ${turnAnalysis.angle.toFixed(1)}° ${turnAnalysis.direction}, risk ${turnRiskData.riskScore}`);
          }
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
      return { turns: [], totalCount: 0, avgRiskScore: 0, criticalTurns: 0 };
    }
  }

  // Enhanced turn geometry analysis
  analyzeTurnGeometry(routePoints, centerIndex) {
    const windowSize = 2; // Use 5-point window for better accuracy
    const startIdx = Math.max(0, centerIndex - windowSize);
    const endIdx = Math.min(routePoints.length - 1, centerIndex + windowSize);
    const turnPoints = routePoints.slice(startIdx, endIdx + 1);
    
    if (turnPoints.length < 5) {
      return { isValidTurn: false };
    }

    // Calculate turn angle using vector analysis
    const vectors = this.calculateTurnVectors(turnPoints);
    const angle = this.calculateVectorAngle(vectors.incoming, vectors.outgoing);
    const direction = this.determineTurnDirection(vectors.incoming, vectors.outgoing);
    
    // Estimate turn radius using chord length and central angle
    const chordLength = this.calculateDistance(turnPoints[0], turnPoints[turnPoints.length - 1]);
    const radius = this.estimateRadiusFromChordAndAngle(chordLength, angle);
    
    // Calculate confidence based on data quality
    const confidence = this.calculateTurnConfidence(turnPoints, angle);
    
    return {
      isValidTurn: true,
      angle: Math.round(angle * 10) / 10,
      direction,
      radius: Math.round(radius),
      estimatedBanking: this.estimateBankingAngle(angle, radius),
      confidence,
      points: turnPoints.length
    };
  }

  // Check if turn meets critical thresholds
  isCriticalTurn(turnAnalysis) {
    if (!turnAnalysis.isValidTurn) return false;
    
    return (
      turnAnalysis.angle >= this.CRITICAL_TURN_THRESHOLDS.MIN_ANGLE &&
      turnAnalysis.radius <= this.CRITICAL_TURN_THRESHOLDS.MAX_RADIUS &&
      turnAnalysis.radius >= 30 && // Minimum physically possible radius
      turnAnalysis.confidence >= 0.7
    );
  }

  // Enhanced turn risk calculation
  async calculateTurnRisk(turnAnalysis, route, location) {
    let riskScore = 3; // Base risk
    
    // Angle-based risk (exponential increase for sharper turns)
    if (turnAnalysis.angle > 135) riskScore += 5;      // Hairpin
    else if (turnAnalysis.angle > 105) riskScore += 4; // Very sharp
    else if (turnAnalysis.angle > 75) riskScore += 3;  // Sharp
    else if (turnAnalysis.angle > 45) riskScore += 2;  // Moderate
    
    // Radius-based risk (tighter = more dangerous)
    if (turnAnalysis.radius < 50) riskScore += 4;      // Very tight
    else if (turnAnalysis.radius < 100) riskScore += 3; // Tight
    else if (turnAnalysis.radius < 150) riskScore += 2; // Moderate
    
    // Route characteristics
    if (route.terrain === 'hilly') riskScore += 2;
    if (route.terrain === 'rural') riskScore += 1;
    
    // Speed-related risk
    const recommendedSpeed = this.calculateSafeTurnSpeed(turnAnalysis.angle, turnAnalysis.radius);
    if (recommendedSpeed <= this.CRITICAL_TURN_THRESHOLDS.MAX_SAFE_SPEED) riskScore += 2;
    
    // Environmental factors (simplified - would integrate with Google APIs)
    const environmentalRisk = await this.assessEnvironmentalFactors(location);
    riskScore += environmentalRisk.additionalRisk;
    
    // Determine severity
    let severity = 'moderate';
    if (riskScore >= 9) severity = 'hairpin';
    else if (riskScore >= 7) severity = 'sharp';
    else if (riskScore >= 5) severity = 'moderate';
    else severity = 'gentle';
    
    return {
      riskScore: Math.max(1, Math.min(10, riskScore)),
      severity,
      recommendedSpeed,
      visibility: environmentalRisk.visibility,
      roadSurface: environmentalRisk.roadSurface,
      hasGuardrails: environmentalRisk.hasGuardrails,
      hasWarningSigns: environmentalRisk.hasWarningSigns,
      hasLighting: environmentalRisk.hasLighting
    };
  }

  // ============================================================================
  // VISUAL DATA CAPTURE - ENHANCED
  // ============================================================================

  async captureSharpTurnVisuals(point, turnData) {
    try {
      const visualData = { streetView: null, mapImage: null };
      
      if (!this.googleMapsApiKey) {
        console.warn('⚠️ Google Maps API key not configured for visual capture');
        return visualData;
        }
      
      // Capture Street View image with optimal heading
      const optimalHeading = this.calculateOptimalHeading(turnData.direction, turnData.angle);
      const streetViewUrl = await this.getEnhancedStreetViewImage(
        point.latitude, 
        point.longitude, 
        optimalHeading
      );
      
      if (streetViewUrl) {
        const filename = `critical-turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const imagePath = await this.downloadImage(streetViewUrl, 'sharp-turns', filename);
        
        if (imagePath) {
          visualData.streetView = {
            url: `/images/sharp-turns/${filename}`,
            filename: filename,
            heading: optimalHeading,
            pitch: 0,
            fov: 90
          };
        }
      }
      
      // Capture high-resolution satellite map
      const mapImageUrl = await this.getEnhancedMapImage(point.latitude, point.longitude);
      if (mapImageUrl) {
        const filename = `turn-map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const imagePath = await this.downloadImage(mapImageUrl, 'sharp-turns', filename);
        
        if (imagePath) {
          visualData.mapImage = {
            url: `/images/sharp-turns/${filename}`,
            filename: filename,
            zoom: 18,
            mapType: 'satellite'
          };
        }
      }
      
      return visualData;
      
    } catch (error) {
      console.error('Failed to capture turn visuals:', error);
      return { streetView: null, mapImage: null };
    }
  }

  async getEnhancedStreetViewImage(latitude, longitude, heading) {
    try {
      const url = `https://maps.googleapis.com/maps/api/streetview?` +
        `size=640x640&` +
        `location=${latitude},${longitude}&` +
        `heading=${heading}&` +
        `pitch=0&` +
        `fov=90&` +
        `key=${this.googleMapsApiKey}`;

      return url;
    } catch (error) {
      console.error('Failed to generate enhanced Street View URL:', error);
      return null;
    }
  }

  async getEnhancedMapImage(latitude, longitude) {
    try {
      const url = `https://maps.googleapis.com/maps/api/staticmap?` +
        `center=${latitude},${longitude}&` +
        `zoom=18&` +
        `size=640x640&` +
        `maptype=satellite&` +
        `markers=color:red|${latitude},${longitude}&` +
        `key=${this.googleMapsApiKey}`;

      return url;
    } catch (error) {
      console.error('Failed to generate enhanced map URL:', error);
      return null;
    }
  }

  async downloadImage(imageUrl, subfolder, filename) {
    try {
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream',
        timeout: 10000
      });

      const imagePath = path.join(this.imageStoragePath, subfolder, filename);
      const writer = fs.createWriteStream(imagePath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(imagePath));
        writer.on('error', reject);
      });

    } catch (error) {
      console.error('Failed to download image:', error);
      return null;
    }
  }

  // ============================================================================
  // GEOMETRIC CALCULATIONS - ENHANCED
  // ============================================================================

  calculateTurnVectors(turnPoints) {
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
    
    return { incoming, outgoing };
  }

  calculateVectorAngle(vector1, vector2) {
    // Calculate angle between two vectors
    const dot = vector1.dx * vector2.dx + vector1.dy * vector2.dy;
    const mag1 = Math.sqrt(vector1.dx * vector1.dx + vector1.dy * vector1.dy);
    const mag2 = Math.sqrt(vector2.dx * vector2.dx + vector2.dy * vector2.dy);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))); // Clamp to avoid NaN
    
    return angle * 180 / Math.PI;
  }

  determineTurnDirection(incoming, outgoing) {
    // Cross product to determine turn direction
    const cross = incoming.dx * outgoing.dy - incoming.dy * outgoing.dx;
    
    if (Math.abs(cross) < 0.0001) return 'straight';
    return cross > 0 ? 'left' : 'right';
  }

  estimateRadiusFromChordAndAngle(chordLength, angle) {
    if (angle === 0) return 10000; // Straight road
    
    const angleRad = angle * Math.PI / 180;
    const radius = (chordLength * 1000) / (2 * Math.sin(angleRad / 2)); // Convert to meters
    
    return Math.max(30, Math.min(5000, radius)); // Clamp to reasonable range
  }

  calculateTurnConfidence(turnPoints, angle) {
    let confidence = 0.8; // Base confidence
    
    // More points = higher confidence
    if (turnPoints.length >= 5) confidence += 0.1;
    
    // Reasonable angle = higher confidence
    if (angle >= 15 && angle <= 180) confidence += 0.1;
    
    // Check for consistent turn pattern
    const distances = [];
    for (let i = 1; i < turnPoints.length; i++) {
      distances.push(this.calculateDistance(turnPoints[i-1], turnPoints[i]));
    }
    
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const consistency = distances.every(d => Math.abs(d - avgDistance) < avgDistance * 0.5);
    
    if (consistency) confidence += 0.1;
    
    return Math.max(0.5, Math.min(1.0, confidence));
  }

  calculateSafeTurnSpeed(angle, radius) {
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
    
    const recommendedSpeed = maxSpeed * angleReduction;
    
    return Math.max(15, Math.min(80, Math.round(recommendedSpeed)));
  }

  estimateBankingAngle(turnAngle, radius) {
    // Estimate road banking based on turn characteristics
    if (radius > 500) return 0; // No banking on gentle curves
    
    const bankingFactor = Math.max(0, (180 - turnAngle) / 180);
    const radiusFactor = Math.max(0, (500 - radius) / 500);
    
    return Math.round(bankingFactor * radiusFactor * 8); // Max 8% banking
  }

  calculateOptimalHeading(turnDirection, turnAngle) {
    // Calculate optimal camera heading for turn visualization
    let baseHeading = 0; // North
    
    if (turnDirection === 'left') {
      baseHeading = 315; // Northwest - good view of left turn
    } else if (turnDirection === 'right') {
      baseHeading = 45; // Northeast - good view of right turn
    }
    
    // Adjust based on turn sharpness
    const adjustment = Math.min(30, turnAngle / 4);
    
    return (baseHeading + adjustment) % 360;
  }

  // ============================================================================
  // ENVIRONMENTAL ASSESSMENT
  // ============================================================================

  async assessEnvironmentalFactors(location) {
    // Simplified environmental assessment - would integrate with Google APIs
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
  }

  isUrbanArea(location) {
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
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  calculateDistance(point1, point2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  getSeverityBreakdown(turns) {
    return {
      hairpin: turns.filter(t => t.turnSeverity === 'hairpin').length,
      sharp: turns.filter(t => t.turnSeverity === 'sharp').length,
      moderate: turns.filter(t => t.turnSeverity === 'moderate').length,
      gentle: turns.filter(t => t.turnSeverity === 'gentle').length
    };
  }

  determineOverallRiskLevel(totalTurns, totalBlindSpots, criticalBlindSpots) {
    const totalCriticalPoints = totalTurns + criticalBlindSpots;
    
    if (criticalBlindSpots > 3 || totalCriticalPoints > 8) return 'CRITICAL';
    if (criticalBlindSpots > 1 || totalCriticalPoints > 5) return 'HIGH';
    if (totalBlindSpots > 2 || totalTurns > 2) return 'MEDIUM';
    return 'LOW';
  }

  generateComprehensiveRecommendations(sharpTurns, blindSpots, blindSpotRecommendations) {
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
        title: `Sharp Turn Management (${sharpTurns.length} critical turns)`,
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
    if (blindSpotRecommendations.length > 0) {
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
  }

  // ============================================================================
  // BATCH PROCESSING AND ANALYSIS
  // ============================================================================

  async analyzeMultipleRoutes(routeIds) {
    const results = [];
    
    for (const routeId of routeIds) {
      try {
        console.log(`🔄 Processing route ${routeId}...`);
        const analysis = await this.analyzeRoute(routeId);
        results.push({
          routeId,
          success: true,
          analysis,
          criticalPoints: analysis.summary.criticalTurns + analysis.summary.criticalBlindSpots
        });
      } catch (error) {
        console.error(`Failed to analyze route ${routeId}:`, error);
        results.push({
          routeId,
          success: false,
          error: error.message
        });
      }
    }
    
    // Sort by criticality
    results.sort((a, b) => {
      if (!a.success) return 1;
      if (!b.success) return -1;
      return (b.criticalPoints || 0) - (a.criticalPoints || 0);
    });
    
    return {
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      summary: {
        mostCriticalRoute: results.find(r => r.success && r.criticalPoints > 0),
        totalCriticalPoints: results.reduce((sum, r) => sum + (r.criticalPoints || 0), 0)
      }
    };
  }

  // Enhanced visual capture for blind spots (to be used if needed)
  async captureBlindSpotVisuals(point, spotType) {
    try {
      const visualData = {
        streetViewImages: [],
        aerialImage: null
      };
      
      if (!this.googleMapsApiKey) {
        return visualData;
      }

      // Capture multiple angles for comprehensive view
      const headings = [0, 90, 180, 270];
      
      for (const heading of headings) {
        const streetViewUrl = await this.getEnhancedStreetViewImage(
          point.latitude, 
          point.longitude, 
          heading
        );
        
        if (streetViewUrl) {
          const filename = `blind-spot-${spotType}-${heading}-${Date.now()}.jpg`;
          const imagePath = await this.downloadImage(streetViewUrl, 'blind-spots', filename);
          
          if (imagePath) {
            visualData.streetViewImages.push({
              url: `/images/blind-spots/${filename}`,
              filename: filename,
              heading: heading,
              pitch: 0,
              description: this.getDirectionDescription(heading)
            });
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Capture aerial view
      const aerialUrl = await this.getEnhancedMapImage(point.latitude, point.longitude);
      if (aerialUrl) {
        const filename = `aerial-${spotType}-${Date.now()}.jpg`;
        const imagePath = await this.downloadImage(aerialUrl, 'blind-spots', filename);
        
        if (imagePath) {
          visualData.aerialImage = {
            url: `/images/blind-spots/${filename}`,
            filename: filename,
            zoom: 18
          };
        }
      }
      
      return visualData;
      
    } catch (error) {
      console.error('Failed to capture blind spot visuals:', error);
      return { streetViewImages: [], aerialImage: null };
    }
  }

  getDirectionDescription(heading) {
    if (heading >= 315 || heading < 45) return 'North view';
    if (heading >= 45 && heading < 135) return 'East view';
    if (heading >= 135 && heading < 225) return 'South view';
    return 'West view';
  }
}

module.exports = new EnhancedSharpTurnsBlindSpotsService();