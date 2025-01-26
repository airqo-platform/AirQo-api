const express = require("express");
const router = express.Router();
const eventController = require("@controllers/event.controller");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logObject, logText } = require("@utils/shared");
const { validateNetwork, validateAdminLevels } = require("@validators/common");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

/******************* create-events use-case *******************************/

router.get("/map", eventController.signalsForMap);

module.exports = router;
