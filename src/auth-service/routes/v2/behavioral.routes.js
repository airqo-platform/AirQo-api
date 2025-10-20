const express = require("express");
const router = express.Router();
const behavioralController = require("@controllers/behavioral.controller");
const { enhancedJWTAuth } = require("@middleware/passport");
const behavioralValidator = require("@validators/behavioral.validators");

const headers = (req, res, next) => {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

router.use(headers);

// Alert Response Management
router.post(
  "/alert-responses",
  enhancedJWTAuth,
  behavioralValidator.validateSubmitResponse,
  behavioralController.submitAlertResponse
);
router.get(
  "/alert-responses",
  enhancedJWTAuth,
  behavioralValidator.validateGetUserAlertResponses,
  behavioralController.getUserAlertResponses
);
router.get(
  "/alert-responses/stats",
  enhancedJWTAuth,
  behavioralController.getAlertResponseStats
);

module.exports = router;
