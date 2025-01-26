// airqlouds.routes.js
const express = require("express");
const router = express.Router();
const airqloudController = require("@controllers/airqloud.controller");
const airqloudValidations = require("@validators/airqlouds.validators");

const headers = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

router.use(headers);
router.use(airqloudValidations.pagination()); // Apply pagination middleware

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

router.get("/", airqloudValidations.listAirqlouds, airqloudController.list);

router.get(
  "/summary",
  airqloudValidations.listAirqloudsSummary,
  airqloudController.listSummary
);

router.get(
  "/dashboard",
  airqloudValidations.listAirqloudsDashboard,
  airqloudController.listDashboard
);

router.get(
  "/sites",
  airqloudValidations.getAirqloudSites,
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
  airqloudController.calculateGeographicalCenter
);

router.get(
  "/combined/:net_id/summary",
  airqloudValidations.listCombinedAirqloudsSummary,
  airqloudController.listCohortsAndGridsSummary
);

router.get(
  "/groups/:group_id/summary",
  airqloudValidations.listGroupAirqloudsSummary,
  airqloudController.listCohortsAndGridsSummary
);

router.get(
  "/combined/:net_id",
  airqloudValidations.listCombinedAirqlouds,
  airqloudController.listCohortsAndGrids
);

router.get(
  "/groups/:group_id",
  airqloudValidations.listGroupAirqlouds,
  airqloudController.listCohortsAndGrids
);

module.exports = router;
