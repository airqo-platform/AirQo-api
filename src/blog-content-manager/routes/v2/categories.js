const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
// const { setJWTAuth, authJWT } = require("@middleware/passport");
const CategoryTagController = require("@controllers/manage-categories");

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
const validateCategoryTag = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Category and Tag Routes
router.post("/", validateCategoryTag, CategoryTagController.create);
router.get("/", CategoryTagController.list);
router.put("/:id", validateCategoryTag, CategoryTagController.update);
router.delete("/:id", validateCategoryTag, CategoryTagController.delete);

// Blog Post Association
router.post(
  "/assign/:postId",
  validateCategoryTag,
  CategoryTagController.assign
);
router.get("/posts/:id", CategoryTagController.posts);

// Browsing Routes
router.get("/browse/categories", CategoryTagController.browseCategories);
router.get("/browse/tags", CategoryTagController.browseTags);

module.exports = router;
