// checklist.routes.js
const express = require("express");
const router = express.Router();
const createChecklistController = require("@controllers/checklist.controller");
const checklistValidations = require("@validators/checklist.validators");
const { enhancedJWTAuth } = require("@middleware/passport");

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
router.use(checklistValidations.pagination);

router.post(
  "/upsert",
  checklistValidations.upsert,
  createChecklistController.upsert
);

router.put(
  "/:user_id",
  checklistValidations.update,
  createChecklistController.update
);

router.post("/", checklistValidations.create, createChecklistController.create);

router.get("/", checklistValidations.list, createChecklistController.list);

router.delete(
  "/:user_id",
  checklistValidations.deleteChecklist,
  enhancedJWTAuth,
  createChecklistController.delete
);

router.get(
  "/:user_id",
  checklistValidations.getChecklistByUserId,
  createChecklistController.list
);

module.exports = router;
