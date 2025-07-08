// File: routes/compliance.js
const express6 = require('express');
const router6 = express6.Router();

router6.get('/:routeId/compliance-requirements', complianceController.getComplianceRequirements);

module.exports = router6;