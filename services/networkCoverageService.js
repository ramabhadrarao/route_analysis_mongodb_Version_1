// File: services/networkCoverageService.js
// Purpose: Network coverage analysis and dead zone detection with storage

const mongoose = require('mongoose');
const axios = require('axios');

// Create NetworkCoverage model for storing detailed network data
const networkCoverageSchema = new mongoose.Schema({
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: true
  },
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  
  // Distance Information
  distanceFromStartKm: {
    type: Number,
    min: 0
  },
  
  // Network Coverage Analysis
  coverageType: {
    type: String,
    enum: ['full_coverage', 'partial_coverage', 'weak_signal', 'dead_zone'],
    required: true
  },
  
  // Signal Strength (1-10 scale)
  signalStrength: {
    type: Number,
    min: 0,
    max: 10,
    required: true
  },
  
  // Operator Coverage
  operatorCoverage: {
    airtel: {
      coverage: { type: Number, min: 0, max: 100, default: 0 },
      signalStrength: { type: Number, min: 0, max: 10, default: 0 },
      technology: { type: String, enum: ['2G', '3G', '4G', '5G', 'No Service'], default: 'No Service' }
    },
    jio: {
      coverage: { type: Number, min: 0, max: 100, default: 0 },
      signalStrength: { type: Number, min: 0, max: 10, default: 0 },
      technology: { type: String, enum: ['2G', '3G', '4G', '5G', 'No Service'], default: 'No Service' }
    },
    vi: {
      coverage: { type: Number, min: 0, max: 100, default: 0 },
      signalStrength: { type: Number, min: 0, max: 10, default: 0 },
      technology: { type: String, enum: ['2G', '3G', '4G', '5G', 'No Service'], default: 'No Service' }
    },
    bsnl: {
      coverage: { type: Number, min: 0, max: 100, default: 0 },
      signalStrength: { type: Number, min: 0, max: 10, default: 0 },
      technology: { type: String, enum: ['2G', '3G', '4G', '5G', 'No Service'], default: 'No Service' }
    }
  },
  
  // Dead Zone Analysis
  isDeadZone: {
    type: Boolean,
    default: false
  },
  deadZoneRadius: {
    type: Number, // Radius in meters
    min: 0
  },
  deadZoneSeverity: {
    type: String,
    enum: ['minor', 'moderate', 'severe', 'critical'],
    default: 'minor'
  },
  deadZoneDuration: {
    type: Number, // Estimated duration to cross in minutes
    min: 0
  },
  
  // Geographic Factors
  terrain: {
    type: String,
    enum: ['urban', 'suburban', 'rural', 'hilly', 'mountainous', 'forest', 'desert'],
    required: true
  },
  elevation: {
    type: Number,
    default: 0
  },
  nearestCellTower: {
    distance: { type: Number, min: 0 }, // km
    operator: String,
    technology: String
  },
  
  // Population Density (affects tower placement)
  populationDensity: {
    type: String,
    enum: ['very_high', 'high', 'medium', 'low', 'very_low'],
    default: 'medium'
  },
  
  // Interference Factors
  interferenceFactors: [{
    type: String,
    enum: ['mountains', 'forests', 'buildings', 'weather', 'electronic_interference', 'distance_from_tower']
  }],
  
  // Risk Assessment
  communicationRisk: {
    type: Number,
    min: 1,
    max: 10,
    required: true
  },
  emergencyRisk: {
    type: Number,
    min: 1,
    max: 10,
    required: true
  },
  
  // Alternative Communication Methods
  alternativeMethods: [{
    type: String,
    enum: ['satellite_phone', 'two_way_radio', 'emergency_beacon', 'landline', 'wifi_hotspot']
  }],
  
  // Recommendations
  recommendations: [String],
  
  // Data Source
  analysisMethod: {
    type: String,
    enum: ['terrain_analysis', 'population_density', 'tower_mapping', 'signal_prediction', 'real_measurement'],
    default: 'terrain_analysis'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.7
  },
  
  // Metadata
  dataSource: {
    type: String,
    default: 'NETWORK_ANALYSIS_SERVICE'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
networkCoverageSchema.index({ routeId: 1 });
networkCoverageSchema.index({ latitude: 1, longitude: 1 });
networkCoverageSchema.index({ isDeadZone: 1 });
networkCoverageSchema.index({ communicationRisk: -1 });
networkCoverageSchema.index({ distanceFromStartKm: 1 });

// Create the model
const NetworkCoverage = mongoose.model('NetworkCoverage', networkCoverageSchema);

class NetworkCoverageService {
  
  constructor() {
    // Network coverage APIs (if available)
    this.openCellIdApiKey = process.env.OPENCELLID_API_KEY; // OpenCellID for tower data
    this.hereApiKey = process.env.HERE_API_KEY; // HERE has some coverage data
    
    // Indian telecom operators
    this.operators = ['airtel', 'jio', 'vi', 'bsnl'];
    
    // Coverage prediction models based on terrain and population
    this.coverageModels = {
      urban: { baseStrength: 9, deadZoneChance: 0.05, towerDensity: 'high' },
      suburban: { baseStrength: 8, deadZoneChance: 0.10, towerDensity: 'medium' },
      rural: { baseStrength: 6, deadZoneChance: 0.25, towerDensity: 'low' },
      hilly: { baseStrength: 4, deadZoneChance: 0.40, towerDensity: 'very_low' },
      mountainous: { baseStrength: 2, deadZoneChance: 0.60, towerDensity: 'very_low' },
      forest: { baseStrength: 3, deadZoneChance: 0.50, towerDensity: 'very_low' },
      desert: { baseStrength: 5, deadZoneChance: 0.30, towerDensity: 'low' }
    };
  }

  // Main method to analyze network coverage for a route
  async analyzeNetworkCoverage(routeId) {
    try {
      console.log('📶 Starting comprehensive network coverage analysis...');
      
      const Route = require('../models/Route');
      const route = await Route.findById(routeId);
      
      if (!route) {
        throw new Error('Route not found');
      }
      
      // Clear existing network coverage data
      await NetworkCoverage.deleteMany({ routeId });
      console.log('🗑️ Cleared existing network coverage data');
      
      // Analyze coverage for route segments
      const coveragePoints = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 30); // 30 segments for detailed analysis
      
      console.log(`📍 Analyzing ${routeSegments.length} route segments for network coverage...`);
      
      for (let i = 0; i < routeSegments.length; i++) {
        const segment = routeSegments[i];
        
        try {
          const coverageData = await this.analyzeCoveragePoint(
            segment, 
            route, 
            i, 
            routeSegments.length
          );
          
          if (coverageData) {
            const networkPoint = new NetworkCoverage(coverageData);
            await networkPoint.save();
            coveragePoints.push(networkPoint);
            
            if (coverageData.isDeadZone) {
              console.log(`   ❌ DEAD ZONE detected at ${segment.latitude.toFixed(4)}, ${segment.longitude.toFixed(4)} (${coverageData.deadZoneSeverity})`);
            } else {
              console.log(`   ✅ Coverage OK at ${segment.latitude.toFixed(4)}, ${segment.longitude.toFixed(4)} (Signal: ${coverageData.signalStrength}/10)`);
            }
          }
          
        } catch (pointError) {
          console.warn(`   ⚠️ Failed to analyze coverage for segment ${i + 1}:`, pointError.message);
        }
      }
      
      // Analyze dead zone patterns
      const deadZoneAnalysis = await this.analyzeDeadZonePatterns(coveragePoints, route);
      
      // Generate comprehensive report
      const coverageReport = {
        routeId: route.routeId,
        routeName: route.routeName,
        totalDistance: route.totalDistance,
        terrain: route.terrain,
        
        // Coverage Statistics
        totalAnalysisPoints: coveragePoints.length,
        deadZones: {
          total: coveragePoints.filter(p => p.isDeadZone).length,
          severe: coveragePoints.filter(p => p.isDeadZone && p.deadZoneSeverity === 'severe').length,
          critical: coveragePoints.filter(p => p.isDeadZone && p.deadZoneSeverity === 'critical').length,
          averageRadius: this.calculateAverageDeadZoneRadius(coveragePoints),
          totalDuration: this.calculateTotalDeadZoneDuration(coveragePoints)
        },
        
        // Signal Quality
        averageSignalStrength: this.calculateAverageSignalStrength(coveragePoints),
        weakSignalAreas: coveragePoints.filter(p => p.signalStrength < 4).length,
        
        // Operator Coverage
        operatorAnalysis: this.analyzeOperatorCoverage(coveragePoints),
        
        // Risk Assessment
        communicationRisk: this.calculateOverallCommunicationRisk(coveragePoints),
        emergencyRisk: this.calculateOverallEmergencyRisk(coveragePoints),
        
        // Dead Zone Patterns
        deadZonePatterns: deadZoneAnalysis,
        
        // Recommendations
        recommendations: this.generateNetworkRecommendations(coveragePoints, route),
        
        // Alternative Communication
        alternativeCommunication: this.recommendAlternativeCommunication(coveragePoints),
        
        analysisDate: new Date(),
        dataQuality: this.assessNetworkDataQuality(coveragePoints)
      };
      
      console.log(`✅ Network coverage analysis completed:`);
      console.log(`   📊 Total Points: ${coverageReport.totalAnalysisPoints}`);
      console.log(`   ❌ Dead Zones: ${coverageReport.deadZones.total} (${Math.round((coverageReport.deadZones.total / coverageReport.totalAnalysisPoints) * 100)}%)`);
      console.log(`   📶 Average Signal: ${coverageReport.averageSignalStrength}/10`);
      console.log(`   ⚠️ Communication Risk: ${coverageReport.communicationRisk}/10`);
      
      return coverageReport;
      
    } catch (error) {
      console.error('❌ Network coverage analysis failed:', error);
      throw error;
    }
  }

  // Analyze coverage for a specific point
  async analyzeCoveragePoint(segment, route, segmentIndex, totalSegments) {
    try {
      // Determine terrain type for this specific point
      const pointTerrain = this.determinePointTerrain(segment, route);
      
      // Get elevation data (you can integrate with Google Elevation API)
      const elevation = await this.getElevation(segment.latitude, segment.longitude);
      
      // Analyze population density
      const populationDensity = this.estimatePopulationDensity(segment, pointTerrain);
      
      // Calculate base signal strength
      const baseSignal = this.calculateBaseSignalStrength(pointTerrain, populationDensity, elevation);
      
      // Apply terrain-specific interference
      const interferenceFactors = this.identifyInterferenceFactors(pointTerrain, elevation, segment);
      const adjustedSignal = this.applyInterference(baseSignal, interferenceFactors);
      
      // Determine if this is a dead zone
      const isDeadZone = this.isDeadZonePoint(adjustedSignal, pointTerrain);
      
      // Analyze operator-specific coverage
      const operatorCoverage = this.analyzeOperatorSpecificCoverage(
        adjustedSignal, 
        pointTerrain, 
        populationDensity
      );
      
      // Calculate dead zone properties
      const deadZoneProperties = isDeadZone ? 
        this.calculateDeadZoneProperties(adjustedSignal, pointTerrain, route.totalDistance, segmentIndex, totalSegments) : 
        {};
      
      // Calculate risk scores
      const communicationRisk = this.calculateCommunicationRisk(adjustedSignal, isDeadZone, interferenceFactors);
      const emergencyRisk = this.calculateEmergencyRisk(adjustedSignal, isDeadZone, pointTerrain);
      
      return {
        routeId: route._id,
        latitude: segment.latitude,
        longitude: segment.longitude,
        distanceFromStartKm: this.calculateDistanceFromStart(route.routePoints, segment),
        
        // Coverage Analysis
        coverageType: this.determineCoverageType(adjustedSignal),
        signalStrength: Math.round(adjustedSignal * 10) / 10,
        
        // Operator Coverage
        operatorCoverage,
        
        // Dead Zone Information
        isDeadZone,
        deadZoneRadius: deadZoneProperties.radius || 0,
        deadZoneSeverity: deadZoneProperties.severity || 'minor',
        deadZoneDuration: deadZoneProperties.duration || 0,
        
        // Geographic Information
        terrain: pointTerrain,
        elevation: elevation,
        populationDensity,
        
        // Interference
        interferenceFactors,
        
        // Risk Assessment
        communicationRisk,
        emergencyRisk,
        
        // Alternative Methods
        alternativeMethods: this.recommendAlternativeMethodsForPoint(isDeadZone, pointTerrain),
        
        // Recommendations
        recommendations: this.generatePointRecommendations(adjustedSignal, isDeadZone, pointTerrain),
        
        // Analysis Details
        analysisMethod: 'terrain_analysis',
        confidence: this.calculateConfidence(pointTerrain, populationDensity),
        dataSource: 'NETWORK_COVERAGE_SERVICE',
        lastUpdated: new Date()
      };
      
    } catch (error) {
      console.error('Point coverage analysis failed:', error);
      return null;
    }
  }

  // Helper Methods for Network Analysis

  createRouteSegments(routePoints, numberOfSegments) {
    const segments = [];
    const step = Math.max(1, Math.floor(routePoints.length / numberOfSegments));
    
    for (let i = 0; i < routePoints.length; i += step) {
      segments.push(routePoints[i]);
    }
    
    return segments;
  }

  calculateDistanceFromStart(routePoints, targetPoint) {
    if (!routePoints || routePoints.length === 0) return 0;
    
    let minDistance = Infinity;
    let nearestPointIndex = 0;
    
    for (let i = 0; i < routePoints.length; i++) {
      const distance = this.calculateDistance(
        routePoints[i].latitude, routePoints[i].longitude,
        targetPoint.latitude, targetPoint.longitude
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPointIndex = i;
      }
    }
    
    return routePoints[nearestPointIndex].distanceFromStart || 0;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  determinePointTerrain(segment, route) {
    // Use route terrain as base, but can be enhanced with specific geographic analysis
    const routeTerrain = route.terrain;
    
    // You can enhance this with actual geographic APIs
    // For now, use route terrain with some variation
    const terrainVariations = {
      'urban': ['urban', 'suburban'],
      'rural': ['rural', 'suburban'],
      'hilly': ['hilly', 'mountainous'],
      'mixed': ['urban', 'suburban', 'rural', 'hilly'],
      'flat': ['rural', 'suburban']
    };
    
    const possibleTerrains = terrainVariations[routeTerrain] || [routeTerrain];
    return possibleTerrains[Math.floor(Math.random() * possibleTerrains.length)];
  }

  async getElevation(latitude, longitude) {
    try {
      // You can integrate with Google Elevation API here
      // For now, estimate based on coordinates (India-specific rough estimation)
      
      // Himalayan region (high elevation)
      if (latitude > 28 && latitude < 36) {
        return Math.random() * 3000 + 1000; // 1000-4000m
      }
      
      // Western Ghats (moderate elevation)
      if ((longitude > 73 && longitude < 77) && (latitude > 8 && latitude < 21)) {
        return Math.random() * 1500 + 500; // 500-2000m
      }
      
      // Eastern Ghats (moderate elevation)
      if ((longitude > 78 && longitude < 84) && (latitude > 11 && latitude < 22)) {
        return Math.random() * 1000 + 300; // 300-1300m
      }
      
      // Plains (low elevation)
      return Math.random() * 300 + 50; // 50-350m
      
    } catch (error) {
      return 200; // Default elevation
    }
  }

  estimatePopulationDensity(segment, terrain) {
    const densityMapping = {
      'urban': 'very_high',
      'suburban': 'high',
      'rural': 'low',
      'hilly': 'very_low',
      'mountainous': 'very_low',
      'forest': 'very_low',
      'desert': 'very_low'
    };
    
    return densityMapping[terrain] || 'medium';
  }

  calculateBaseSignalStrength(terrain, populationDensity, elevation) {
    let baseStrength = this.coverageModels[terrain]?.baseStrength || 5;
    
    // Population density adjustments
    const densityAdjustments = {
      'very_high': 2,
      'high': 1,
      'medium': 0,
      'low': -1,
      'very_low': -2
    };
    
    baseStrength += densityAdjustments[populationDensity] || 0;
    
    // Elevation adjustments (higher elevation = weaker signal generally)
    if (elevation > 2000) baseStrength -= 3;
    else if (elevation > 1000) baseStrength -= 2;
    else if (elevation > 500) baseStrength -= 1;
    
    return Math.max(0, Math.min(10, baseStrength));
  }

  identifyInterferenceFactors(terrain, elevation, segment) {
    const factors = [];
    
    if (terrain === 'mountainous' || terrain === 'hilly') {
      factors.push('mountains');
    }
    
    if (terrain === 'forest') {
      factors.push('forests');
    }
    
    if (terrain === 'urban') {
      factors.push('buildings');
    }
    
    if (elevation > 1500) {
      factors.push('distance_from_tower');
    }
    
    // Random weather interference (can be enhanced with real weather data)
    if (Math.random() > 0.8) {
      factors.push('weather');
    }
    
    return factors;
  }

  applyInterference(baseSignal, interferenceFactors) {
    let adjustedSignal = baseSignal;
    
    const interferenceImpact = {
      'mountains': -2,
      'forests': -1.5,
      'buildings': -1,
      'weather': -0.5,
      'electronic_interference': -1,
      'distance_from_tower': -1.5
    };
    
    interferenceFactors.forEach(factor => {
      adjustedSignal += interferenceImpact[factor] || 0;
    });
    
    return Math.max(0, Math.min(10, adjustedSignal));
  }

  isDeadZonePoint(signalStrength, terrain) {
    const deadZoneThresholds = {
      'urban': 2,
      'suburban': 1.5,
      'rural': 1,
      'hilly': 0.5,
      'mountainous': 0.5,
      'forest': 0.5,
      'desert': 1
    };
    
    const threshold = deadZoneThresholds[terrain] || 1;
    return signalStrength <= threshold;
  }

  analyzeOperatorSpecificCoverage(signalStrength, terrain, populationDensity) {
    const operators = {};
    
    // Operator-specific adjustments based on real-world coverage patterns
    const operatorAdjustments = {
      airtel: { urban: 0.5, rural: 0, hilly: -0.5 },
      jio: { urban: 1, rural: 0.5, hilly: 0 },
      vi: { urban: 0, rural: -0.5, hilly: -1 },
      bsnl: { urban: -0.5, rural: 0.5, hilly: 0.5 }
    };
    
    this.operators.forEach(operator => {
      const adjustment = operatorAdjustments[operator][terrain] || 0;
      const operatorSignal = Math.max(0, Math.min(10, signalStrength + adjustment));
      
      operators[operator] = {
        coverage: Math.round(operatorSignal * 10), // Convert to percentage
        signalStrength: Math.round(operatorSignal * 10) / 10,
        technology: this.determineTechnology(operatorSignal, operator)
      };
    });
    
    return operators;
  }

  determineTechnology(signalStrength, operator) {
    if (signalStrength === 0) return 'No Service';
    if (signalStrength < 2) return '2G';
    if (signalStrength < 4) return '3G';
    if (signalStrength < 8) return '4G';
    return operator === 'jio' ? '5G' : '4G'; // Jio has better 5G coverage
  }

  calculateDeadZoneProperties(signalStrength, terrain, totalDistance, segmentIndex, totalSegments) {
    // Estimate dead zone radius based on terrain
    const radiusEstimates = {
      'urban': 200,      // 200m
      'suburban': 500,   // 500m
      'rural': 1000,     // 1km
      'hilly': 2000,     // 2km
      'mountainous': 5000, // 5km
      'forest': 1500,    // 1.5km
      'desert': 3000     // 3km
    };
    
    const baseRadius = radiusEstimates[terrain] || 1000;
    const radius = baseRadius * (1 - signalStrength / 10); // Weaker signal = larger dead zone
    
    // Determine severity
    let severity = 'minor';
    if (signalStrength === 0) severity = 'critical';
    else if (signalStrength < 0.5) severity = 'severe';
    else if (signalStrength < 1) severity = 'moderate';
    
    // Estimate duration to cross dead zone
    const segmentDistance = totalDistance / totalSegments;
    const duration = Math.round((radius / 1000 / 50) * 60); // Assuming 50 km/h speed
    
    return {
      radius: Math.round(radius),
      severity,
      duration: Math.max(1, duration)
    };
  }

  determineCoverageType(signalStrength) {
    if (signalStrength === 0) return 'dead_zone';
    if (signalStrength < 2) return 'weak_signal';
    if (signalStrength < 6) return 'partial_coverage';
    return 'full_coverage';
  }

  calculateCommunicationRisk(signalStrength, isDeadZone, interferenceFactors) {
    let risk = 5; // Base risk
    
    if (isDeadZone) risk += 4;
    else if (signalStrength < 3) risk += 2;
    else if (signalStrength < 5) risk += 1;
    else risk -= 1;
    
    // Add interference factor risks
    risk += interferenceFactors.length * 0.5;
    
    return Math.max(1, Math.min(10, Math.round(risk * 10) / 10));
  }

  calculateEmergencyRisk(signalStrength, isDeadZone, terrain) {
    let risk = 3; // Base emergency risk
    
    if (isDeadZone) {
      risk += 5;
      if (terrain === 'mountainous' || terrain === 'forest') risk += 2;
    } else if (signalStrength < 2) {
      risk += 3;
    } else if (signalStrength < 4) {
      risk += 1;
    }
    
    return Math.max(1, Math.min(10, Math.round(risk * 10) / 10));
  }

  recommendAlternativeMethodsForPoint(isDeadZone, terrain) {
    const methods = [];
    
    if (isDeadZone) {
      methods.push('satellite_phone');
      methods.push('two_way_radio');
      
      if (terrain === 'mountainous' || terrain === 'forest') {
        methods.push('emergency_beacon');
      }
    } else {
      methods.push('two_way_radio');
    }
    
    return methods;
  }

  generatePointRecommendations(signalStrength, isDeadZone, terrain) {
    const recommendations = [];
    
    if (isDeadZone) {
      recommendations.push('CRITICAL: No cellular coverage - use alternative communication');
      recommendations.push('Carry satellite phone or emergency beacon');
      recommendations.push('Inform control room before entering this area');
      recommendations.push('Travel in convoy for safety');
    } else if (signalStrength < 3) {
      recommendations.push('Weak signal area - test communication before proceeding');
      recommendations.push('Keep devices fully charged');
      recommendations.push('Use external antenna if available');
    }
    
    if (terrain === 'mountainous') {
      recommendations.push('Mountainous terrain - signal may vary rapidly');
    }
    
    return recommendations;
  }

  calculateConfidence(terrain, populationDensity) {
    let confidence = 0.7; // Base confidence
    
    // Higher confidence in well-studied areas
    if (terrain === 'urban') confidence += 0.2;
    if (populationDensity === 'very_high') confidence += 0.1;
    
    // Lower confidence in remote areas
    if (terrain === 'mountainous' || terrain === 'forest') confidence -= 0.2;
    if (populationDensity === 'very_low') confidence -= 0.1;
    
    return Math.max(0.3, Math.min(0.95, confidence));
  }

  // Analysis Methods for Comprehensive Report

  async analyzeDeadZonePatterns(coveragePoints, route) {
    const deadZones = coveragePoints.filter(p => p.isDeadZone);
    
    if (deadZones.length === 0) {
      return {
        totalDeadZones: 0,
        patterns: [],
        clusters: [],
        longestDeadZone: null
      };
    }
    
    // Identify dead zone clusters
    const clusters = this.identifyDeadZoneClusters(deadZones);
    
    // Identify patterns
    const patterns = this.identifyDeadZonePatterns(deadZones, route);
    
    return {
      totalDeadZones: deadZones.length,
      patterns,
      clusters,
      longestDeadZone: this.findLongestDeadZone(clusters),
      averageSeverity: this.calculateAverageDeadZoneSeverity(deadZones)
    };
  }

  identifyDeadZoneClusters(deadZones) {
    const clusters = [];
    let currentCluster = [];
    
    // Sort by distance from start
    deadZones.sort((a, b) => a.distanceFromStartKm - b.distanceFromStartKm);
    
    for (let i = 0; i < deadZones.length; i++) {
      const currentPoint = deadZones[i];
      
      if (currentCluster.length === 0) {
        currentCluster.push(currentPoint);
      } else {
        const lastPoint = currentCluster[currentCluster.length - 1];
        const distance = Math.abs(currentPoint.distanceFromStartKm - lastPoint.distanceFromStartKm);
        
        // If points are within 5km, consider them part of the same cluster
        if (distance <= 5) {
          currentCluster.push(currentPoint);
        } else {
          // Start new cluster
          if (currentCluster.length > 0) {
            clusters.push(this.createClusterInfo(currentCluster));
          }
          currentCluster = [currentPoint];
        }
      }
    }
    
    // Add final cluster
    if (currentCluster.length > 0) {
      clusters.push(this.createClusterInfo(currentCluster));
    }
    
    return clusters;
  }

  createClusterInfo(clusterPoints) {
    const startKm = Math.min(...clusterPoints.map(p => p.distanceFromStartKm));
    const endKm = Math.max(...clusterPoints.map(p => p.distanceFromStartKm));
    const avgSeverity = clusterPoints.reduce((sum, p) => {
      const severityScore = { minor: 1, moderate: 2, severe: 3, critical: 4 };
      return sum + (severityScore[p.deadZoneSeverity] || 1);
    }, 0) / clusterPoints.length;
    
    return {
      startKm,
      endKm,
      length: endKm - startKm,
      pointCount: clusterPoints.length,
      severity: avgSeverity > 3 ? 'critical' : avgSeverity > 2.5 ? 'severe' : avgSeverity > 1.5 ? 'moderate' : 'minor',
      totalDuration: clusterPoints.reduce((sum, p) => sum + p.deadZoneDuration, 0),
      dominantTerrain: this.findDominantTerrain(clusterPoints),
      recommendations: this.generateClusterRecommendations(clusterPoints)
    };
  }

  identifyDeadZonePatterns(deadZones, route) {
    const patterns = [];
    
    // Terrain-based patterns
    const terrainGroups = this.groupByTerrain(deadZones);
    Object.entries(terrainGroups).forEach(([terrain, zones]) => {
      if (zones.length > 2) {
        patterns.push({
          type: 'terrain_pattern',
          terrain,
          count: zones.length,
          description: `${zones.length} dead zones in ${terrain} terrain`,
          severity: this.calculateAverageDeadZoneSeverity(zones)
        });
      }
    });
    
    // Distance-based patterns
    if (route.totalDistance > 200) {
      const earlyDeadZones = deadZones.filter(d => d.distanceFromStartKm < route.totalDistance * 0.3);
      const lateDeadZones = deadZones.filter(d => d.distanceFromStartKm > route.totalDistance * 0.7);
      
      if (earlyDeadZones.length > lateDeadZones.length * 1.5) {
        patterns.push({
          type: 'early_concentration',
          description: 'Dead zones concentrated in early part of route',
          earlyCount: earlyDeadZones.length,
          lateCount: lateDeadZones.length
        });
      }
    }
    
    // Severity patterns
    const criticalZones = deadZones.filter(d => d.deadZoneSeverity === 'critical');
    if (criticalZones.length > deadZones.length * 0.3) {
      patterns.push({
        type: 'high_severity',
        description: 'High concentration of critical dead zones',
        criticalCount: criticalZones.length,
        percentage: Math.round((criticalZones.length / deadZones.length) * 100)
      });
    }
    
    return patterns;
  }

  findLongestDeadZone(clusters) {
    if (clusters.length === 0) return null;
    
    return clusters.reduce((longest, current) => {
      return current.length > (longest?.length || 0) ? current : longest;
    }, null);
  }

  calculateAverageDeadZoneSeverity(deadZones) {
    if (deadZones.length === 0) return 'none';
    
    const severityScores = { minor: 1, moderate: 2, severe: 3, critical: 4 };
    const avgScore = deadZones.reduce((sum, zone) => {
      return sum + (severityScores[zone.deadZoneSeverity] || 1);
    }, 0) / deadZones.length;
    
    if (avgScore >= 3.5) return 'critical';
    if (avgScore >= 2.5) return 'severe';
    if (avgScore >= 1.5) return 'moderate';
    return 'minor';
  }

  groupByTerrain(deadZones) {
    return deadZones.reduce((groups, zone) => {
      const terrain = zone.terrain || 'unknown';
      if (!groups[terrain]) groups[terrain] = [];
      groups[terrain].push(zone);
      return groups;
    }, {});
  }

  findDominantTerrain(points) {
    const terrainCounts = this.groupByTerrain(points);
    return Object.entries(terrainCounts).reduce((dominant, [terrain, zones]) => {
      return zones.length > (terrainCounts[dominant] || []).length ? terrain : dominant;
    }, 'mixed');
  }

  generateClusterRecommendations(clusterPoints) {
    const recommendations = [];
    const totalDuration = clusterPoints.reduce((sum, p) => sum + p.deadZoneDuration, 0);
    
    recommendations.push(`DEAD ZONE CLUSTER: ${totalDuration} minutes of no coverage`);
    
    if (totalDuration > 30) {
      recommendations.push('CRITICAL: Extended dead zone - mandatory convoy travel');
      recommendations.push('Carry satellite communication equipment');
      recommendations.push('Pre-position emergency response teams');
    } else if (totalDuration > 15) {
      recommendations.push('HIGH RISK: Significant coverage gap - use alternative communication');
      recommendations.push('Travel in pairs minimum');
    }
    
    recommendations.push('Brief all drivers on dead zone locations');
    recommendations.push('Test communication before and after dead zone');
    
    return recommendations;
  }

  // Summary calculation methods
  calculateAverageDeadZoneRadius(coveragePoints) {
    const deadZones = coveragePoints.filter(p => p.isDeadZone && p.deadZoneRadius > 0);
    if (deadZones.length === 0) return 0;
    
    return Math.round(deadZones.reduce((sum, dz) => sum + dz.deadZoneRadius, 0) / deadZones.length);
  }

  calculateTotalDeadZoneDuration(coveragePoints) {
    return coveragePoints
      .filter(p => p.isDeadZone)
      .reduce((sum, dz) => sum + dz.deadZoneDuration, 0);
  }

  calculateAverageSignalStrength(coveragePoints) {
    if (coveragePoints.length === 0) return 0;
    
    return Math.round((coveragePoints.reduce((sum, p) => sum + p.signalStrength, 0) / coveragePoints.length) * 10) / 10;
  }

  analyzeOperatorCoverage(coveragePoints) {
    const analysis = {};
    
    this.operators.forEach(operator => {
      const operatorData = coveragePoints.map(p => p.operatorCoverage[operator]);
      
      analysis[operator] = {
        averageCoverage: Math.round(operatorData.reduce((sum, data) => sum + data.coverage, 0) / operatorData.length),
        averageSignal: Math.round((operatorData.reduce((sum, data) => sum + data.signalStrength, 0) / operatorData.length) * 10) / 10,
        deadZones: operatorData.filter(data => data.coverage === 0).length,
        technology: this.findDominantTechnology(operatorData),
        reliability: this.calculateOperatorReliability(operatorData)
      };
    });
    
    return analysis;
  }

  findDominantTechnology(operatorData) {
    const techCounts = operatorData.reduce((counts, data) => {
      counts[data.technology] = (counts[data.technology] || 0) + 1;
      return counts;
    }, {});
    
    return Object.entries(techCounts).reduce((dominant, [tech, count]) => {
      return count > (techCounts[dominant[0]] || 0) ? [tech, count] : dominant;
    }, ['No Service', 0])[0];
  }

  calculateOperatorReliability(operatorData) {
    const reliablePoints = operatorData.filter(data => data.signalStrength >= 5).length;
    const reliability = (reliablePoints / operatorData.length) * 100;
    
    if (reliability >= 90) return 'excellent';
    if (reliability >= 75) return 'good';
    if (reliability >= 50) return 'fair';
    return 'poor';
  }

  calculateOverallCommunicationRisk(coveragePoints) {
    if (coveragePoints.length === 0) return 5;
    
    return Math.round((coveragePoints.reduce((sum, p) => sum + p.communicationRisk, 0) / coveragePoints.length) * 10) / 10;
  }

  calculateOverallEmergencyRisk(coveragePoints) {
    if (coveragePoints.length === 0) return 5;
    
    return Math.round((coveragePoints.reduce((sum, p) => sum + p.emergencyRisk, 0) / coveragePoints.length) * 10) / 10;
  }

  generateNetworkRecommendations(coveragePoints, route) {
    const recommendations = [];
    const deadZones = coveragePoints.filter(p => p.isDeadZone);
    const weakSignalAreas = coveragePoints.filter(p => p.signalStrength < 4 && !p.isDeadZone);
    
    // Dead zone recommendations
    if (deadZones.length > 0) {
      const deadZonePercentage = (deadZones.length / coveragePoints.length) * 100;
      
      if (deadZonePercentage > 30) {
        recommendations.push({
          priority: 'CRITICAL',
          category: 'route_planning',
          recommendation: `${Math.round(deadZonePercentage)}% of route has no cellular coverage - consider alternative route`,
          action: 'Evaluate alternative routing options'
        });
      }
      
      recommendations.push({
        priority: 'HIGH',
        category: 'communication_equipment',
        recommendation: `${deadZones.length} dead zones identified - mandatory satellite communication`,
        action: 'Equip vehicles with satellite phones or emergency beacons'
      });
      
      recommendations.push({
        priority: 'HIGH',
        category: 'safety_protocol',
        recommendation: 'Implement dead zone safety protocols',
        action: 'Brief drivers on dead zone locations and emergency procedures'
      });
    }
    
    // Weak signal recommendations
    if (weakSignalAreas.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'equipment',
        recommendation: `${weakSignalAreas.length} areas with weak signal detected`,
        action: 'Use external antennas and keep devices fully charged'
      });
    }
    
    // Terrain-specific recommendations
    if (route.terrain === 'hilly' || route.terrain === 'mountainous') {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'terrain_specific',
        recommendation: 'Mountainous terrain affects signal quality',
        action: 'Carry backup communication methods for mountain areas'
      });
    }
    
    // General recommendations
    recommendations.push({
      priority: 'STANDARD',
      category: 'general_safety',
      recommendation: 'Standard communication safety protocols',
      action: 'Test communication at regular intervals and report status'
    });
    
    return recommendations;
  }

  recommendAlternativeCommunication(coveragePoints) {
    const deadZones = coveragePoints.filter(p => p.isDeadZone);
    const severeCoverageIssues = coveragePoints.filter(p => p.signalStrength < 2);
    
    const recommendations = {
      essential: [],
      recommended: [],
      optional: []
    };
    
    if (deadZones.length > 0) {
      recommendations.essential.push({
        method: 'satellite_phone',
        description: 'Satellite communication for dead zones',
        coverage: 'Global coverage, works in all dead zones',
        cost: 'High initial cost, per-minute charges'
      });
      
      recommendations.essential.push({
        method: 'two_way_radio',
        description: 'VHF/UHF radio communication',
        coverage: '10-50km range depending on terrain',
        cost: 'Moderate one-time cost'
      });
    }
    
    if (severeCoverageIssues.length > coveragePoints.length * 0.2) {
      recommendations.recommended.push({
        method: 'emergency_beacon',
        description: 'GPS emergency locator beacon',
        coverage: 'Global emergency services notification',
        cost: 'Moderate, subscription required'
      });
    }
    
    recommendations.optional.push({
      method: 'wifi_hotspot',
      description: 'Mobile WiFi hotspot devices',
      coverage: 'Better coverage in some areas',
      cost: 'Low to moderate'
    });
    
    return recommendations;
  }

  assessNetworkDataQuality(coveragePoints) {
    let qualityScore = 0;
    let maxScore = 0;
    
    // Analysis point density
    maxScore += 30;
    if (coveragePoints.length >= 25) qualityScore += 30;
    else if (coveragePoints.length >= 15) qualityScore += 20;
    else if (coveragePoints.length >= 10) qualityScore += 15;
    else qualityScore += 10;
    
    // Confidence level
    maxScore += 30;
    const avgConfidence = coveragePoints.reduce((sum, p) => sum + p.confidence, 0) / coveragePoints.length;
    qualityScore += Math.round(avgConfidence * 30);
    
    // Data completeness
    maxScore += 40;
    const completePoints = coveragePoints.filter(p => 
      p.operatorCoverage && 
      p.terrain && 
      p.signalStrength !== undefined
    ).length;
    qualityScore += Math.round((completePoints / coveragePoints.length) * 40);
    
    const percentage = Math.round((qualityScore / maxScore) * 100);
    
    let quality = 'poor';
    if (percentage >= 90) quality = 'excellent';
    else if (percentage >= 75) quality = 'good';
    else if (percentage >= 60) quality = 'fair';
    
    return {
      level: quality,
      score: percentage,
      details: {
        analysisPoints: coveragePoints.length,
        averageConfidence: Math.round(avgConfidence * 100) / 100,
        dataCompleteness: Math.round((completePoints / coveragePoints.length) * 100)
      }
    };
  }

  // Public API methods for route integration
  async getNetworkCoverageForRoute(routeId) {
    try {
      const coveragePoints = await NetworkCoverage.find({ routeId }).sort({ distanceFromStartKm: 1 });
      
      if (coveragePoints.length === 0) {
        return {
          exists: false,
          message: 'No network coverage analysis found for this route'
        };
      }
      
      return {
        exists: true,
        totalPoints: coveragePoints.length,
        deadZones: coveragePoints.filter(p => p.isDeadZone).length,
        averageSignal: this.calculateAverageSignalStrength(coveragePoints),
        communicationRisk: this.calculateOverallCommunicationRisk(coveragePoints),
        points: coveragePoints
      };
      
    } catch (error) {
      throw new Error(`Failed to get network coverage: ${error.message}`);
    }
  }

  async getDeadZonesForRoute(routeId) {
    try {
      const deadZones = await NetworkCoverage.find({ 
        routeId, 
        isDeadZone: true 
      }).sort({ distanceFromStartKm: 1 });
      
      return {
        total: deadZones.length,
        deadZones: deadZones.map(dz => ({
          location: {
            latitude: dz.latitude,
            longitude: dz.longitude,
            distanceFromStart: dz.distanceFromStartKm
          },
          severity: dz.deadZoneSeverity,
          radius: dz.deadZoneRadius,
          duration: dz.deadZoneDuration,
          terrain: dz.terrain,
          recommendations: dz.recommendations
        }))
      };
      
    } catch (error) {
      throw new Error(`Failed to get dead zones: ${error.message}`);
    }
  }

  async getCoverageByOperator(routeId, operator) {
    try {
      const coveragePoints = await NetworkCoverage.find({ routeId });
      
      if (coveragePoints.length === 0) {
        return { error: 'No coverage data found' };
      }
      
      const operatorData = coveragePoints.map(p => ({
        location: {
          latitude: p.latitude,
          longitude: p.longitude,
          distanceFromStart: p.distanceFromStartKm
        },
        coverage: p.operatorCoverage[operator]?.coverage || 0,
        signalStrength: p.operatorCoverage[operator]?.signalStrength || 0,
        technology: p.operatorCoverage[operator]?.technology || 'No Service'
      }));
      
      return {
        operator: operator.toUpperCase(),
        totalPoints: operatorData.length,
        averageCoverage: Math.round(operatorData.reduce((sum, d) => sum + d.coverage, 0) / operatorData.length),
        deadZones: operatorData.filter(d => d.coverage === 0).length,
        points: operatorData
      };
      
    } catch (error) {
      throw new Error(`Failed to get operator coverage: ${error.message}`);
    }
  }
}

// Export the service and model
module.exports = {
  NetworkCoverageService: new NetworkCoverageService(),
  NetworkCoverage
};