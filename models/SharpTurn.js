// File: models/SharpTurn.js - FIXED VERSION
// Purpose: Fixed Sharp Turn model with correct enum values
// CRITICAL FIX: Added missing enum values causing validation failures

const mongoose = require('mongoose');

const sharpTurnSchema = new mongoose.Schema({
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
  
  // Turn Analysis
  turnAngle: {
    type: Number,
    required: true,
    min: 0,
    max: 180 // Degrees
  },
  
  // FIXED: Added missing 'straight' enum value
  turnDirection: {
    type: String,
    enum: ['left', 'right', 'hairpin', 'straight'], // ✅ ADDED 'straight'
    required: true,
    default: 'straight'
  },
  
  turnRadius: {
    type: Number,
    min: 0 // Meters
  },
  approachSpeed: {
    type: Number,
    default: 40 // km/h
  },
  recommendedSpeed: {
    type: Number,
    required: true // km/h
  },
  
  // Risk Assessment
  riskScore: {
    type: Number,
    min: 1,
    max: 10,
    required: true,
    validate: {
      validator: function(v) {
        return !isNaN(v) && isFinite(v) && v >= 1 && v <= 10;
      },
      message: 'Risk score must be a valid number between 1 and 10'
    }
  },
  turnSeverity: {
    type: String,
    enum: ['gentle', 'moderate', 'sharp', 'hairpin'],
    required: true
  },
  
  // Visual Data
  streetViewImage: {
    url: String,
    filename: String,
    heading: Number, // Direction of camera
    pitch: Number,   // Up/down angle
    fov: Number      // Field of view
  },
  mapImage: {
    url: String,
    filename: String,
    zoom: Number,
    mapType: String
  },
  
  // Live Links
  streetViewLink: String,
  mapsLink: String,
  
  // Environmental Factors
  visibility: {
    type: String,
    enum: ['excellent', 'good', 'limited', 'poor'],
    default: 'good'
  },
  roadSurface: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  bankingAngle: {
    type: Number,
    default: 0 // Degrees of road banking
  },
  elevation: Number,
  
  // Safety Features
  guardrails: {
    type: Boolean,
    default: false
  },
  warningSigns: {
    type: Boolean,
    default: false
  },
  lightingAvailable: {
    type: Boolean,
    default: false
  },
  
  // FIXED: Added missing 'enhanced_gps_analysis' enum value
  analysisMethod: {
    type: String,
    enum: [
      'gps_data', 
      'satellite_imagery', 
      'street_view', 
      'manual',
      'enhanced_gps_analysis', // ✅ ADDED missing value
      'real_calculations',
      'geometric_analysis'
    ],
    default: 'gps_data'
  },
  
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8,
    validate: {
      validator: function(v) {
        return !isNaN(v) && isFinite(v) && v >= 0 && v <= 1;
      },
      message: 'Confidence must be a valid number between 0 and 1'
    }
  },
  
  // Metadata
  dataSource: {
    type: String,
    default: 'ROUTE_ANALYSIS'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
sharpTurnSchema.index({ routeId: 1 });
sharpTurnSchema.index({ riskScore: -1 });
sharpTurnSchema.index({ turnSeverity: 1 });
sharpTurnSchema.index({ distanceFromStartKm: 1 });

// FIXED: Pre-save validation to handle edge cases
sharpTurnSchema.pre('save', function(next) {
  try {
    // Handle straight turns (angle < 15 degrees)
    if (this.turnAngle < 15) {
      this.turnDirection = 'straight';
      this.turnSeverity = 'gentle';
    }
    
    // Validate and fix numeric fields
    if (isNaN(this.riskScore) || !isFinite(this.riskScore)) {
      this.riskScore = 5; // Default medium risk
    }
    
    if (isNaN(this.confidence) || !isFinite(this.confidence)) {
      this.confidence = 0.8; // Default confidence
    }
    
    // Auto-set severity based on angle if not set
    if (!this.turnSeverity || this.turnSeverity === 'gentle') {
      if (this.turnAngle > 120) this.turnSeverity = 'hairpin';
      else if (this.turnAngle > 90) this.turnSeverity = 'sharp';
      else if (this.turnAngle > 45) this.turnSeverity = 'moderate';
      else this.turnSeverity = 'gentle';
    }
    
    // Update lastUpdated
    this.lastUpdated = new Date();
    
    next();
  } catch (error) {
    console.error('SharpTurn pre-save validation error:', error);
    next(error);
  }
});

// Virtual for risk category
sharpTurnSchema.virtual('riskCategory').get(function() {
  if (this.riskScore >= 8) return 'critical';
  if (this.riskScore >= 6) return 'high';
  if (this.riskScore >= 4) return 'medium';
  return 'low';
});

// Method to generate street view link
sharpTurnSchema.methods.generateStreetViewLink = function() {
  const baseUrl = 'https://www.google.com/maps/@';
  const params = `${this.latitude},${this.longitude},3a,75y,${this.streetViewImage?.heading || 0}h,90t`;
  this.streetViewLink = `${baseUrl}${params}`;
  return this.streetViewLink;
};

// Method to generate maps link
sharpTurnSchema.methods.generateMapsLink = function() {
  this.mapsLink = `https://www.google.com/maps/place/${this.latitude},${this.longitude}/@${this.latitude},${this.longitude},17z`;
  return this.mapsLink;
};

// FIXED: Enhanced safety recommendations method
sharpTurnSchema.methods.getSafetyRecommendations = function() {
  const recommendations = [];
  
  // Risk-based recommendations
  if (this.riskScore >= 8) {
    recommendations.push('CRITICAL: Reduce speed to 15-25 km/h');
    recommendations.push('Use convoy travel with constant communication');
    recommendations.push('Consider alternative route if possible');
  } else if (this.riskScore >= 6) {
    recommendations.push('HIGH RISK: Reduce speed significantly');
    recommendations.push('Exercise extreme caution');
  }
  
  // Turn-specific recommendations
  if (this.turnSeverity === 'hairpin') {
    recommendations.push('Hairpin turn: Use engine braking');
    recommendations.push('Stay in center of lane');
    recommendations.push('No overtaking allowed');
  } else if (this.turnSeverity === 'sharp') {
    recommendations.push('Sharp turn: Reduce speed before entering');
    recommendations.push('Position for maximum visibility');
  }
  
  // Safety feature recommendations
  if (!this.guardrails) {
    recommendations.push('No guardrails: Exercise extra caution');
  }
  
  if (!this.warningSigns) {
    recommendations.push('No warning signs: Approach with extreme care');
  }
  
  if (this.visibility === 'poor' || this.visibility === 'limited') {
    recommendations.push('Poor visibility: Use horn when approaching');
    recommendations.push('Maintain constant vigilance');
  }
  
  return recommendations;
};

// Static method for route analysis
sharpTurnSchema.statics.getRouteSharpTurnsAnalysis = function(routeId) {
  return this.aggregate([
    { $match: { routeId: new mongoose.Types.ObjectId(routeId) }},
    {
      $group: {
        _id: null,
        totalTurns: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' },
        maxRiskScore: { $max: '$riskScore' },
        criticalTurns: {
          $sum: { $cond: [{ $gte: ['$riskScore', 8] }, 1, 0] }
        },
        highRiskTurns: {
          $sum: { $cond: [{ $and: [{ $gte: ['$riskScore', 6] }, { $lt: ['$riskScore', 8] }] }, 1, 0] }
        },
        severityBreakdown: {
          hairpin: { $sum: { $cond: [{ $eq: ['$turnSeverity', 'hairpin'] }, 1, 0] }},
          sharp: { $sum: { $cond: [{ $eq: ['$turnSeverity', 'sharp'] }, 1, 0] }},
          moderate: { $sum: { $cond: [{ $eq: ['$turnSeverity', 'moderate'] }, 1, 0] }},
          gentle: { $sum: { $cond: [{ $eq: ['$turnSeverity', 'gentle'] }, 1, 0] }}
        }
      }
    }
  ]);
};

// Transform JSON output
sharpTurnSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
    
    // Ensure numeric fields are valid
    if (isNaN(ret.riskScore)) ret.riskScore = 5;
    if (isNaN(ret.confidence)) ret.confidence = 0.8;
    
    return ret;
  }
});

module.exports = mongoose.model('SharpTurn', sharpTurnSchema);