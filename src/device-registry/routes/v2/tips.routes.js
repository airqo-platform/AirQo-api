// tips.routes.js
const express = require("express");
const router = express.Router();
const healthTipController = require("@controllers/health-tips.controller");
const tipsValidations = require("@validators/tips.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

router.get("/", tipsValidations.listTips, healthTipController.list);
router.post("/", tipsValidations.createTip, healthTipController.create);
router.put("/", tipsValidations.updateTip, healthTipController.update);
router.delete("/", tipsValidations.deleteTip, healthTipController.delete);

module.exports = router;
