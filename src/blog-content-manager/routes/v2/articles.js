const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
// const { setJWTAuth, authJWT } = require("@middleware/passport");
const BlogPostManagementController = require("@controllers/manage-posts");

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
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

router.use(headers);
router.use(validatePagination);

// Authentication middleware
// router.use(setJWTAuth);
// router.use(authJWT);

// Validation middleware
const validateBlogPostUpdate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Blog Post Management Routes
router.get("/edit/:id", BlogPostManagementController.edit);
router.put(
  "/edit/:id",
  validateBlogPostUpdate,
  BlogPostManagementController.update
);
router.delete(
  "/delete/:id",
  validateBlogPostUpdate,
  BlogPostManagementController.delete
);
router.post(
  "/schedule/:id",
  validateBlogPostUpdate,
  BlogPostManagementController.schedule
);
router.get("/history/:id", BlogPostManagementController.history);

module.exports = router;
