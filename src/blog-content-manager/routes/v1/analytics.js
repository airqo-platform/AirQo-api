const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const AnalyticsReportingController = require("@controllers/generate-reports");

// Middleware
const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST");
  next();
};

router.use(headers);
router.use(validatePagination);

// Authentication middleware
router.use(setJWTAuth);
router.use(authJWT);

// Validation middleware
const validateAnalyticsReport = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Post Analytics Routes
router.get(
  "/posts/:postId/views",
  validateAnalyticsReport,
  AnalyticsReportingController.views
);
router.get(
  "/posts/:postId/comments",
  validateAnalyticsReport,
  AnalyticsReportingController.comments
);
router.get(
  "/posts/popular",
  validateAnalyticsReport,
  AnalyticsReportingController.popularPosts
);

// User Analytics Routes
router.get(
  "/users/:userId/views",
  validateAnalyticsReport,
  AnalyticsReportingController.userViews
);
router.get(
  "/users/:userId/comments",
  validateAnalyticsReport,
  AnalyticsReportingController.userComments
);
router.get(
  "/users/:userId/activity",
  validateAnalyticsReport,
  AnalyticsReportingController.userActivity
);

// Admin Reporting Routes
router.post(
  "/reports/user-growth",
  validateAnalyticsReport,
  AnalyticsReportingController.userGrowthReport
);
router.post(
  "/reports/post-performance",
  validateAnalyticsReport,
  AnalyticsReportingController.postPerformanceReport
);

module.exports = router;
