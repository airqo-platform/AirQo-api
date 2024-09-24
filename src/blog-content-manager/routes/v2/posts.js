const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const BlogPostController = require("@controllers/create-post");

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
router.use(setJWTAuth);
router.use(authJWT);

// Validation middleware
const validateBlogPost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Blog Post Routes
router.get("/", BlogPostController.list);
router.post("/", validateBlogPost, BlogPostController.create);
router.patch(
  "/:id/draft",
  validateBlogPost,
  BlogPostController.updateDraftStatus
);
router.get("/:id", BlogPostController.retrieve);
router.put("/:id", validateBlogPost, BlogPostController.update);
router.delete("/:id", validateBlogPost, BlogPostController.delete);
router.post(
  "/:id/images",
  express.raw({ type: "multipart/form-data" }),
  BlogPostController.uploadImage
);
router.get("/:id/preview", BlogPostController.preview);

module.exports = router;
