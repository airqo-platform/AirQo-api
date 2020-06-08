const Candidate = require("../models/Candidate");
const HTTPStatus = require("http-status");
const msgs = require("../utils/email.msgs");
const validateCandidateInput = require("../utils/validations.candidate");
const register = require("../utils/register");

const candidate = {
    registerCandidate: (req, res) => {
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
            from: `info@airqo.net`,
            to: `${req.body.email}`,
            subject: "AirQo Platform JOIN request",
            text: msgs.joinRequest,
        };

        register(req, res, mailOptions, req.body, Candidate);
    },

    getAllCandidates: async(req, res) => {
        try {
            const users = await Candidate.find(req.query);
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