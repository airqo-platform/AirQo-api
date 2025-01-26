// grids.routes.js
const express = require("express");
const router = express.Router();
const createGridController = require("@controllers/grid.controller");
const gridsValidations = require("@validators/grids.validators");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

router.post("/", gridsValidations.createGrid, createGridController.create);

router.get("/", gridsValidations.listGrids, createGridController.list);

router.get(
  "/summary",
  gridsValidations.listGridSummary,
  createGridController.listSummary
);

router.delete(
  "/:grid_id",
  gridsValidations.deleteGrid,
  createGridController.delete
);

router.put(
  "/:grid_id",
  gridsValidations.updateGrid,
  createGridController.update
);

router.put(
  "/refresh/:grid_id",
  gridsValidations.refreshGrid,
  createGridController.refresh
);

router.get(
  "/:grid_id/generate",
  gridsValidations.getSiteAndDeviceIds,
  createGridController.getSiteAndDeviceIds
);

router.get(
  "/:grid_id/assigned-sites",
  gridsValidations.listAssignedSites,
  createGridController.listAssignedSites
);

router.get(
  "/:grid_id/available-sites",
  gridsValidations.listAvailableSites,
  createGridController.listAvailableSites
);

router.post(
  "/upload-shapefile",
  upload.single("shapefile"),
  gridsValidations.createGridFromShapefile,
  createGridController.createGridFromShapefile
);

router.post(
  "/nearby",
  gridsValidations.findGridUsingGPSCoordinates,
  createGridController.findGridUsingGPSCoordinates
);

router.post(
  "/filterNonPrivateSites",
  gridsValidations.filterNonPrivateSites,
  createGridController.filterOutPrivateSites
);

router.post(
  "/levels",
  gridsValidations.createAdminLevel,
  createGridController.createAdminLevel
);

router.get(
  "/levels",
  gridsValidations.listAdminLevels,
  createGridController.listAdminLevels
);

router.put(
  "/levels/:level_id",
  gridsValidations.updateAdminLevel,
  createGridController.updateAdminLevel
);

router.delete(
  "/levels/:level_id",
  gridsValidations.deleteAdminLevel,
  createGridController.deleteAdminLevel
);

router.get(
  "/levels/:level_id",
  gridsValidations.getAdminLevel,
  createGridController.listAdminLevels
);

router.get("/:grid_id", gridsValidations.getGrid, createGridController.list);

module.exports = router;
