const CandidateSchema = require("../models/Candidate");
const HTTPStatus = require("http-status");
const msgs = require("../utils/email.msgs");
const validateCandidateInput = require("../utils/validations.candidate");
const register = require("../utils/register");
const { getModelByTenant } = require("../utils/multitenancy");
const constants = require("../config/constants");

const CandidateModel = (tenant) => {
  return getModelByTenant(tenant, "candidate", CandidateSchema);
};

const candidate = {
  registerCandidate: (req, res) => {
    const { tenant } = req.query;
    console.log("yay!");
    console.log("the elements we need:");
    console.dir(req.body);
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

    register(req, res, mailOptions, req.body, CandidateModel(tenant));
  },

  getAllCandidates: async (req, res) => {
    try {
      const { tenant } = req.query;
      const users = await CandidateModel(tenant).find();
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
};

module.exports = candidate;
