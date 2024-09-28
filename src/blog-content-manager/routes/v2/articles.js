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

/**
 * @swagger
 * /api/v2/blogs/articles:
 *   get:
 *     summary: List blog articles (Version 2)
 *     description: Returns a list of blog articles for version 2 of the API
 *     tags:
 *       - Blog
 *     parameters:
 *       - in: query
 *         name: page
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: 'config/components/schemas/BlogArticleV2'
 *
 *   post:
 *     summary: Create a blog article (Version 2)
 *     description: Creates a new blog article for version 2 of the API
 *     tags:
 *       - Blog
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               authorId:
 *                 type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: 'config/components/schemas/BlogArticleV2'
 */
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
