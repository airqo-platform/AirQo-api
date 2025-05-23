// tips.routes.js
const express = require("express");
const router = express.Router();
const healthTipController = require("@controllers/health-tips.controller");
const tipsValidations = require("@validators/tips.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

router.get(
  "/",
  tipsValidations.listTips,
  pagination(),
  healthTipController.list
);
router.post("/", tipsValidations.createTip, healthTipController.create);
router.put(
  "/bulk",
  tipsValidations.bulkUpdateTips,
  healthTipController.bulkUpdate
);
router.put("/", tipsValidations.updateTip, healthTipController.update);
router.delete("/", tipsValidations.deleteTip, healthTipController.delete);
router.delete("/invalid", healthTipController.removeInvalidTips);

module.exports = router;
