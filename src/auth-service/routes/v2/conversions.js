const express = require("express");
const router = express.Router();
const convertFileController = require("@controllers/convert-file");
const { check, oneOf, query, body, param } = require("express-validator");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = isNaN(limit) || limit < 1 ? 1000 : limit;
  req.query.skip = isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

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
router.use(validatePagination);

const validatePdfUpload = [
  upload.single("pdf"),
  check("pdf").custom((value, { req }) => {
    if (!req.file) {
      throw new Error("No file uploaded.");
    }
    if (req.file.mimetype !== "application/pdf") {
      throw new Error("Please only submit pdf documents.");
    }
    return true;
  }),
];

router.post(
  "/convert-pdf-to-docx",
  validatePdfUpload,
  convertFileController.convertPdfToDocx
);

module.exports = router;
