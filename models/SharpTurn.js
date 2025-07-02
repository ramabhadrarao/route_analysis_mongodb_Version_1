// File: models/SharpTurn.js
// Purpose: Store sharp turn data with images and analysis

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
  turnDirection: {
    type: String,
    enum: ['left', 'right', 'hairpin'],
    required: true
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
    required: true
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
  
  // Analysis Data
  analysisMethod: {
    type: String,
    enum: ['gps_data', 'satellite_imagery', 'street_view', 'manual'],
    default: 'gps_data'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8
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

module.exports = mongoose.model('SharpTurn', sharpTurnSchema);