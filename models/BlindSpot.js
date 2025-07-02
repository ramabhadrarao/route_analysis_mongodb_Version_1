// File: models/BlindSpot.js - FIXED VERSION
// Purpose: Blind spot model with strict validation to prevent NaN errors
// Fixed: All numeric validations and enum values

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
    max: 90,
    validate: {
      validator: function(v) {
        return !isNaN(v) && isFinite(v);
      },
      message: 'Latitude must be a valid number'
    }
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180,
    validate: {
      validator: function(v) {
        return !isNaN(v) && isFinite(v);
      },
      message: 'Longitude must be a valid number'
    }
  },
  
  // Distance Information
  distanceFromStartKm: {
    type: Number,
    min: 0,
    default: 0,
    validate: {
      validator: function(v) {
        return v === null || v === undefined || (!isNaN(v) && isFinite(v) && v >= 0);
      },
      message: 'Distance from start must be a valid positive number'
    }
  },
  
  // Blind Spot Analysis
  spotType: {
    type: String,
    enum: ['crest', 'curve', 'intersection', 'obstruction', 'vegetation', 'structure'],
    required: true
  },
  
  // FIXED: Critical validation for visibilityDistance
  visibilityDistance: {
    type: Number,
    required: true,
    min: 1,
    max: 2000,
    validate: {
      validator: function(v) {
        // STRICT validation to prevent NaN
        if (v === null || v === undefined) return false;
        if (typeof v !== 'number') return false;
        if (isNaN(v) || !isFinite(v)) return false;
        return v >= 1 && v <= 2000;
      },
      message: 'Visibility distance must be a valid number between 1 and 2000 meters'
    },
    set: function(v) {
      // FIXED: Sanitize input to prevent NaN
      if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
        return 50; // Default safe value
      }
      return Math.max(1, Math.min(2000, Math.round(v * 100) / 100));
    }
  },
  
  obstructionHeight: {
    type: Number,
    default: 0,
    min: 0,
    max: 200,
    validate: {
      validator: function(v) {
        return v === null || v === undefined || (!isNaN(v) && isFinite(v) && v >= 0);
      },
      message: 'Obstruction height must be a valid positive number'
    },
    set: function(v) {
      if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
        return 0;
      }
      return Math.max(0, Math.min(200, Math.round(v * 100) / 100));
    }
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
    },
    set: function(v) {
      if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
        return 5; // Default medium risk
      }
      return Math.max(1, Math.min(10, Math.round(v * 100) / 100));
    }
  },
  
  severityLevel: {
    type: String,
    enum: ['minor', 'moderate', 'significant', 'critical'],
    required: true,
    default: function() {
      if (this.riskScore >= 8) return 'critical';
      if (this.riskScore >= 6) return 'significant';
      if (this.riskScore >= 4) return 'moderate';
      return 'minor';
    }
  },
  
  // Visual Data
  streetViewImages: [{
    url: String,
    filename: String,
    heading: {
      type: Number,
      min: 0,
      max: 360,
      validate: {
        validator: function(v) {
          return v === null || v === undefined || (!isNaN(v) && isFinite(v));
        }
      }
    },
    pitch: {
      type: Number,
      min: -90,
      max: 90,
      validate: {
        validator: function(v) {
          return v === null || v === undefined || (!isNaN(v) && isFinite(v));
        }
      }
    },
    description: String
  }],
  
  aerialImage: {
    url: String,
    filename: String,
    zoom: {
      type: Number,
      min: 1,
      max: 20,
      validate: {
        validator: function(v) {
          return v === null || v === undefined || (!isNaN(v) && isFinite(v));
        }
      }
    }
  },
  
  // Live Links
  streetViewLinks: [String],
  satelliteViewLink: String,
  
  // Environmental Factors
  roadGeometry: {
    gradient: {
      type: Number,
      default: 0,
      validate: {
        validator: function(v) {
          return v === null || v === undefined || (!isNaN(v) && isFinite(v));
        }
      },
      set: function(v) {
        if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
          return 0;
        }
        return Math.max(-30, Math.min(30, Math.round(v * 100) / 100));
      }
    },
    curvature: {
      type: Number,
      default: 0,
      validate: {
        validator: function(v) {
          return v === null || v === undefined || (!isNaN(v) && isFinite(v) && v >= 0);
        }
      },
      set: function(v) {
        if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
          return 0;
        }
        return Math.max(0, Math.round(v));
      }
    },
    width: {
      type: Number,
      default: 7,
      validate: {
        validator: function(v) {
          return v === null || v === undefined || (!isNaN(v) && isFinite(v) && v > 0);
        }
      },
      set: function(v) {
        if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
          return 7;
        }
        return Math.max(2, Math.min(20, Math.round(v * 10) / 10));
      }
    }
  },
  
  vegetation: {
    present: {
      type: Boolean,
      default: false
    },
    height: {
      type: Number,
      default: 0,
      validate: {
        validator: function(v) {
          return v === null || v === undefined || (!isNaN(v) && isFinite(v) && v >= 0);
        }
      },
      set: function(v) {
        if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
          return 0;
        }
        return Math.max(0, Math.min(50, Math.round(v * 10) / 10));
      }
    },
    density: {
      type: String,
      enum: ['light', 'medium', 'heavy'],
      default: 'light'
    }
  },
  
  // FIXED: Structures field with proper validation
  structures: [{
    type: {
      type: String,
      enum: ['building', 'wall', 'bridge', 'sign', 'tree', 'other'],
      default: 'building'
    },
    height: {
      type: Number,
      default: 0,
      validate: {
        validator: function(v) {
          return v === null || v === undefined || (!isNaN(v) && isFinite(v) && v >= 0);
        }
      },
      set: function(v) {
        if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
          return 0;
        }
        return Math.max(0, Math.min(200, Math.round(v * 10) / 10));
      }
    },
    distance: {
      type: Number,
      default: 0,
      validate: {
        validator: function(v) {
          return v === null || v === undefined || (!isNaN(v) && isFinite(v) && v >= 0);
        }
      },
      set: function(v) {
        if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
          return 0;
        }
        return Math.max(0, Math.min(1000, Math.round(v * 10) / 10));
      }
    },
    name: {
      type: String,
      default: '',
      maxlength: 100
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
  speedLimit: {
    type: Number,
    min: 10,
    max: 120,
    validate: {
      validator: function(v) {
        return v === null || v === undefined || (!isNaN(v) && isFinite(v) && v >= 10 && v <= 120);
      }
    },
    set: function(v) {
      if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
        return null;
      }
      return Math.max(10, Math.min(120, Math.round(v)));
    }
  },
  
  // FIXED: Analysis Data with proper enum values
  analysisMethod: {
    type: String,
    enum: [
      'elevation_data', 
      'street_view', 
      'satellite_imagery', 
      'field_survey', 
      'places_api', 
      'gps_data',
      'elevation_ray_tracing',
      'geometric_sight_distance',
      'geometric_shadow_analysis',
      'real_calculations',
      'google_elevation_api',
      'aashto_standards',
      'enhanced_gps_analysis'
    ],
    default: 'elevation_data'
  },
  
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.7,
    validate: {
      validator: function(v) {
        return !isNaN(v) && isFinite(v) && v >= 0 && v <= 1;
      },
      message: 'Confidence must be a valid number between 0 and 1'
    },
    set: function(v) {
      if (v === null || v === undefined || isNaN(v) || !isFinite(v)) {
        return 0.7;
      }
      return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
    }
  },
  
  // Recommendations
  recommendations: [{
    type: String,
    maxlength: 500
  }],
  
  // Metadata
  dataSource: {
    type: String,
    default: 'REAL_CALCULATION'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// INDEXES for efficient querying
blindSpotSchema.index({ routeId: 1 });
blindSpotSchema.index({ riskScore: -1 });
blindSpotSchema.index({ spotType: 1 });
blindSpotSchema.index({ distanceFromStartKm: 1 });
blindSpotSchema.index({ severityLevel: 1 });
blindSpotSchema.index({ 'routeId': 1, 'riskScore': -1 }); // Compound index

// VIRTUALS
blindSpotSchema.virtual('visibilityCategory').get(function() {
  if (!this.visibilityDistance || isNaN(this.visibilityDistance)) return 'unknown';
  
  if (this.visibilityDistance < 50) return 'very_poor';
  if (this.visibilityDistance < 100) return 'poor';
  if (this.visibilityDistance < 200) return 'limited';
  return 'adequate';
});

blindSpotSchema.virtual('riskCategory').get(function() {
  if (!this.riskScore || isNaN(this.riskScore)) return 'unknown';
  
  if (this.riskScore >= 8) return 'critical';
  if (this.riskScore >= 6) return 'high';
  if (this.riskScore >= 4) return 'medium';
  return 'low';
});

// PRE-SAVE MIDDLEWARE for validation and cleanup
blindSpotSchema.pre('save', function(next) {
  try {
    // CRITICAL: Ensure visibilityDistance is never NaN
    if (isNaN(this.visibilityDistance) || !isFinite(this.visibilityDistance)) {
      console.warn('Invalid visibilityDistance detected, setting to default');
      this.visibilityDistance = 50; // Safe default
    }
    
    // Ensure riskScore is valid
    if (isNaN(this.riskScore) || !isFinite(this.riskScore)) {
      console.warn('Invalid riskScore detected, setting to default');
      this.riskScore = 5; // Medium risk default
    }
    
    // Auto-set severity based on risk score
    if (this.riskScore >= 8) this.severityLevel = 'critical';
    else if (this.riskScore >= 6) this.severityLevel = 'significant';
    else if (this.riskScore >= 4) this.severityLevel = 'moderate';
    else this.severityLevel = 'minor';
    
    // Validate coordinates
    if (isNaN(this.latitude) || isNaN(this.longitude)) {
      return next(new Error('Invalid coordinates provided'));
    }
    
    // Clean up structures array
    if (this.structures && Array.isArray(this.structures)) {
      this.structures = this.structures.filter(struct => {
        return struct && typeof struct === 'object' && struct.type;
      });
    } else {
      this.structures = [];
    }
    
    // Validate numeric fields in roadGeometry
    if (this.roadGeometry) {
      if (isNaN(this.roadGeometry.gradient)) this.roadGeometry.gradient = 0;
      if (isNaN(this.roadGeometry.curvature)) this.roadGeometry.curvature = 0;
      if (isNaN(this.roadGeometry.width)) this.roadGeometry.width = 7;
    }
    
    // Update lastUpdated
    this.lastUpdated = new Date();
    
    next();
  } catch (error) {
    console.error('BlindSpot pre-save validation error:', error);
    next(error);
  }
});

// POST-SAVE MIDDLEWARE for logging
blindSpotSchema.post('save', function(doc) {
  console.log(`✅ Blind spot saved: ${doc.spotType} at ${doc.latitude}, ${doc.longitude} with risk ${doc.riskScore}`);
});

// INSTANCE METHODS

// Method to generate satellite view link
blindSpotSchema.methods.generateSatelliteViewLink = function() {
  try {
    if (isNaN(this.latitude) || isNaN(this.longitude)) {
      console.warn('Invalid coordinates for satellite view link');
      this.satelliteViewLink = '';
      return '';
    }
    
    this.satelliteViewLink = `https://www.google.com/maps/@${this.latitude},${this.longitude},200m/data=!3m1!1e3`;
    return this.satelliteViewLink;
  } catch (error) {
    console.error('Error generating satellite view link:', error);
    this.satelliteViewLink = '';
    return '';
  }
};

// Method to get safety recommendations based on blind spot characteristics
blindSpotSchema.methods.getSafetyRecommendations = function() {
  const recommendations = [];
  
  try {
    // Risk-based recommendations
    if (this.riskScore >= 8) {
      recommendations.push('CRITICAL: Reduce speed to 20-30 km/h when approaching this area');
      recommendations.push('Use horn/signal to alert other vehicles of your presence');
      recommendations.push('Consider alternative route if possible');
    } else if (this.riskScore >= 6) {
      recommendations.push('HIGH RISK: Reduce speed significantly and exercise extreme caution');
      recommendations.push('Maintain extra following distance');
    }
    
    // Type-specific recommendations
    switch (this.spotType) {
      case 'crest':
        recommendations.push('Reduce speed before cresting hill');
        recommendations.push('Stay in center of lane and be prepared to stop');
        recommendations.push('Use headlights during daylight hours');
        break;
      case 'curve':
        recommendations.push('Reduce speed before entering curve');
        recommendations.push('Position vehicle for maximum sight distance');
        recommendations.push('Never attempt overtaking in curved sections');
        break;
      case 'obstruction':
        recommendations.push('Proceed with extreme caution');
        recommendations.push('Watch for pedestrians and cross traffic');
        recommendations.push('Use convoy travel if possible');
        break;
      case 'intersection':
        recommendations.push('Come to complete stop and check all directions');
        recommendations.push('Use horn to signal approach');
        break;
    }
    
    // Visibility-based recommendations
    if (this.visibilityDistance < 50) {
      recommendations.push('VERY LIMITED VISIBILITY: Use hazard lights');
      recommendations.push('Travel in convoy with lead vehicle communication');
    } else if (this.visibilityDistance < 100) {
      recommendations.push('LIMITED VISIBILITY: Reduce speed and increase alertness');
    }
    
    // Environmental recommendations
    if (this.structures && this.structures.length > 0) {
      recommendations.push('Multiple obstructions present - maintain 360° awareness');
    }
    
    if (this.vegetation && this.vegetation.present && this.vegetation.density === 'heavy') {
      recommendations.push('Dense vegetation - watch for wildlife and hidden hazards');
    }
    
    return recommendations;
  } catch (error) {
    console.error('Error generating safety recommendations:', error);
    return ['Exercise extreme caution in this area'];
  }
};

// Method to calculate stopping distance requirement
blindSpotSchema.methods.calculateRequiredStoppingDistance = function(speed = 60) {
  try {
    // AASHTO stopping sight distance formula
    // SSD = 0.278 * V * t + V² / (254 * (f + G))
    const reactionTime = 2.5; // seconds
    const frictionCoefficient = 0.35; // wet pavement
    const grade = Math.abs(this.roadGeometry?.gradient || 0) / 100;
    
    const reactionDistance = 0.278 * speed * reactionTime;
    const brakingDistance = (speed * speed) / (254 * (frictionCoefficient + grade));
    const totalStoppingDistance = reactionDistance + brakingDistance;
    
    return Math.round(totalStoppingDistance * 1.2); // 20% safety margin
  } catch (error) {
    console.error('Error calculating stopping distance:', error);
    return 100; // Default safe distance
  }
};

// STATIC METHODS

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
        highRiskSpots: {
          $sum: { $cond: [{ $and: [{ $gte: ['$riskScore', 6] }, { $lt: ['$riskScore', 8] }] }, 1, 0] }
        },
        typeBreakdown: {
          crest: { $sum: { $cond: [{ $eq: ['$spotType', 'crest'] }, 1, 0] }},
          curve: { $sum: { $cond: [{ $eq: ['$spotType', 'curve'] }, 1, 0] }},
          intersection: { $sum: { $cond: [{ $eq: ['$spotType', 'intersection'] }, 1, 0] }},
          obstruction: { $sum: { $cond: [{ $eq: ['$spotType', 'obstruction'] }, 1, 0] }},
          vegetation: { $sum: { $cond: [{ $eq: ['$spotType', 'vegetation'] }, 1, 0] }},
          structure: { $sum: { $cond: [{ $eq: ['$spotType', 'structure'] }, 1, 0] }}
        },
        avgVisibilityDistance: { $avg: '$visibilityDistance' },
        poorVisibilitySpots: {
          $sum: { $cond: [{ $lt: ['$visibilityDistance', 100] }, 1, 0] }
        },
        severityBreakdown: {
          critical: { $sum: { $cond: [{ $eq: ['$severityLevel', 'critical'] }, 1, 0] }},
          significant: { $sum: { $cond: [{ $eq: ['$severityLevel', 'significant'] }, 1, 0] }},
          moderate: { $sum: { $cond: [{ $eq: ['$severityLevel', 'moderate'] }, 1, 0] }},
          minor: { $sum: { $cond: [{ $eq: ['$severityLevel', 'minor'] }, 1, 0] }}
        }
      }
    }
  ]);
};

// Static method to find critical blind spots for a route
blindSpotSchema.statics.getCriticalBlindSpots = function(routeId, riskThreshold = 7) {
  return this.find({
    routeId: new mongoose.Types.ObjectId(routeId),
    riskScore: { $gte: riskThreshold }
  })
  .sort({ riskScore: -1, distanceFromStartKm: 1 })
  .limit(20);
};

// Static method to get blind spots by type
blindSpotSchema.statics.getBlindSpotsByType = function(routeId, spotType) {
  return this.find({
    routeId: new mongoose.Types.ObjectId(routeId),
    spotType: spotType
  })
  .sort({ riskScore: -1 });
};

// Static method for route safety summary
blindSpotSchema.statics.getRouteSafetySummary = function(routeId) {
  return this.aggregate([
    { $match: { routeId: new mongoose.Types.ObjectId(routeId) }},
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              totalBlindSpots: { $sum: 1 },
              avgRiskScore: { $avg: '$riskScore' },
              criticalCount: { $sum: { $cond: [{ $gte: ['$riskScore', 8] }, 1, 0] }},
              avgVisibility: { $avg: '$visibilityDistance' }
            }
          }
        ],
        riskDistribution: [
          {
            $bucket: {
              groupBy: '$riskScore',
              boundaries: [1, 4, 6, 8, 10],
              default: 'other',
              output: {
                count: { $sum: 1 },
                avgVisibility: { $avg: '$visibilityDistance' }
              }
            }
          }
        ],
        typeAnalysis: [
          {
            $group: {
              _id: '$spotType',
              count: { $sum: 1 },
              avgRisk: { $avg: '$riskScore' },
              maxRisk: { $max: '$riskScore' }
            }
          }
        ]
      }
    }
  ]);
};

// Transform JSON output
blindSpotSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // Remove internal fields
    delete ret.__v;
    delete ret._id;
    
    // Ensure numeric fields are valid
    if (isNaN(ret.visibilityDistance)) ret.visibilityDistance = 50;
    if (isNaN(ret.riskScore)) ret.riskScore = 5;
    if (isNaN(ret.confidence)) ret.confidence = 0.7;
    
    return ret;
  }
});

// Error handling for validation
blindSpotSchema.post('validate', function(error, doc, next) {
  if (error) {
    console.error('BlindSpot validation error:', error);
    
    // Handle specific validation errors
    if (error.errors && error.errors.visibilityDistance) {
      console.error('visibilityDistance validation failed - setting default');
      doc.visibilityDistance = 50;
    }
    
    if (error.errors && error.errors.riskScore) {
      console.error('riskScore validation failed - setting default');
      doc.riskScore = 5;
    }
  }
  next();
});

module.exports = mongoose.model('BlindSpot', blindSpotSchema);