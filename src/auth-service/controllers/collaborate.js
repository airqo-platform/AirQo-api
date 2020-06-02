const User = require("../models/User");
const Candidate = require("../models/Candidate");
const Collaborator = require("../models/Collaborator");
const HTTPStatus = require("http-status");
const constants = require("../config/constants");
const privileges = require("../utils/privileges");
const transporter = require("../services/mailer");
const templates = require("../utils/email.templates");
const msgs = require("../utils/email.msgs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const validateRegisterInput = require("../utils/validations.register");
const validateLoginInput = require("../utils/validations.login");
const validateForgotPwdInput = require("../utils/validations.forgot");
const validatePwdUpdateInput = require("../utils/validations.update.pwd");
const validateCandidateInput = require("../utils/validations.candidate");
const register = require("../utils/register");

const collaborate = {
    addCollaborator: async(req, res, next) => {
        const data = {
            privilege: "",
            password: "",
            userName: "",
            firstName: "",
            lastName: "",
            admin: {},
            email: "",
            organization: "",
            org_name: "",
            privilege: "",
        };

        const { errors, isValid } = validateRegisterInput(data);

        if (!isValid) {
            return res
                .status(400)
                .json({ success: false, errors, message: "validation error" });
        }

        User.find(data.admin).exec((err, user) => {
            if (err) {
                return res.json({ success: false, message: "Some Error" });
            }
            if (user.length) {
                /*****
                 * User.save(new user)
                 * On Success: update the current user's collaborator array.
                 */

                return res.json({
                    success: true,
                    message: "User fetched by id successfully",
                    user,
                });
            } else {
                return res.json({
                    success: false,
                    message: "User with the given id not found",
                    user,
                });
            }
        });
        /****
         * get the ID of the user
         * get new user details
         *
         * update that user using the collaborators
         * collaborators.push(newUser);
         *
         * On success:
         * res.status(200).json(newUser);
         *
         * On failure:
         * res.status(500).push(failure message);
         *
         */
    },

    listAll: async(req, res) => {
        /******
         * get the ID of the user (Admin) requesting
         * Afterwards, the collaborators items
         *
         * On success:
         * status(200).json(collaboratorDetails);
         *
         * On failure:
         * status(500).json("failure message");
         */

        res.json({
            success: success,
            message: "This endpoint is currently not in use",
        });
    },
};

module.exports = collaborate;