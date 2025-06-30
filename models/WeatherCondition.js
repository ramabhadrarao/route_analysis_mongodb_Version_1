// File: models/WeatherCondition.js
// Purpose: Store weather condition data
const mongoose = require('mongoose');

const weatherConditionSchema = new mongoose.Schema({
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
    season: {
      type: String,
      enum: ['spring', 'summer', 'monsoon', 'winter'],
      required: true
    },
    weatherCondition: {
      type: String,
      enum: ['clear', 'rainy', 'foggy', 'icy', 'stormy'],
      required: true
    },
    averageTemperature: {
      type: Number
    },
    precipitationMm: {
      type: Number,
      min: 0
    },
    windSpeedKmph: {
      type: Number,
      min: 0
    },
    visibilityKm: {
      type: Number,
      min: 0
    },
    roadSurfaceCondition: {
      type: String,
      enum: ['dry', 'wet', 'icy', 'muddy'],
      required: true
    },
    riskScore: {
      type: Number,
      min: 1,
      max: 10,
      required: true
    },
    dataYear: {
      type: Number
    }
  }, {
    timestamps: true
  });
  
  weatherConditionSchema.index({ routeId: 1 });
  weatherConditionSchema.index({ season: 1 });
  
  module.exports = mongoose.model('WeatherCondition', weatherConditionSchema);