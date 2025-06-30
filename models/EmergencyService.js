const mongoose = require('mongoose');

const emergencyServiceSchema = new mongoose.Schema({
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true
    },
    serviceType: {
      type: String,
      enum: ['hospital', 'police', 'fire_station', 'ambulance', 'mechanic'],
      required: true
    },
    name: {
      type: String,
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
    phoneNumber: String,
    emergencyNumber: String,
    address: String,
    operatingHours: String,
    servicesOffered: [String],
    distanceFromRouteKm: {
      type: Number,
      min: 0
    },
    responseTimeMinutes: {
      type: Number,
      min: 0
    },
    availabilityScore: {
      type: Number,
      min: 1,
      max: 10
    }
  }, {
    timestamps: true
  });
  
  emergencyServiceSchema.index({ routeId: 1 });
  emergencyServiceSchema.index({ serviceType: 1 });
  emergencyServiceSchema.index({ distanceFromRouteKm: 1 });
  
  module.exports = mongoose.model('EmergencyService', emergencyServiceSchema);