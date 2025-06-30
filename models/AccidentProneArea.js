// File: models/AccidentProneArea.js
// Purpose: Store accident-prone area data

const mongoose = require('mongoose');

const accidentProneAreaSchema = new mongoose.Schema({
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
  
  // Accident Statistics
  accidentFrequencyYearly: {
    type: Number,
    min: 0
  },
  accidentSeverity: {
    type: String,
    enum: ['minor', 'major', 'fatal'],
    required: true
  },
  
  // Accident Analysis
  commonAccidentTypes: [{
    type: String
  }],
  contributingFactors: [{
    type: String
  }],
  
  // Enhanced Risk Analysis
  timeOfDayRisk: {
    night: { type: Number, min: 1, max: 10, default: 5 },
    day: { type: Number, min: 1, max: 10, default: 3 },
    peak: { type: Number, min: 1, max: 10, default: 4 }
  },
  weatherRelatedRisk: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  infrastructureRisk: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  trafficVolumeRisk: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  
  // Overall Risk
  riskScore: {
    type: Number,
    min: 1,
    max: 10,
    required: true
  },
  
  // Historical Data
  lastAccidentDate: Date,
  accidentTrend: {
    type: String,
    enum: ['increasing', 'stable', 'decreasing'],
    default: 'stable'
  },
  
  // Safety Measures
  safetyMeasuresPresent: [String],
  recommendedImprovements: [String],
  
  // Data Source
  dataSource: {
    type: String,
    required: true
  },
  dataQuality: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Indexes
accidentProneAreaSchema.index({ routeId: 1 });
accidentProneAreaSchema.index({ latitude: 1, longitude: 1 });
accidentProneAreaSchema.index({ riskScore: -1 });
accidentProneAreaSchema.index({ distanceFromStartKm: 1 });
accidentProneAreaSchema.index({ accidentSeverity: 1 });

// Virtual for risk category
accidentProneAreaSchema.virtual('riskCategory').get(function() {
  if (this.riskScore >= 8) return 'critical';
  if (this.riskScore >= 6) return 'high';
  if (this.riskScore >= 4) return 'medium';
  return 'low';
});

// Method to get safety recommendations
accidentProneAreaSchema.methods.getSafetyRecommendations = function() {
  const recommendations = [];
  
  if (this.riskScore >= 8) {
    recommendations.push('Exercise extreme caution in this area');
    recommendations.push('Consider alternative route if possible');
    recommendations.push('Reduce speed significantly');
  }
  
  if (this.timeOfDayRisk.night > 7) {
    recommendations.push('Avoid night travel through this area');
  }
  
  if (this.weatherRelatedRisk > 6) {
    recommendations.push('Postpone travel during adverse weather');
  }
  
  if (this.commonAccidentTypes.includes('overtaking')) {
    recommendations.push('Avoid overtaking in this zone');
  }
  
  if (this.contributingFactors.includes('poor_visibility')) {
    recommendations.push('Use headlights and reduce speed');
  }
  
  return recommendations;
};

// Static method for accident hotspot analysis
accidentProneAreaSchema.statics.getHotspotAnalysis = function(routeId) {
  return this.aggregate([
    { $match: { routeId: new mongoose.Types.ObjectId(routeId) }},
    {
      $group: {
        _id: null,
        totalHotspots: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' },
        criticalAreas: {
          $sum: {
            $cond: [{ $gte: ['$riskScore', 8] }, 1, 0]
          }
        },
        highRiskAreas: {
          $sum: {
            $cond: [{ $and: [{ $gte: ['$riskScore', 6] }, { $lt: ['$riskScore', 8] }] }, 1, 0]
          }
        },
        mostCommonFactors: { $addToSet: '$contributingFactors' },
        severityDistribution: {
          fatal: {
            $sum: {
              $cond: [{ $eq: ['$accidentSeverity', 'fatal'] }, 1, 0]
            }
          },
          major: {
            $sum: {
              $cond: [{ $eq: ['$accidentSeverity', 'major'] }, 1, 0]
            }
          },
          minor: {
            $sum: {
              $cond: [{ $eq: ['$accidentSeverity', 'minor'] }, 1, 0]
            }
          }
        }
      }
    }
  ]);
};
module.exports = mongoose.model('AccidentProneArea', accidentProneAreaSchema);