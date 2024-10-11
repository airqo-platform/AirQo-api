const express = require("express");
const router = express.Router();

router.use("/analytics", require("@routes/v1/analytics"));
router.use("/articles", require("@routes/v1/articles"));
router.use("/categories", require("@routes/v1/categories"));
router.use("/comments", require("@routes/v1/comments"));
router.use("/feeds", require("@routes/v1/feeds"));
router.use("/interactions", require("@routes/v1/interactions"));
router.use("/moderation", require("@routes/v1/moderation"));
router.use("/posts", require("@routes/v1/posts"));
router.use("/search", require("@routes/v1/search"));

module.exports = router;
