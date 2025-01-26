// tips.routes.js
const express = require("express");
const router = express.Router();
const healthTipController = require("@controllers/health-tips.controller");
const tipsValidations = require("@validators/tips.validators");

const headers = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

router.use(headers);
router.use(tipsValidations.pagination()); // Apply pagination middleware

router.get("/", tipsValidations.listTips, healthTipController.list);
router.post("/", tipsValidations.createTip, healthTipController.create);
router.put("/", tipsValidations.updateTip, healthTipController.update);
router.delete("/", tipsValidations.deleteTip, healthTipController.delete);

module.exports = router;
