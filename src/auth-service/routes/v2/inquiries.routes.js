// inquiries.routes.js
const express = require("express");
const router = express.Router();
const createInquiryController = require("@controllers/inquiry.controller");
const inquiryValidations = require("@validators/inquiries.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(inquiryValidations.pagination);

router.post(
  "/register",
  inquiryValidations.create,
  createInquiryController.create
);

router.get(
  "/",
  inquiryValidations.list,
  enhancedJWTAuth,
  createInquiryController.list
);

router.delete(
  "/",
  inquiryValidations.deleteInquiry,
  enhancedJWTAuth,
  createInquiryController.delete
);

router.put(
  "/",
  inquiryValidations.update,
  enhancedJWTAuth,
  createInquiryController.update
);

module.exports = router;
