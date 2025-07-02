// File: models/BlindSpot.js - FIXED VERSION
// Purpose: Store blind spot data with visual analysis (Fixed validation errors)

const mongoose = require('mongoose');

const blindSpotSchema = new mongoose.Schema({
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
  
  // Blind Spot Analysis
  spotType: {
    type: String,
    enum: ['crest', 'curve', 'intersection', 'obstruction', 'vegetation', 'structure'],
    required: true
  },
  visibilityDistance: {
    type: Number,
    required: true // Meters
  },
  obstructionHeight: {
    type: Number,
    default: 0 // Meters
  },
  
  // Risk Assessment
  riskScore: {
    type: Number,
    min: 1,
    max: 10,
    required: true
  },
  severityLevel: {
    type: String,
    enum: ['minor', 'moderate', 'significant', 'critical'],
    required: true
  },
  
  // Visual Data
  streetViewImages: [{
    url: String,
    filename: String,
    heading: Number,
    pitch: Number,
    description: String // 'approach', 'spot', 'exit'
  }],
  aerialImage: {
    url: String,
    filename: String,
    zoom: Number
  },
  
  // Live Links
  streetViewLinks: [String],
  satelliteViewLink: String,
  
  // Environmental Factors
  roadGeometry: {
    gradient: Number, // Percentage
    curvature: Number, // Radius in meters
    width: Number // Road width in meters
  },
  vegetation: {
    present: Boolean,
    height: Number,
    density: String // 'light', 'medium', 'heavy'
  },
  
  // FIXED: Structures field - proper object structure
  structures: [{
    type: {
      type: String,
      enum: ['building', 'wall', 'bridge', 'sign', 'tree', 'other'],
      default: 'building'
    },
    height: {
      type: Number,
      default: 0
    },
    distance: {
      type: Number,
      default: 0
    },
    name: {
      type: String,
      default: ''
    }
  }],
  
  // Safety Measures
  warningSignsPresent: {
    type: Boolean,
    default: false
  },
  mirrorInstalled: {
    type: Boolean,
    default: false
  },
  speedLimit: Number,
  
  // FIXED: Analysis Data - added 'places_api' to enum
  analysisMethod: {
    type: String,
    enum: ['elevation_data', 'street_view', 'satellite_imagery', 'field_survey', 'places_api', 'gps_data'],
    default: 'elevation_data'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.7
  },
  
  // Recommendations
  recommendations: [String],
  
  // Metadata
  dataSource: String,
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
blindSpotSchema.index({ routeId: 1 });
blindSpotSchema.index({ riskScore: -1 });
blindSpotSchema.index({ spotType: 1 });
blindSpotSchema.index({ distanceFromStartKm: 1 });

// Virtual for visibility category
blindSpotSchema.virtual('visibilityCategory').get(function() {
  if (this.visibilityDistance < 50) return 'very_poor';
  if (this.visibilityDistance < 100) return 'poor';
  if (this.visibilityDistance < 200) return 'limited';
  return 'adequate';
});

// Method to generate satellite view link
blindSpotSchema.methods.generateSatelliteViewLink = function() {
  this.satelliteViewLink = `https://www.google.com/maps/@${this.latitude},${this.longitude},200m/data=!3m1!1e3`;
  return this.satelliteViewLink;
};

// Static method for route blind spot analysis
blindSpotSchema.statics.getRouteBlindSpotsAnalysis = function(routeId) {
  return this.aggregate([
    { $match: { routeId: new mongoose.Types.ObjectId(routeId) }},
    {
      $group: {
        _id: null,
        totalBlindSpots: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' },
        maxRiskScore: { $max: '$riskScore' },
        criticalSpots: {
          $sum: { $cond: [{ $gte: ['$riskScore', 8] }, 1, 0] }
        },
        typeBreakdown: {
          crest: { $sum: { $cond: [{ $eq: ['$spotType', 'crest'] }, 1, 0] }},
          curve: { $sum: { $cond: [{ $eq: ['$spotType', 'curve'] }, 1, 0] }},
          intersection: { $sum: { $cond: [{ $eq: ['$spotType', 'intersection'] }, 1, 0] }},
          obstruction: { $sum: { $cond: [{ $eq: ['$spotType', 'obstruction'] }, 1, 0] }}
        },
        avgVisibilityDistance: { $avg: '$visibilityDistance' },
        poorVisibilitySpots: {
          $sum: { $cond: [{ $lt: ['$visibilityDistance', 100] }, 1, 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('BlindSpot', blindSpotSchema);