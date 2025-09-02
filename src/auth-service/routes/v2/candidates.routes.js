// candidates.routes.js
const express = require("express");
const router = express.Router();
const createCandidateController = require("@controllers/candidate.controller");
const candidateValidations = require("@validators/candidates.validators");
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
router.use(candidateValidations.pagination);

router.post(
  "/register",
  candidateValidations.create,
  createCandidateController.create
);

router.get(
  "/",
  candidateValidations.list,
  enhancedJWTAuth,
  createCandidateController.list
);

router.post(
  "/confirm",
  candidateValidations.confirm,
  enhancedJWTAuth,
  createCandidateController.confirm
);

router.delete(
  "/",
  candidateValidations.deleteCandidate,
  enhancedJWTAuth,
  createCandidateController.delete
);

router.put(
  "/",
  candidateValidations.update,
  enhancedJWTAuth,
  createCandidateController.update
);

module.exports = router;
