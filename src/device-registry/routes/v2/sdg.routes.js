// sdg.routes.js — Metadata API for SDG Indicator 11.6.2
// Mounted at: /api/v2/devices/sdg/pm-annual
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
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
      "text/plain",
      "application/csv",
      "text/comma-separated-values",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new HttpError(
          "Only .csv and .xlsx files are accepted",
          httpStatus.BAD_REQUEST,
          { message: `Unsupported MIME type: ${file.mimetype}` }
        ),
        false
      );
    }
  },
});

// Wrap multer so LIMIT_FILE_SIZE and type-rejection become proper 4xx responses
const uploadSingle = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const status =
        err.code === "LIMIT_FILE_SIZE" ? 413 : httpStatus.BAD_REQUEST;
      return next(new HttpError(err.message, status, { message: err.message }));
    }
    // HttpError from fileFilter or any other error
    return next(
      err instanceof HttpError
        ? err
        : new HttpError(err.message, httpStatus.BAD_REQUEST, {
            message: err.message,
          })
    );
  });
};

router.use(headers);

// ---------------------------------------------------------------------------
// City / Grid Metadata
// POST  /api/v2/devices/sdg/pm-annual/cities
// GET   /api/v2/devices/sdg/pm-annual/cities
// GET   /api/v2/devices/sdg/pm-annual/cities/:city_id/sites
// ---------------------------------------------------------------------------

router.post(
  "/cities/upload",
  uploadSingle,
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
  pagination(100, 1000),
  sdgController.listCities
);

router.get(
  "/cities/:city_id/sites",
  sdgValidations.listCitySites,
  pagination(100, 1000),
  sdgController.listCitySites
);

// ---------------------------------------------------------------------------
// Population Weight Configuration
// GET   /api/v2/devices/sdg/pm-annual/population-weights
// ---------------------------------------------------------------------------

router.get(
  "/population-weights",
  sdgValidations.listPopulationWeights,
  pagination(100, 1000),
  sdgController.listPopulationWeights
);

module.exports = router;
