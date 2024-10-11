const express = require("express");
const router = express.Router();

router.use("/analytics", require("@routes/v2/analytics"));
router.use("/articles", require("@routes/v2/articles"));
router.use("/categories", require("@routes/v2/categories"));
router.use("/comments", require("@routes/v2/comments"));
router.use("/feeds", require("@routes/v2/feeds"));
router.use("/interactions", require("@routes/v2/interactions"));
router.use("/moderation", require("@routes/v2/moderation"));
router.use("/posts", require("@routes/v2/posts"));
router.use("/search", require("@routes/v2/search"));

module.exports = router;
