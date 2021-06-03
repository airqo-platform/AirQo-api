const CandidateSchema = require("../models/Candidate");
const UserSchema = require("../models/User");
const HTTPStatus = require("http-status");
const msgs = require("../utils/email.msgs");
const validateCandidateInput = require("../utils/validations.candidate");
const register = require("../utils/register");
const { getModelByTenant } = require("../utils/multitenancy");
const constants = require("../config/constants");
const validateRegisterInput = require("../utils/validations.register");
const generator = require("generate-password");

const CandidateModel = (tenant) => {
  return getModelByTenant(tenant, "candidate", CandidateSchema);
};

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const { tryCatchErrors, missingQueryParams } = require("../utils/errors");

const candidate = {
  registerCandidate: (req, res) => {
    const { tenant } = req.query;
    const { errors, isValid } = validateCandidateInput(req.body);
    if (!isValid) {
      return res
        .status(400)
        .json({ success: false, errors, message: "validation error" });
    }

    const mailOptions = {
      from: constants.EMAIL,
      to: `${req.body.email}`,
      subject: "AirQo Platform JOIN request",
      text: msgs.joinRequest,
    };

    register(
      req,
      res,
      mailOptions,
      req.body,
      CandidateModel(tenant.toLowerCase())
    );
  },

  getAllCandidates: async (req, res) => {
    try {
      const { tenant } = req.query;
      const users = await CandidateModel(tenant.toLowerCase()).find();
      return res.status(HTTPStatus.OK).json({
        success: true,
        message: "Candidates fetched successfully",
        users,
      });
    } catch (e) {
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ success: false, message: "Some Error" });
    }
  },
  confirmCandidate: (req, res) => {
    console.log("inside the confirm candidate");
    try {
      const { errors, isValid } = validateRegisterInput(req.body);
      if (!isValid) {
        return res
          .status(HTTPStatus.BAD_REQUEST)
          .json({ success: false, errors, message: "validation error" });
      }

      const { tenant } = req.query;
      if (!tenant) {
        missingQueryParams(req, res);
      }
      const { firstName, lastName, email } = req.body;

      let password = generator.generate({
        length: 10,
        numbers: true,
        uppercase: true,
        lowercase: true,
      });

      let mailOptions = {};
      if (tenant.toLowerCase() == "kcca") {
        mailOptions = {
          from: constants.EMAIL,
          to: `${req.body.email}`,
          subject: "Welcome to the AirQo KCCA Platform",
          text: `${msgs.welcome_kcca(firstName, lastName, password, email)}`,
        };
      } else {
        mailOptions = {
          from: constants.EMAIL,
          to: `${req.body.email}`,
          subject: "Welcome to the AirQo Platform",
          text: `${msgs.welcome_general(firstName, lastName, password, email)}`,
        };
      }
      register(
        req,
        res,
        mailOptions,
        req.body,
        UserModel(tenant.toLowerCase()),
        tenant
      );
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "unable to register user",
        error: e.message,
      });
    }
  },
};

module.exports = candidate;
