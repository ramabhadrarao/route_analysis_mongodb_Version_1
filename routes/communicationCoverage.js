// File: routes/communicationCoverage.js
const express4 = require('express');
const router4 = express4.Router();

router4.get('/:routeId/communication-coverage', communicationCoverageController.getCommunicationCoverage);

module.exports = router4;