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
  accidentFrequencyYearly: {
    type: Number,
    min: 0
  },
  accidentSeverity: {
    type: String,
    enum: ['minor', 'major', 'fatal'],
    required: true
  },
  commonAccidentTypes: [{
    type: String
  }],
  contributingFactors: [{
    type: String
  }],
  riskScore: {
    type: Number,
    min: 1,
    max: 10,
    required: true
  },
  dataSource: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

accidentProneAreaSchema.index({ routeId: 1 });
accidentProneAreaSchema.index({ latitude: 1, longitude: 1 });

module.exports = mongoose.model('AccidentProneArea', accidentProneAreaSchema);