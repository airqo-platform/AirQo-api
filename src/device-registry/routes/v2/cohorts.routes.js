// cohorts.routes.js
const express = require("express");
const router = express.Router();
const createCohortController = require("@controllers/cohort.controller");
const cohortValidations = require("@validators/cohorts.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

router.delete(
  "/:cohort_id",
  cohortValidations.deleteCohort,
  createCohortController.delete
);

router.put(
  "/:cohort_id",
  cohortValidations.updateCohort,
  createCohortController.update
);

router.post("/", cohortValidations.createCohort, createCohortController.create);

router.get("/", cohortValidations.listCohorts, createCohortController.list);

router.get(
  "/summary",
  cohortValidations.listCohortsSummary,
  createCohortController.listSummary
);

router.get(
  "/dashboard",
  cohortValidations.listCohortsDashboard,
  createCohortController.listDashboard
);

router.put(
  "/:cohort_id/assign-device/:device_id",
  cohortValidations.assignOneDeviceToCohort,
  createCohortController.assignOneDeviceToCohort
);

router.get(
  "/:cohort_id/assigned-devices",
  cohortValidations.listAssignedDevices,
  createCohortController.listAssignedDevices
);

router.get(
  "/:cohort_id/available-devices",
  cohortValidations.listAvailableDevices,
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
  createCohortController.listNetworks
);

router.get(
  "/networks/:net_id",
  cohortValidations.getNetwork,
  createCohortController.listNetworks
);

router.get(
  "/verify/:cohort_id",
  cohortValidations.verifyCohort,
  createCohortController.verify
);

router.get(
  "/:cohort_id",
  cohortValidations.getCohort,
  createCohortController.list
);

module.exports = router;
