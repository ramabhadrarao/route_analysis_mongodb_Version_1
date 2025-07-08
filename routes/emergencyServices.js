/ File: routes/emergencyServices.js
const express3 = require('express');
const router3 = express3.Router();
const emergencyServicesController = require('../controllers/emergencyServicesController');

router3.get('/:routeId/emergency-services', emergencyServicesController.getEmergencyServices);
router3.get('/:routeId/medical-facilities', emergencyServicesController.getMedicalFacilities);
router3.get('/:routeId/police-stations', emergencyServicesController.getPoliceStations);
router3.get('/:routeId/fire-stations', emergencyServicesController.getFireStations);
router3.get('/:routeId/fuel-stations', emergencyServicesController.getFuelStations);
router3.get('/:routeId/educational-institutions', emergencyServicesController.getEducationalInstitutions);
router3.get('/:routeId/food-rest-stops', emergencyServicesController.getFoodRestStops);
router3.get('/:routeId/emergency-contacts', emergencyServicesController.getEmergencyContacts);

module.exports = router3;