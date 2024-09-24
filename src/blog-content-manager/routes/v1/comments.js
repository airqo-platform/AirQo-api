const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const CommentController = require("@controllers/handle-comments");

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
const validateComment = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Comment Routes
router.post("/:postId/comments", validateComment, CommentController.create);
router.get("/:postId/comments", CommentController.list);
router.get("/:postId/comments/:commentId/replies", CommentController.replies);
router.put(
  "/:postId/comments/:commentId/edit",
  validateComment,
  CommentController.edit
);
router.delete(
  "/:postId/comments/:commentId/delete",
  validateComment,
  CommentController.delete
);
router.patch("/:postId/comments/:commentId/approve", CommentController.approve);
router.patch("/:postId/comments/:commentId/reject", CommentController.reject);

module.exports = router;
