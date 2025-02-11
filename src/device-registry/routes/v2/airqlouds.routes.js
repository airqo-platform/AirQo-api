// airqlouds.routes.js
const express = require("express");
const router = express.Router();
const airqloudController = require("@controllers/airqloud.controller");
const airqloudValidations = require("@validators/airqlouds.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

router.post(
  "/",
  airqloudValidations.createAirqloud,
  airqloudController.register
);

router.put(
  "/refresh",
  airqloudValidations.refreshAirqloud,
  airqloudController.refresh
);

router.get(
  "/",
  airqloudValidations.listAirqlouds,
  pagination(),
  airqloudController.list
);

router.get(
  "/summary",
  airqloudValidations.listAirqloudsSummary,
  pagination(),
  airqloudController.listSummary
);

router.get(
  "/dashboard",
  airqloudValidations.listAirqloudsDashboard,
  pagination(),
  airqloudController.listDashboard
);

router.get(
  "/sites",
  airqloudValidations.getAirqloudSites,
  pagination(),
  airqloudController.findSites
);

router.put("/", airqloudValidations.updateAirqloud, airqloudController.update);

router.delete(
  "/",
  airqloudValidations.deleteAirqloud,
  airqloudController.delete
);

router.get(
  "/center",
  airqloudValidations.getAirqloudCenter,
  pagination(),
  airqloudController.calculateGeographicalCenter
);

router.get(
  "/combined/:net_id/summary",
  airqloudValidations.listCombinedAirqloudsSummary,
  pagination(),
  airqloudController.listCohortsAndGridsSummary
);

router.get(
  "/groups/:group_id/summary",
  airqloudValidations.listGroupAirqloudsSummary,
  pagination(),
  airqloudController.listCohortsAndGridsSummary
);

router.get(
  "/combined/:net_id",
  airqloudValidations.listCombinedAirqlouds,
  pagination(),
  airqloudController.listCohortsAndGrids
);

router.get(
  "/groups/:group_id",
  airqloudValidations.listGroupAirqlouds,
  pagination(),
  airqloudController.listCohortsAndGrids
);

module.exports = router;
