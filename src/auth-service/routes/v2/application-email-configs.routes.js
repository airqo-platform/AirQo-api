const express = require("express");
const router = express.Router();
const controller = require("@controllers/application-email-config.controller");
const validators = require("@validators/application-email-config.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { requirePermissions } = require("@middleware/permissionAuth");
const constants = require("@config/constants");
const { headers } = require("@validators/common");

router.use(headers);

const requireSuperAdmin = requirePermissions([constants.SUPER_ADMIN]);

router.get("/", validators.list, enhancedJWTAuth, requireSuperAdmin, controller.list);

router.post("/", validators.create, enhancedJWTAuth, requireSuperAdmin, controller.create);

router.put("/:id", validators.update, enhancedJWTAuth, requireSuperAdmin, controller.update);

router.delete("/:id", validators.delete, enhancedJWTAuth, requireSuperAdmin, controller.delete);

module.exports = router;
