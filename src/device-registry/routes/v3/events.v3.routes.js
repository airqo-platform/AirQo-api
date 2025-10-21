// events.v3.routes.js
const express = require("express");
const router = express.Router();
const eventControllerV3 = require("@controllers/event.v3.controller");
const eventValidations = require("@validators/events.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

// V3: Running devices with intelligent routing
router.get(
  "/running",
  eventValidations.listRunningDevices,
  pagination(),
  eventControllerV3.listRunningDevicesV3
);

// V3: Delete (no routing changes needed, reuse V2)
router.delete(
  "/",
  eventValidations.deleteValuesOnPlatform,
  eventControllerV3.deleteV3
);

// V3: Deployment statistics (no routing changes, but add V3 for consistency)
router.get(
  "/deployment-stats",
  eventValidations.getDeploymentStats,
  eventControllerV3.getDeploymentStatsV3
);

// V3: Validate device context (no routing changes)
router.get(
  "/validate-device",
  eventValidations.validateDeviceContext,
  eventControllerV3.validateDeviceContextV3
);

// V3: Events by deployment type with intelligent routing
router.get(
  "/deployment-type/:deploymentType",
  eventValidations.listByDeploymentType,
  pagination(),
  eventControllerV3.listByDeploymentTypeV3
);

// V3: Air quality category filters with intelligent routing
router.get(
  "/good",
  eventValidations.listGoodEvents,
  pagination(),
  eventControllerV3.listGoodV3
);
router.get(
  "/moderate",
  eventValidations.listModerateEvents,
  pagination(),
  eventControllerV3.listModerateV3
);
router.get(
  "/u4sg",
  eventValidations.listU4sgEvents,
  pagination(),
  eventControllerV3.listU4sgV3
);
router.get(
  "/unhealthy",
  eventValidations.listUnhealthyEvents,
  pagination(),
  eventControllerV3.listUnhealthyV3
);
router.get(
  "/very_unhealthy",
  eventValidations.listVeryUnhealthyEvents,
  pagination(),
  eventControllerV3.listVeryUnhealthyV3
);
router.get(
  "/hazardous",
  eventValidations.listHazardousEvents,
  pagination(),
  eventControllerV3.listHazardousV3
);

// V3: Add events (no routing changes)
router.post("/", eventValidations.addEvents, eventControllerV3.addValuesV3);

// V3: Transform events (no routing changes)
router.post(
  "/transform",
  eventValidations.transformEvents,
  eventControllerV3.transformV3
);

// V3: Latest/Recent with intelligent routing
router.get(
  "/latest",
  eventValidations.listRecentEvents,
  pagination(),
  eventControllerV3.listRecentV3
);

// V3: All devices with intelligent routing
router.get(
  "/all",
  eventValidations.listAllEvents,
  pagination(),
  eventControllerV3.listAllDevicesV3
);

// V3: List events with intelligent routing
router.get(
  "/",
  eventValidations.listEvents,
  pagination(),
  eventControllerV3.listV3
);

// V3: Transmit (no routing changes)
router.post(
  "/transmit/single",
  eventValidations.transmitMultipleSensorValues,
  eventControllerV3.transmitMultipleSensorValuesV3
);

router.post(
  "/transmit/bulk",
  eventValidations.bulkTransmitMultipleSensorValues,
  eventControllerV3.bulkTransmitMultipleSensorValuesV3
);

module.exports = router;
