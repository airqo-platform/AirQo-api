// inquiries.routes.js
const express = require("express");
const router = express.Router();
const createInquiryController = require("@controllers/inquiry.controller");
const inquiryValidations = require("@validators/inquiries.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
router.use(inquiryValidations.pagination);

router.post(
  "/register",
  inquiryValidations.create,
  createInquiryController.create
);

router.get(
  "/",
  inquiryValidations.list,
  setJWTAuth,
  authJWT,
  createInquiryController.list
);

router.delete(
  "/",
  inquiryValidations.deleteInquiry,
  setJWTAuth,
  authJWT,
  createInquiryController.delete
);

router.put(
  "/",
  inquiryValidations.update,
  setJWTAuth,
  authJWT,
  createInquiryController.update
);

module.exports = router;
