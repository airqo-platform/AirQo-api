// activities.routes.js
const express = require("express");
const router = express.Router();
const activityController = require("@controllers/activity.controller");
const activitiesValidations = require("@validators/activities.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

router.post(
  "/recall",
  activitiesValidations.recallActivity,
  activityController.recall
);

router.post(
  "/deploy",
  activitiesValidations.deployActivity,
  activityController.deploy
);

router.post(
  "/deploy/batch",
  activitiesValidations.batchDeployActivity,
  activitiesValidations.validateUniqueDeviceNames,
  activityController.batchDeployWithCoordinates
);

router.post(
  "/maintain",
  activitiesValidations.maintainActivity,
  activityController.maintain
);

router.get(
  "/",
  activitiesValidations.listActivities,
  pagination(),
  activityController.list
);

router.put(
  "/",
  activitiesValidations.updateActivity,
  activityController.update
);

router.put(
  "/bulk/",
  activitiesValidations.bulkUpdateActivities,
  activityController.bulkUpdate
);

router.post(
  "/bulk/",
  activitiesValidations.bulkAddActivities,
  activityController.bulkAdd
);

router.delete(
  "/",
  activitiesValidations.deleteActivity,
  activityController.delete
);

module.exports = router;
