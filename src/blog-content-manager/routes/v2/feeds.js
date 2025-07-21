const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
// const { setJWTAuth, authJWT } = require("@middleware/passport");
const RSSFeedController = require("@controllers/generate-feed");

// Middleware
const validateCustomization = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
};

router.use(headers);

// Authentication middleware
// router.use(setJWTAuth);
// router.use(authJWT);

// RSS Feed Routes
router.get(
  "/:blogId/rss",
  validateCustomization,
  RSSFeedController.generateFeed
);

module.exports = router;
