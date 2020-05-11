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

const collaborate = {

    listAll: async(req, res) => {
        try {
            const users = await Collaborator.find();
            return res
                .status(HTTPStatus.OK)
                .json({ success: true, message: "Users fetched successfully", users });
        } catch (e) {
            return res
                .status(HTTPStatus.BAD_REQUEST)
                .json({ success: false, message: "Some Error" });
        }
    },

    findCollaborator: (req, res, next) => {
        if (req.user.userName === req.query.userName) {
            Collaborator.findOne({
                userName: req.query.userName,
            }).then((userInfo) => {
                if (userInfo != null) {
                    console.log("user found in db from findUsers");
                    res.status(200).json(userInfo);
                } else {
                    console.error("no user exists in db with that username");
                    res.status(401).send("no user exists in db with that username");
                }
            });
        } else {
            console.error("jwt id and username do not match");
            res.status(403).send("username and jwt token do not match");
        }
    },

    findCollaboratorById: (req, res, next, id) => {
        Collaborator.findById(id).exec((err, user) => {
            if (err || !user) {
                return res.status(400).json({
                    error: "No user found with these credentials!",
                });
            }
            req.profile = user;
            next();
        });
    },

    updateCollaborator: (req, res, next) => {
        let query = { _id: req.params.id };
        let updateDetails = req.body;
        Collaborator.findOneAndUpdate(query, updateDetails, (error, response) => {
            if (error) {
                return res.status(HTTPStatus.BAD_GATEWAY).json(e);
            } else if (response) {
                return res.status(HTTPStatus.OK).json(response);
            } else {
                return res.status(HTTPStatus.BAD_REQUEST);
            }
        });
    },

    addCollaborator: async(req, res, next) => {
        try {
            //get the ID of the one requesting:
            let id = req.params.id;
            let colab = new Collaborator(req.body);
            await colab.save((error, savedData) => {
                if (error) {
                    return res.status(500).json(error);
                } else {
                    return res.status(201).json(savedData);
                }
            });
        } catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },

    deleteCollaborator: (req, res, next) => {
        try {
            let query = { _id: req.params.id };
            Collaborator.findOneAndDelete(query, (error, response) => {
                if (error) {
                    return res
                        .status(400)
                        .json({ error: errorHandler.getErrorMessage(err) });
                } else {
                    res.status(200).send("user deleted");
                }
            });
        } catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },
};

module.exports = collaborate;