const User = require("../models/User");
const Candidate = require("../models/Candidate");
const Collaborator = require("../models/Collaborator");
const HTTPStatus = require("http-status");
const constants = require("../config/constants");
const privileges = require("../utils/privileges");
const templates = require("../utils/email.templates");
const msgs = require("../utils/email.msgs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const validateRegisterInput = require("../utils/validations.register");
const validateLoginInput = require("../utils/validations.login");
const validateForgotPwdInput = require("../utils/validations.forgot");
const validatePwdUpdateInput = require("../utils/validations.update.pwd");
const validateCandidateInput = require("../utils/validations.candidate");
const generator = require('generate-password');
const register = require("../utils/register");

const candidate = {
    registerCandidate: (req, res) => {
        //console.log(process.env.ATLAS_URI);
        const { errors, isValid } = validateCandidateInput(req.body);

        if (!isValid) {
            return res.status(400).json(errors);
        }
        console.log("past the error phase...");

        //this is where I register the candidate
        /**
         * send through the
         * 1. mailOptions,
         * 2. body
         * 3. entity
         * 
         */
        const mailOptions = {
            from: `info@airqo.net`,
            to: `${req.body.email}`,
            subject: "AirQo Platform JOIN request",
            text: msgs.joinRequest,
        };

        register(mailOptions, req.body, Candidate);


        // Candidate.findOne({ email: req.body.email }).then((user) => {
        //     console.log("finding one....");
        //     if (user) {
        //         return res.status(400).json({ email: "Email already exists" });
        //     } else {
        //         const {
        //             firstName,
        //             lastName,
        //             email,
        //             jobTitle,
        //             company,
        //             phoneNumber,
        //             country,
        //             desc,
        //         } = req.body;
        //         const user = new Candidate({
        //             firstName: firstName,
        //             lastName: lastName,
        //             email: email,
        //             jobTitle: jobTitle,
        //             company: company,
        //             phoneNumber: phoneNumber,
        //             country: country,
        //             desc: desc,
        //         });
        //         user.save((error, savedData) => {
        //             if (error) {
        //                 return console.log(error);
        //             } else {
        //                 //sending the confirmation email to the user
        //                 const mailOptions = {
        //                     from: `info@airqo.net`,
        //                     to: `${email}`,
        //                     subject: "AirQo Platform JOIN request",
        //                     text: msgs.joinRequest,
        //                 };

        //                 transporter.sendMail(mailOptions, (err, response) => {
        //                     if (err) {
        //                         console.error("there was an error: ", err);
        //                     } else {
        //                         console.log("here is the res: ", response);
        //                         res.status(200).json(savedData);
        //                     }
        //                 });
        //             }
        //         });
        //     }
        // });

    },

    activateCandidate: async(req, res) => {
        /**
         * get the email address of the person
         * hit the registration (User) end point accordingly.
         * as they register, we can generate temporary passwords for them.
         * lets also get to award them with hasAccess: true
         * **/
        try {
            let password = generator.generate({
                length: 10,
                numbers: true,
                uppercase: true,
                lowercase: true
            });

            //call the register function
            const mailOptions = {
                from: `info@airqo.net`,
                to: `${req.body.email}`,
                subject: "Your AirQo Platform Account",
                text: msgs.welcome(req.body.firstName, password),
            };
            let body = req.body;
            body.password = password

            register(mailOptions, body, User);
            // const user = await User.findByIdAndUpdate({ _id: req.params.id }, { hasAccess: true },
            //     (err, result) => {
            //         if (err) {
            //             return res.status(500).json(err);
            //         } else {
            //             return res.status(200).json(result);
            //         }
            //     }
            // );
        } catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },

    deactivateCandidate: (req, res) => {
        try {
            update(identifier, body, entity);
        } catch (e) {

        }
    },

    findCandidate: (req, res, next) => {
        if (req.user.userName === req.query.userName) {
            Candidate.findOne({
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

    findCandidateById: (req, res, next, id) => {
        Candidate.findById(id).exec((err, user) => {
            if (err || !user) {
                return res.status(400).json({
                    error: "No user found with these credentials!",
                });
            }
            req.profile = user;
            next();
        });
    },

    getAllCandidates: async(req, res, next, id) => {
        try {
            const users = await Candidate.find();
            return res
                .status(HTTPStatus.OK)
                .json({ success: true, message: "Users fetched successfully", users });
        } catch (e) {
            return res
                .status(HTTPStatus.BAD_REQUEST)
                .json({ success: false, message: "Some Error" });
        }
    }
};

module.exports = candidate;