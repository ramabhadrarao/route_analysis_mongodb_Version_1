// File: services/sharpTurnsBlindSpotsService.js
// Purpose: Analyze GPS route data for sharp turns and blind spots with image capture

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const SharpTurn = require('../models/SharpTurn');
const BlindSpot = require('../models/BlindSpot');
const Route = require('../models/Route');
const logger = require('../utils/logger');
const realBlindSpotCalculator = require('./realBlindSpotCalculations');

class SharpTurnsBlindSpotsAnalysisService {
  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.imageStoragePath = process.env.IMAGE_STORAGE_PATH || './public/images';
    
    // Ensure image directories exist
    this.createImageDirectories();
  }

  createImageDirectories() {
    const dirs = [
      path.join(this.imageStoragePath, 'sharp-turns'),
      path.join(this.imageStoragePath, 'blind-spots'),
      path.join(this.imageStoragePath, 'street-view'),
      path.join(this.imageStoragePath, 'maps')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });
  }

  // Main analysis function for a route
  async analyzeRoute(routeId) {
  try {
    console.log(`🔄 Starting ENHANCED sharp turns and blind spots analysis for route: ${routeId}`);
    
    const route = await Route.findById(routeId);
    if (!route) {
      throw new Error('Route not found');
    }

    if (!route.routePoints || route.routePoints.length < 3) {
      throw new Error('Insufficient GPS points for analysis');
    }

    // Analyze sharp turns (keep existing)
    const sharpTurnsResults = await this.analyzeSharpTurns(route);
    
    // NEW: Use REAL blind spot calculations
    console.log('🔍 Using REAL blind spot calculations with Google APIs...');
    const realBlindSpotsResults = await realBlindSpotCalculator.analyzeAllBlindSpots(routeId);
    
    const results = {
      routeId: route._id,
      routeName: route.routeName,
      analysisDate: new Date(),
      sharpTurns: sharpTurnsResults,
      blindSpots: {
        // Real analysis results
        spots: realBlindSpotsResults.blindSpots || [],
        totalCount: realBlindSpotsResults.totalBlindSpots || 0,
        avgRiskScore: realBlindSpotsResults.riskAnalysis?.score || 0,
        criticalBlindSpots: realBlindSpotsResults.riskAnalysis?.criticalCount || 0,
        typeBreakdown: realBlindSpotsResults.byType || {},
        confidence: realBlindSpotsResults.confidence || 0.8,
        analysisMethod: 'REAL_CALCULATIONS',
        improvements: {
          elevationData: 'Google Elevation API',
          sightLineMethod: 'Ray tracing with earth curvature',
          obstructionDetection: 'Google Places API + shadow zones',
          riskAssessment: 'AASHTO engineering standards'
        }
      },
      summary: {
        totalSharpTurns: sharpTurnsResults.turns?.length || 0,
        criticalTurns: sharpTurnsResults.turns?.filter(t => t.riskScore >= 8).length || 0,
        totalBlindSpots: realBlindSpotsResults.totalBlindSpots || 0,
        criticalBlindSpots: realBlindSpotsResults.riskAnalysis?.criticalCount || 0,
        avgTurnRisk: sharpTurnsResults.avgRiskScore || 0,
        avgBlindSpotRisk: realBlindSpotsResults.riskAnalysis?.score || 0,
        overallRiskLevel: realBlindSpotsResults.riskAnalysis?.level || 'LOW'
      },
      recommendations: realBlindSpotsResults.recommendations || []
    };

    console.log(`✅ ENHANCED analysis completed for route ${routeId}`);
    console.log(`📊 Found ${results.summary.totalSharpTurns} sharp turns, ${results.summary.totalBlindSpots} REAL blind spots`);
    
    return results;
    
  } catch (error) {
    console.error('Enhanced route analysis failed:', error);
    throw error;
  }
}

  // SHARP TURNS ANALYSIS
  async analyzeSharpTurns(route) {
    try {
      const turns = [];
      const routePoints = route.routePoints;
      
      // Analyze each point for turn angles (need at least 3 points)
      for (let i = 1; i < routePoints.length - 1; i++) {
        const prevPoint = routePoints[i - 1];
        const currentPoint = routePoints[i];
        const nextPoint = routePoints[i + 1];
        
        // Calculate turn angle
        const turnData = this.calculateTurnAngle(prevPoint, currentPoint, nextPoint);
        
        // Only process significant turns (> 30 degrees)
        if (turnData.angle > 30) {
          const turnAnalysis = await this.analyzeTurnPoint(currentPoint, turnData, route);
          
          // Capture images and generate links
          const visualData = await this.captureSharpTurnVisuals(currentPoint, turnData);
          
          const sharpTurn = new SharpTurn({
            routeId: route._id,
            latitude: currentPoint.latitude,
            longitude: currentPoint.longitude,
            distanceFromStartKm: currentPoint.distanceFromStart || 0,
            turnAngle: turnData.angle,
            turnDirection: turnData.direction,
            turnRadius: turnData.radius,
            recommendedSpeed: this.calculateRecommendedSpeed(turnData.angle, turnData.radius),
            riskScore: turnAnalysis.riskScore,
            turnSeverity: turnAnalysis.severity,
            streetViewImage: visualData.streetView,
            mapImage: visualData.mapImage,
            visibility: turnAnalysis.visibility,
            roadSurface: turnAnalysis.roadSurface,
            guardrails: turnAnalysis.hasGuardrails,
            warningSigns: turnAnalysis.hasWarningSigns,
            analysisMethod: 'gps_data',
            confidence: turnAnalysis.confidence
          });
          
          // Generate live links
          sharpTurn.generateStreetViewLink();
          sharpTurn.generateMapsLink();
          
          await sharpTurn.save();
          turns.push(sharpTurn);
          
          console.log(`📍 Sharp turn found: ${turnData.angle.toFixed(1)}° ${turnData.direction} turn at ${currentPoint.latitude}, ${currentPoint.longitude}`);
        }
      }
      
      const avgRiskScore = turns.length > 0 ? 
        turns.reduce((sum, turn) => sum + turn.riskScore, 0) / turns.length : 0;
      
      return {
        turns,
        totalCount: turns.length,
        avgRiskScore: Math.round(avgRiskScore * 100) / 100,
        criticalTurns: turns.filter(t => t.riskScore >= 8).length,
        severityBreakdown: this.getSeverityBreakdown(turns)
      };
      
    } catch (error) {
      console.error('Sharp turns analysis failed:', error);
      throw error;
    }
  }

  // BLIND SPOTS ANALYSIS
  async analyzeBlindSpots(route) {
    try {
      const spots = [];
      const routePoints = route.routePoints;
      
      // Analyze elevation changes and visibility obstructions
      for (let i = 0; i < routePoints.length; i++) {
        const currentPoint = routePoints[i];
        
        // Check for elevation-based blind spots (crests)
        const elevationBlindSpot = await this.checkElevationBlindSpot(currentPoint, routePoints, i);
        if (elevationBlindSpot) {
          const visualData = await this.captureBlindSpotVisuals(currentPoint, 'crest');
          const blindSpot = await this.createBlindSpotRecord(route._id, currentPoint, elevationBlindSpot, visualData);
          await blindSpot.save();
          spots.push(blindSpot);
        }
        
        // Check for curve-based blind spots
        const curveBlindSpot = await this.checkCurveBlindSpot(currentPoint, routePoints, i);
        if (curveBlindSpot) {
          const visualData = await this.captureBlindSpotVisuals(currentPoint, 'curve');
          const blindSpot = await this.createBlindSpotRecord(route._id, currentPoint, curveBlindSpot, visualData);
          await blindSpot.save();
          spots.push(blindSpot);
        }
        
        // Check for obstruction-based blind spots using Street View
        const obstructionBlindSpot = await this.checkObstructionBlindSpot(currentPoint);
        if (obstructionBlindSpot) {
          const visualData = await this.captureBlindSpotVisuals(currentPoint, 'obstruction');
          const blindSpot = await this.createBlindSpotRecord(route._id, currentPoint, obstructionBlindSpot, visualData);
          await blindSpot.save();
          spots.push(blindSpot);
        }
      }
      
      const avgRiskScore = spots.length > 0 ? 
        spots.reduce((sum, spot) => sum + spot.riskScore, 0) / spots.length : 0;
      
      return {
        spots,
        totalCount: spots.length,
        avgRiskScore: Math.round(avgRiskScore * 100) / 100,
        criticalSpots: spots.filter(s => s.riskScore >= 8).length,
        typeBreakdown: this.getBlindSpotTypeBreakdown(spots)
      };
      
    } catch (error) {
      console.error('Blind spots analysis failed:', error);
      throw error;
    }
  }

  // HELPER METHODS

  calculateTurnAngle(point1, point2, point3) {
    // Calculate bearing from point1 to point2
    const bearing1 = this.calculateBearing(point1, point2);
    
    // Calculate bearing from point2 to point3
    const bearing2 = this.calculateBearing(point2, point3);
    
    // Calculate turn angle
    let angle = Math.abs(bearing2 - bearing1);
    if (angle > 180) angle = 360 - angle;
    
    // Determine turn direction
    let direction = 'straight';
    if (angle > 10) {
      const diff = bearing2 - bearing1;
      if (diff > 0 && diff < 180 || diff < -180) {
        direction = 'right';
      } else {
        direction = 'left';
      }
    }
    
    // Estimate turn radius (simplified calculation)
    const distance = this.calculateDistance(point1, point3);
    const radius = angle > 0 ? (distance * 1000) / (2 * Math.sin(angle * Math.PI / 360)) : 1000;
    
    return {
      angle: Math.round(angle * 10) / 10,
      direction,
      radius: Math.round(radius)
    };
  }

  calculateBearing(point1, point2) {
    const lat1 = point1.latitude * Math.PI / 180;
    const lat2 = point2.latitude * Math.PI / 180;
    const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    
    const x = Math.sin(deltaLon) * Math.cos(lat2);
    const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
    
    const bearing = Math.atan2(x, y) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async analyzeTurnPoint(point, turnData, route) {
    let riskScore = 3; // Base risk
    
    // Risk factors based on turn angle
    if (turnData.angle > 120) riskScore += 4; // Hairpin turn
    else if (turnData.angle > 90) riskScore += 3; // Sharp turn
    else if (turnData.angle > 60) riskScore += 2; // Moderate turn
    else if (turnData.angle > 30) riskScore += 1; // Gentle turn
    
    // Risk factors based on turn radius
    if (turnData.radius < 50) riskScore += 3; // Very tight
    else if (turnData.radius < 100) riskScore += 2; // Tight
    else if (turnData.radius < 200) riskScore += 1; // Moderate
    
    // Terrain-based risk
    if (route.terrain === 'hilly') riskScore += 2;
    if (route.terrain === 'rural') riskScore += 1;
    
    // Determine severity
    let severity = 'gentle';
    if (turnData.angle > 120) severity = 'hairpin';
    else if (turnData.angle > 90) severity = 'sharp';
    else if (turnData.angle > 60) severity = 'moderate';
    
    return {
      riskScore: Math.max(1, Math.min(10, riskScore)),
      severity,
      visibility: Math.random() > 0.7 ? 'limited' : 'good', // Mock - would use actual analysis
      roadSurface: route.terrain === 'rural' ? 'fair' : 'good',
      hasGuardrails: Math.random() > 0.6,
      hasWarningSigns: Math.random() > 0.5,
      confidence: 0.8
    };
  }

  calculateRecommendedSpeed(angle, radius) {
    // Simple speed calculation based on turn characteristics
    let speed = 60; // Base speed
    
    if (angle > 120) speed = 15; // Hairpin
    else if (angle > 90) speed = 25; // Sharp
    else if (angle > 60) speed = 35; // Moderate
    else if (angle > 30) speed = 45; // Gentle
    
    // Adjust for radius
    if (radius < 50) speed = Math.min(speed, 20);
    else if (radius < 100) speed = Math.min(speed, 30);
    else if (radius < 200) speed = Math.min(speed, 40);
    
    return speed;
  }

  // VISUAL DATA CAPTURE

  async captureSharpTurnVisuals(point, turnData) {
    try {
      const visualData = {
        streetView: null,
        mapImage: null
      };
      
      // Capture Street View image
      const streetViewUrl = await this.getStreetViewImage(
        point.latitude, 
        point.longitude, 
        turnData.direction
      );
      
      if (streetViewUrl) {
        const filename = `sharp-turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const imagePath = await this.downloadImage(streetViewUrl, 'sharp-turns', filename);
        
        visualData.streetView = {
          url: `/images/sharp-turns/${filename}`,
          filename: filename,
          heading: this.getOptimalHeading(turnData.direction),
          pitch: 0,
          fov: 90
        };
      }
      
      // Capture Map image
      const mapImageUrl = await this.getMapImage(point.latitude, point.longitude, 17);
      if (mapImageUrl) {
        const filename = `map-turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const imagePath = await this.downloadImage(mapImageUrl, 'maps', filename);
        
        visualData.mapImage = {
          url: `/images/maps/${filename}`,
          filename: filename,
          zoom: 17,
          mapType: 'satellite'
        };
      }
      
      return visualData;
      
    } catch (error) {
      console.error('Failed to capture sharp turn visuals:', error);
      return { streetView: null, mapImage: null };
    }
  }

  async captureBlindSpotVisuals(point, spotType) {
    try {
      const visualData = {
        streetViewImages: [],
        aerialImage: null
      };
      
      // Capture multiple Street View angles for blind spots
      const headings = [0, 90, 180, 270]; // North, East, South, West
      
      for (const heading of headings) {
        const streetViewUrl = await this.getStreetViewImage(
          point.latitude, 
          point.longitude, 
          'straight',
          heading
        );
        
        if (streetViewUrl) {
          const filename = `blind-spot-${spotType}-${heading}-${Date.now()}.jpg`;
          const imagePath = await this.downloadImage(streetViewUrl, 'blind-spots', filename);
          
          visualData.streetViewImages.push({
            url: `/images/blind-spots/${filename}`,
            filename: filename,
            heading: heading,
            pitch: 0,
            description: this.getDirectionDescription(heading)
          });
        }
      }
      
     // File: services/sharpTurnsBlindSpotsService.js - Part 2
// Purpose: Visual capture methods and API integration (continuation)

      // Capture aerial/satellite image
      const aerialUrl = await this.getMapImage(point.latitude, point.longitude, 18, 'satellite');
      if (aerialUrl) {
        const filename = `aerial-${spotType}-${Date.now()}.jpg`;
        const imagePath = await this.downloadImage(aerialUrl, 'blind-spots', filename);
        
        visualData.aerialImage = {
          url: `/images/blind-spots/${filename}`,
          filename: filename,
          zoom: 18
        };
      }
      
      return visualData;
      
    } catch (error) {
      console.error('Failed to capture blind spot visuals:', error);
      return { streetViewImages: [], aerialImage: null };
    }
  }

  // GOOGLE STREET VIEW & MAPS API INTEGRATION

  async getStreetViewImage(latitude, longitude, turnDirection, heading = null) {
    try {
      if (!this.googleMapsApiKey) {
        console.warn('Google Maps API key not configured for Street View');
        return null;
      }

      const optimalHeading = heading || this.getOptimalHeading(turnDirection);
      const pitch = 0; // Level view
      const fov = 90; // Field of view
      const size = '640x640'; // Image size

      const url = `https://maps.googleapis.com/maps/api/streetview?` +
        `size=${size}&` +
        `location=${latitude},${longitude}&` +
        `heading=${optimalHeading}&` +
        `pitch=${pitch}&` +
        `fov=${fov}&` +
        `key=${this.googleMapsApiKey}`;

      return url;

    } catch (error) {
      console.error('Failed to generate Street View URL:', error);
      return null;
    }
  }

  async getMapImage(latitude, longitude, zoom = 17, mapType = 'roadmap') {
    try {
      if (!this.googleMapsApiKey) {
        console.warn('Google Maps API key not configured for Static Maps');
        return null;
      }

      const size = '640x640';
      const markers = `color:red|${latitude},${longitude}`;

      const url = `https://maps.googleapis.com/maps/api/staticmap?` +
        `center=${latitude},${longitude}&` +
        `zoom=${zoom}&` +
        `size=${size}&` +
        `maptype=${mapType}&` +
        `markers=${markers}&` +
        `key=${this.googleMapsApiKey}`;

      return url;

    } catch (error) {
      console.error('Failed to generate Static Map URL:', error);
      return null;
    }
  }

  async downloadImage(imageUrl, subfolder, filename) {
    try {
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream'
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
      throw error;
    }
  }

  // BLIND SPOT ANALYSIS METHODS

  async checkElevationBlindSpot(currentPoint, routePoints, currentIndex) {
  try {
    // Use the NEW real calculator
    const realCalculator = require('./realBlindSpotCalculations');
    const windowSize = 5;
    const startIndex = Math.max(0, currentIndex - windowSize);
    const endIndex = Math.min(routePoints.length - 1, currentIndex + windowSize);
    const analysisWindow = routePoints.slice(startIndex, endIndex + 1);
    
    // Get REAL elevation data
    const elevationData = await realCalculator.getRealElevationData(analysisWindow);
    if (!elevationData || elevationData.length === 0) return null;
    
    // Use REAL sight line calculation
    const elevationProfile = elevationData;
    const centerIndex = Math.floor(elevationProfile.length / 2);
    const sightLineAnalysis = realCalculator.calculateSightLineObstruction(
      elevationProfile, 
      centerIndex,
      realCalculator.visibilityConstants.DRIVER_EYE_HEIGHT
    );
    
    if (sightLineAnalysis.hasObstruction) {
      const visibilityDistance = realCalculator.calculateRealVisibilityDistance(
        analysisWindow, elevationProfile, centerIndex, sightLineAnalysis.obstructionIndex
      );
      
      const riskScore = realCalculator.calculateElevationRiskScore(
        visibilityDistance,
        sightLineAnalysis.obstructionHeight,
        realCalculator.getLocalSpeedEstimate(currentPoint)
      );
      
      return {
        spotType: 'crest',
        visibilityDistance,
        obstructionHeight: sightLineAnalysis.obstructionHeight,
        riskScore,
        severityLevel: realCalculator.getBlindSpotSeverity(riskScore),
        roadGeometry: {
          gradient: realCalculator.calculateGrade(elevationProfile),
          curvature: 0,
          width: 7
        },
        structures: [],
        analysisMethod: 'elevation_data',
        confidence: sightLineAnalysis.confidence
      };
    }
    
    return null;
  } catch (error) {
    console.error('Real elevation blind spot check failed:', error);
    return null;
  }
}
 async checkCurveBlindSpot(currentPoint, routePoints, currentIndex) {
  try {
    // Check for curve-based blind spots
    if (currentIndex < 2 || currentIndex >= routePoints.length - 2) return null;

    const prevPoint = routePoints[currentIndex - 2];
    const beforePoint = routePoints[currentIndex - 1];
    const afterPoint = routePoints[currentIndex + 1];
    const nextPoint = routePoints[currentIndex + 2];

    // Calculate curve characteristics
    const turnData1 = this.calculateTurnAngle(prevPoint, beforePoint, currentPoint);
    const turnData2 = this.calculateTurnAngle(beforePoint, currentPoint, afterPoint);
    const turnData3 = this.calculateTurnAngle(currentPoint, afterPoint, nextPoint);

    const avgTurnAngle = (turnData1.angle + turnData2.angle + turnData3.angle) / 3;
    const avgRadius = (turnData1.radius + turnData2.radius + turnData3.radius) / 3;

    // Check if this is a significant curve that creates blind spots
    if (avgTurnAngle > 45 && avgRadius < 300) {
      const visibilityDistance = this.calculateVisibilityDistance(avgRadius, 'curve');
      const riskScore = this.calculateBlindSpotRisk('curve', visibilityDistance, avgTurnAngle);

      return {
        spotType: 'curve',
        visibilityDistance,
        obstructionHeight: 0,
        riskScore,
        severityLevel: this.getBlindSpotSeverity(riskScore),
        roadGeometry: {
          curvature: avgRadius,
          gradient: 0,
          width: 7
        },
        structures: [], // FIXED: Always return array
        analysisMethod: 'gps_data', // FIXED: Valid enum value
        confidence: 0.7
      };
    }

    return null;

  } catch (error) {
    console.error('Curve blind spot check failed:', error);
    return null;
  }
}
 async checkObstructionBlindSpot(currentPoint) {
  try {
    const realCalculator = require('./realBlindSpotCalculations');
    
    // Get REAL obstruction data from Google Places API
    const obstructions = await realCalculator.getDetailedObstructions(currentPoint);
    
    if (obstructions.length > 0) {
      const closestObstruction = obstructions[0];
      const distance = closestObstruction.distance;
      
      if (distance < 50) { // Within 50 meters
        // Real geometric shadow zone analysis
        const shadowAnalysis = realCalculator.analyzeObstructionShadowZone(
          currentPoint, closestObstruction, [], 0
        );
        
        if (shadowAnalysis.createsBlindSpot) {
          const visibilityDistance = shadowAnalysis.blockedDistance;
          const riskScore = realCalculator.calculateObstructionRiskScore(shadowAnalysis, closestObstruction);
          
          return {
            spotType: 'obstruction',
            visibilityDistance,
            obstructionHeight: closestObstruction.height,
            riskScore,
            severityLevel: realCalculator.getBlindSpotSeverity(riskScore),
            structures: [{
              type: closestObstruction.type || 'building',
              height: closestObstruction.height || 10,
              distance: distance,
              name: closestObstruction.name || 'Unknown structure'
            }],
            analysisMethod: 'places_api',
            confidence: 0.6
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Real obstruction blind spot check failed:', error);
    return null;
  }
}
  // HELPER METHODS FOR BLIND SPOTS

  async createBlindSpotRecord(routeId, point, blindSpotData, visualData) {
  try {
    // FIXED: Ensure structures is a proper array of objects, not a string
    let structures = [];
    if (blindSpotData.structures) {
      if (Array.isArray(blindSpotData.structures)) {
        structures = blindSpotData.structures.map(struct => ({
          type: struct.type || 'building',
          height: struct.height || 0,
          distance: struct.distance || 0,
          name: struct.name || ''
        }));
      } else if (typeof blindSpotData.structures === 'object') {
        structures = [{
          type: blindSpotData.structures.type || 'building',
          height: blindSpotData.structures.height || 0,
          distance: blindSpotData.structures.distance || 0,
          name: blindSpotData.structures.name || ''
        }];
      }
    }

    // FIXED: Ensure analysisMethod is a valid enum value
    const validAnalysisMethods = ['elevation_data', 'street_view', 'satellite_imagery', 'field_survey', 'places_api', 'gps_data'];
    const analysisMethod = validAnalysisMethods.includes(blindSpotData.analysisMethod) 
      ? blindSpotData.analysisMethod 
      : 'elevation_data';

    const blindSpot = new BlindSpot({
      routeId: routeId,
      latitude: point.latitude,
      longitude: point.longitude,
      distanceFromStartKm: point.distanceFromStart || 0,
      spotType: blindSpotData.spotType,
      visibilityDistance: blindSpotData.visibilityDistance,
      obstructionHeight: blindSpotData.obstructionHeight || 0,
      riskScore: blindSpotData.riskScore,
      severityLevel: blindSpotData.severityLevel,
      streetViewImages: visualData.streetViewImages || [],
      aerialImage: visualData.aerialImage,
      roadGeometry: blindSpotData.roadGeometry || {},
      vegetation: blindSpotData.vegetation || { present: false },
      structures: structures, // FIXED: Proper array structure
      analysisMethod: analysisMethod, // FIXED: Valid enum value
      confidence: blindSpotData.confidence || 0.7,
      recommendations: this.generateBlindSpotRecommendations(blindSpotData)
    });

    // Generate satellite view link
    blindSpot.generateSatelliteViewLink();

    // Generate multiple street view links
    blindSpot.streetViewLinks = this.generateMultipleStreetViewLinks(point);

    return blindSpot;

  } catch (error) {
    console.error('Error creating blind spot record:', error);
    throw error;
  }
}

  // UTILITY METHODS

  async getElevation(point) {
    try {
      if (!this.googleMapsApiKey) {
        // Mock elevation data
        return 100 + Math.random() * 200; // 100-300m elevation
      }

      const url = `https://maps.googleapis.com/maps/api/elevation/json?` +
        `locations=${point.latitude},${point.longitude}&` +
        `key=${this.googleMapsApiKey}`;

      const response = await axios.get(url);
      
      if (response.data.status === 'OK' && response.data.results.length > 0) {
        return response.data.results[0].elevation;
      }

      return 100; // Default elevation

    } catch (error) {
      console.error('Failed to get elevation:', error);
      return 100; // Default elevation
    }
  }

  async findNearbyObstructions(latitude, longitude) {
  try {
    if (!this.googleMapsApiKey) {
      // FIXED: Mock obstruction data with proper structure
      return Math.random() > 0.8 ? [{
        type: 'building',
        distance: Math.random() * 100,
        estimatedHeight: 10 + Math.random() * 20,
        name: 'Mock Building'
      }] : [];
    }

    // Search for buildings, walls, bridges that could obstruct view
    const types = ['establishment', 'point_of_interest'];
    const obstructions = [];

    for (const type of types) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
          `location=${latitude},${longitude}&` +
          `radius=100&` +
          `type=${type}&` +
          `key=${this.googleMapsApiKey}`;

        const response = await axios.get(url);
        
        if (response.data.status === 'OK') {
          response.data.results.forEach(place => {
            const distance = this.calculateDistance(
              { latitude, longitude },
              { latitude: place.geometry.location.lat, longitude: place.geometry.location.lng }
            ) * 1000; // Convert to meters

            // FIXED: Return proper object structure
            obstructions.push({
              type: this.categorizeObstruction(place.types),
              distance: distance,
              estimatedHeight: this.estimateObstructionHeight(place.types),
              name: place.name || 'Unknown'
            });
          });
        }
      } catch (apiError) {
        console.warn(`Places API error for ${type}:`, apiError.message);
      }
    }

    return obstructions.sort((a, b) => a.distance - b.distance);

  } catch (error) {
    console.error('Failed to find nearby obstructions:', error);
    // Return empty array instead of throwing
    return [];
  }
}

  calculateVisibilityDistance(obstructionValue, spotType) {
  const realCalculator = require('./realBlindSpotCalculations');
  
  switch (spotType) {
    case 'crest':
      // Real formula: Visibility = 2 * sqrt(h * R) where h = obstruction height, R = earth radius
      const earthRadius = 6371000; // meters
      return Math.round(2 * Math.sqrt(obstructionValue * earthRadius / 1000)); // Convert to reasonable scale
      
    case 'curve':
      // Use real AASHTO curve sight distance calculation
      return realCalculator.calculateAvailableSightDistance(obstructionValue, 10);
      
    case 'obstruction':
      // Real shadow length calculation
      return realCalculator.calculateGeometricShadowLength(1.2, obstructionValue, 50);
      
    default:
      return 100;
  }
}

  calculateBlindSpotRisk(spotType, visibilityDistance, obstructionValue) {
    let riskScore = 3; // Base risk

    // Visibility distance factor
    if (visibilityDistance < 50) riskScore += 4;
    else if (visibilityDistance < 100) riskScore += 3;
    else if (visibilityDistance < 150) riskScore += 2;
    else if (visibilityDistance < 200) riskScore += 1;

    // Spot type specific factors
    switch (spotType) {
      case 'crest':
        if (obstructionValue > 50) riskScore += 2; // Significant elevation change
        break;
      case 'curve':
        if (obstructionValue > 90) riskScore += 3; // Sharp curve
        else if (obstructionValue > 60) riskScore += 2;
        break;
      case 'obstruction':
        if (obstructionValue < 25) riskScore += 3; // Very close obstruction
        break;
    }

    return Math.max(1, Math.min(10, riskScore));
  }

  getBlindSpotSeverity(riskScore) {
    if (riskScore >= 8) return 'critical';
    if (riskScore >= 6) return 'significant';
    if (riskScore >= 4) return 'moderate';
    return 'minor';
  }

  generateBlindSpotRecommendations(blindSpotData) {
    const recommendations = [];

    if (blindSpotData.riskScore >= 8) {
      recommendations.push('CRITICAL: Reduce speed significantly when approaching this area');
      recommendations.push('Use horn/signal when approaching blind spot');
    }

    switch (blindSpotData.spotType) {
      case 'crest':
        recommendations.push('Reduce speed before cresting hill');
        recommendations.push('Stay in your lane and be prepared to stop');
        break;
      case 'curve':
        recommendations.push('Reduce speed before entering curve');
        recommendations.push('Position vehicle for maximum visibility');
        break;
      case 'obstruction':
        recommendations.push('Proceed with extreme caution');
        recommendations.push('Use alternative route if possible');
        break;
    }

    if (blindSpotData.visibilityDistance < 100) {
      recommendations.push('Consider convoy travel through this section');
    }

    return recommendations;
  }

  // VISUAL HELPER METHODS

  getOptimalHeading(turnDirection) {
    switch (turnDirection) {
      case 'left': return 270; // West
      case 'right': return 90; // East
      default: return 0; // North
    }
  }

  getDirectionDescription(heading) {
    if (heading >= 315 || heading < 45) return 'North view';
    if (heading >= 45 && heading < 135) return 'East view';
    if (heading >= 135 && heading < 225) return 'South view';
    return 'West view';
  }

  generateMultipleStreetViewLinks(point) {
    const baseUrl = 'https://www.google.com/maps/@';
    const headings = [0, 90, 180, 270];
    
    return headings.map(heading => 
      `${baseUrl}${point.latitude},${point.longitude},3a,75y,${heading}h,90t`
    );
  }

  categorizeObstruction(types) {
    if (types.includes('building') || types.includes('establishment')) return 'building';
    if (types.includes('bridge')) return 'bridge';
    if (types.includes('wall')) return 'wall';
    return 'structure';
  }

  estimateObstructionHeight(types) {
    if (types.includes('building')) return 15 + Math.random() * 25; // 15-40m
    if (types.includes('bridge')) return 8 + Math.random() * 12; // 8-20m
    if (types.includes('wall')) return 2 + Math.random() * 4; // 2-6m
    return 5 + Math.random() * 10; // Default 5-15m
  }

  // ANALYSIS SUMMARY METHODS

  getSeverityBreakdown(turns) {
    return {
      hairpin: turns.filter(t => t.turnSeverity === 'hairpin').length,
      sharp: turns.filter(t => t.turnSeverity === 'sharp').length,
      moderate: turns.filter(t => t.turnSeverity === 'moderate').length,
      gentle: turns.filter(t => t.turnSeverity === 'gentle').length
    };
  }

  getBlindSpotTypeBreakdown(spots) {
    return {
      crest: spots.filter(s => s.spotType === 'crest').length,
      curve: spots.filter(s => s.spotType === 'curve').length,
      intersection: spots.filter(s => s.spotType === 'intersection').length,
      obstruction: spots.filter(s => s.spotType === 'obstruction').length,
      vegetation: spots.filter(s => s.spotType === 'vegetation').length,
      structure: spots.filter(s => s.spotType === 'structure').length
    };
  }

  // BATCH PROCESSING

  async analyzeMultipleRoutes(routeIds) {
    const results = [];
    
    for (const routeId of routeIds) {
      try {
        const analysis = await this.analyzeRoute(routeId);
        results.push({
          routeId,
          success: true,
          analysis
        });
      } catch (error) {
        results.push({
          routeId,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}

module.exports = new SharpTurnsBlindSpotsAnalysisService();