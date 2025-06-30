// File: models/TrafficData.js
// Purpose: Store traffic density and flow data
const mongoose = require('mongoose');

const trafficDataSchema = new mongoose.Schema({
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
    peakHourTrafficCount: {
      type: Number,
      min: 0
    },
    averageSpeedKmph: {
      type: Number,
      min: 0
    },
    congestionLevel: {
      type: String,
      enum: ['free_flow', 'light', 'moderate', 'heavy', 'severe'],
      required: true
    },
    bottleneckCauses: [{
      type: String
    }],
    alternativeRoutesAvailable: {
      type: Boolean,
      default: false
    },
    riskScore: {
      type: Number,
      min: 1,
      max: 10,
      required: true
    },
    measurementTime: {
      type: Date,
      default: Date.now
    }
  }, {
    timestamps: true
  });
  
  trafficDataSchema.index({ routeId: 1 });
  trafficDataSchema.index({ congestionLevel: 1 });
  
  // Export for TrafficData
  const TrafficData = mongoose.model('TrafficData', trafficDataSchema);