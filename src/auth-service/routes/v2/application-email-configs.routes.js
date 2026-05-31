const express = require("express");
const router = express.Router();
const controller = require("@controllers/application-email-config.controller");
const validators = require("@validators/application-email-config.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { headers } = require("@validators/common");

router.use(headers);

router.get("/", validators.list, enhancedJWTAuth, controller.list);

router.post("/", validators.create, enhancedJWTAuth, controller.create);

router.put("/:id", validators.update, enhancedJWTAuth, controller.update);

router.delete("/:id", validators.delete, enhancedJWTAuth, controller.delete);

module.exports = router;
