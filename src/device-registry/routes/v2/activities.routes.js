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

// ENHANCED: Original deploy with better validation supporting both static and mobile deployments
router.post(
  "/deploy",
  activitiesValidations.enhancedDeployActivity, // Use enhanced validation
  activityController.deploy
);

// ENHANCED: Deploy owned device with comprehensive validation for both deployment types
router.post(
  "/deploy-owned",
  activitiesValidations.validateDeployOwnedDevice,
  activityController.deployOwnedDevice
);

// ENHANCED: Batch deployment supporting mixed deployment types (static and mobile)
router.post(
  "/deploy/batch",
  activitiesValidations.batchDeployActivity,
  activitiesValidations.validateUniqueDeviceNames,
  activityController.batchDeployWithCoordinates
);

router.post(
  "/deploy/mobile",
  activitiesValidations.enhancedDeployActivity,
  activityController.deployMobile
);

router.post(
  "/deploy/static",
  activitiesValidations.enhancedDeployActivity,
  activityController.deployStatic
);

router.get(
  "/deploy/stats",
  activitiesValidations.validateTenantQuery,
  activityController.getDeploymentStats
);

router.get(
  "/devices/by-type/:deploymentType",
  [
    ...activitiesValidations.validateTenantQuery,
    pagination(),
    // Validate deployment type parameter in middleware
    (req, res, next) => {
      const { deploymentType } = req.params;
      if (!["static", "mobile"].includes(deploymentType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid deployment type",
          errors: { message: "deploymentType must be 'static' or 'mobile'" },
        });
      }
      next();
    },
  ],
  activityController.getDevicesByDeploymentType
);

router.post(
  "/maintain",
  activitiesValidations.maintainActivity,
  activityController.maintain
);

router.post(
  "/recalculate-next-maintenance",
  activitiesValidations.recalculate,
  activityController.recalculateNextMaintenance
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
