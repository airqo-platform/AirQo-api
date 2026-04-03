// sdg.routes.js — Metadata API for SDG Indicator 11.6.2
// Mounted at: /api/v2/devices/sdg/pm-annual
const express = require("express");
const router = express.Router();
const multer = require("multer");
const sdgController = require("@controllers/sdg.controller");
const sdgValidations = require("@validators/sdg.validators");
const { headers, pagination } = require("@validators/common");

// Store file in memory so the buffer is available to the parser
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB cap
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only .csv and .xlsx files are accepted"), false);
    }
  },
});

router.use(headers);

// ---------------------------------------------------------------------------
// City / Grid Metadata
// POST  /api/v2/devices/sdg/pm-annual/cities
// GET   /api/v2/devices/sdg/pm-annual/cities
// GET   /api/v2/devices/sdg/pm-annual/cities/:city_id/sites
// ---------------------------------------------------------------------------

router.post(
  "/cities/upload",
  upload.single("file"),
  sdgValidations.uploadCities,
  sdgController.uploadCities
);

router.post(
  "/cities",
  sdgValidations.createCity,
  sdgController.createCity
);

router.get(
  "/cities",
  sdgValidations.listCities,
  pagination(),
  sdgController.listCities
);

router.get(
  "/cities/:city_id/sites",
  sdgValidations.listCitySites,
  pagination(),
  sdgController.listCitySites
);

// ---------------------------------------------------------------------------
// Population Weight Configuration
// GET   /api/v2/devices/sdg/pm-annual/population-weights
// ---------------------------------------------------------------------------

router.get(
  "/population-weights",
  sdgValidations.listPopulationWeights,
  pagination(),
  sdgController.listPopulationWeights
);

module.exports = router;
