// cohorts.routes.js
const express = require("express");
const router = express.Router();
const createCohortController = require("@controllers/cohort.controller");
const cohortValidations = require("@validators/cohorts.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

router.delete(
  "/:cohort_id",
  cohortValidations.deleteCohort,
  createCohortController.delete
);

router.put(
  "/:cohort_id/name",
  cohortValidations.updateCohortName,
  createCohortController.updateName
);

router.put(
  "/:cohort_id",
  cohortValidations.updateCohort,
  createCohortController.update
);

router.post("/", cohortValidations.createCohort, createCohortController.create);

router.get(
  "/",
  cohortValidations.listCohorts,
  pagination(),
  createCohortController.list
);

router.get(
  "/summary",
  cohortValidations.listCohortsSummary,
  pagination(),
  createCohortController.listSummary
);

router.get(
  "/dashboard",
  cohortValidations.listCohortsDashboard,
  pagination(),
  createCohortController.listDashboard
);

router.get(
  "/users",
  cohortValidations.listUserCohorts,
  pagination(),
  createCohortController.listUserCohorts
);

router.put(
  "/:cohort_id/assign-device/:device_id",
  cohortValidations.assignOneDeviceToCohort,
  createCohortController.assignOneDeviceToCohort
);

router.get(
  "/:cohort_id/assigned-devices",
  cohortValidations.listAssignedDevices,
  pagination(),
  createCohortController.listAssignedDevices
);

router.get(
  "/:cohort_id/available-devices",
  cohortValidations.listAvailableDevices,
  pagination(),
  createCohortController.listAvailableDevices
);

router.post(
  "/:cohort_id/assign-devices",
  cohortValidations.assignManyDevicesToCohort,
  createCohortController.assignManyDevicesToCohort
);

router.delete(
  "/:cohort_id/unassign-many-devices",
  cohortValidations.unAssignManyDevicesFromCohort,
  createCohortController.unAssignManyDevicesFromCohort
);

router.delete(
  "/:cohort_id/unassign-device/:device_id",
  cohortValidations.unAssignOneDeviceFromCohort,
  createCohortController.unAssignOneDeviceFromCohort
);

router.post(
  "/filterNonPrivateDevices",
  cohortValidations.filterNonPrivateDevices,
  createCohortController.filterOutPrivateDevices
);

router.get(
  "/:cohort_id/generate",
  cohortValidations.getSiteAndDeviceIds,
  pagination(),
  createCohortController.getSiteAndDeviceIds
);

router.post(
  "/networks",
  cohortValidations.createNetwork,
  createCohortController.createNetwork
);

router.put(
  "/networks/:net_id",
  cohortValidations.updateNetwork,
  createCohortController.updateNetwork
);

router.delete(
  "/networks/:net_id",
  cohortValidations.deleteNetwork,
  createCohortController.deleteNetwork
);

router.get(
  "/networks",
  cohortValidations.listNetworks,
  pagination(),
  createCohortController.listNetworks
);

router.get(
  "/networks/:net_id",
  cohortValidations.getNetwork,
  pagination(),
  createCohortController.listNetworks
);

router.get(
  "/verify/:cohort_id",
  cohortValidations.verifyCohort,
  pagination(),
  createCohortController.verify
);
router.post(
  "/from-cohorts",
  cohortValidations.createFromCohorts,
  createCohortController.createFromCohorts
);

router.post(
  "/sites",
  cohortValidations.listSites,
  pagination(),
  createCohortController.listSitesByCohort
);

router.post(
  "/devices",
  cohortValidations.listDevices,
  pagination(),
  createCohortController.listDevicesByCohort
);

router.get(
  "/:cohort_id",
  cohortValidations.getCohort,
  pagination(),
  createCohortController.list
);

module.exports = router;
