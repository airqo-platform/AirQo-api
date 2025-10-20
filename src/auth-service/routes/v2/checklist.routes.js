// checklist.routes.js
const express = require("express");
const router = express.Router();
const createChecklistController = require("@controllers/checklist.controller");
const checklistValidations = require("@validators/checklist.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(checklistValidations.pagination);

router.post(
  "/upsert",
  enhancedJWTAuth,
  checklistValidations.upsert,
  createChecklistController.upsert
);

router.put(
  "/:user_id",
  enhancedJWTAuth,
  checklistValidations.update,
  createChecklistController.update
);

router.post(
  "/",
  enhancedJWTAuth,
  checklistValidations.create,
  createChecklistController.create
);

router.get(
  "/",
  enhancedJWTAuth,
  checklistValidations.list,
  createChecklistController.list
);

router.delete(
  "/:user_id",
  enhancedJWTAuth,
  checklistValidations.deleteChecklist,
  createChecklistController.delete
);

router.get(
  "/:user_id",
  enhancedJWTAuth,
  checklistValidations.getChecklistByUserId,
  createChecklistController.list
);

module.exports = router;
