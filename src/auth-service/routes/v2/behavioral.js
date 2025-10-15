const express = require("express");
const router = express.Router();
const behavioralController = require("@controllers/behavioral");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const behavioralValidator = require("@validators/behavioral");

const headers = (req, res, next) => {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

router.use(headers);
router.use(setJWTAuth);
router.use(authJWT);

// Alert Response Management
router.post(
  "/alert-responses",
  behavioralValidator.validateSubmitResponse,
  behavioralController.submitAlertResponse
);
router.get(
  "/alert-responses",
  behavioralValidator.validateGetUserAlertResponses,
  behavioralController.getUserAlertResponses
);
router.get(
  "/alert-responses/stats",
  behavioralController.getAlertResponseStats
);

module.exports = router;
