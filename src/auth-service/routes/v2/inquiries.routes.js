// inquiries.routes.js
const express = require("express");
const router = express.Router();
const createInquiryController = require("@controllers/inquiry.controller");
const inquiryValidations = require("@validators/inquiries.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

router.post(
  "/register",
  inquiryValidations.create,
  createInquiryController.create
);

router.get(
  "/",
  inquiryValidations.list,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
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
