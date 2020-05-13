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
/**
 * import table schema
 * import creation of table method
 */

const UserModelBT = require("../models/UserBT");
const createBigTable = require("../utils/createBigTable");
const UserBT = createBigTable(constants.USERS_BT, constants.COLUMN_FAMILY_ID);

const join = {
    /**[START] GCP Cloud BigTable tests */
    createTest: async(req, res) => {
        /**
         * get array of values to insert into the database
         * prep the data for insertion by:
         * mapping over all of these array values to generate the desired object
         */
        const inputs = req.body.data;
        const rowsToInsert = inputs.map((input, index) => ({
            key: `value${index}`,
            data: UserModelBT(input),
        }));
        await UserBT.insert(rowsToInsert);
    },
    deleteTest: (req, res) => {},
    updateTest: (req, res) => {},
    filterTest: (req, res) => {},
    getOneTest: async(req, res) => {
        // const filter = req.body.filter;
        const filter = [{
            column: {
                cellLimit: 1, // Only retrieve the most recent version of the cell.
            },
        }, ];
        const [singleRow] = await UserBT.row("greeting0").get({
            filter,
        });
        res
            .status(200)
            .json({ message: "got one row successfully", success: true, singleRow });
    },

    getAllTest: async(req, res) => {
        // const filter = req.body.filter;
        const filter = [{
            column: {
                cellLimit: 1, // Only retrieve the most recent version of the cell.
            },
        }, ];
        const [allRows] = await UserBT.getRows({
            filter,
        });
        res.status(200).json({
            message: "gotten all rows successfully",
            success: true,
            allRows,
        });
    },
    /**[END] GCP Cloud BigTable tests */
    listAll: async(req, res) => {
        try {
            const users = await User.find();
            return res.status(HTTPStatus.OK).json(users);
        } catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },

    listOne: async(req, res) => {
        try {
            const user = await User.findById(req.params.id);
            return res.status(HTTPStatus.OK).json(user);
        } catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },
    activateUser: async(req, res) => {
        try {
            const user = await User.findByIdAndUpdate({ _id: req.params.id }, { hasAccess: true },
                (err, result) => {
                    if (err) {
                        return res.status(500).json(err);
                    } else {
                        return res.status(200).json(result);
                    }
                }
            );
        } catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },
    deactivateUser: async(req, res) => {
        try {
            const user = await User.findByIdAndUpdate({ _id: req.params.id }, { hasAccess: false },
                (err, result) => {
                    if (err) {
                        return res.status(500).json(err);
                    } else {
                        return res.status(200).json(result);
                    }
                }
            );
        } catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },

    findUser: (req, res, next) => {
        if (req.user.userName === req.query.userName) {
            User.findOne({
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
    findUserById: (req, res, next, id) => {
        User.findById(id).exec((err, user) => {
            if (err || !user) {
                return res.status(400).json({
                    error: "No user found with these credentials!",
                });
            }
            req.profile = user;
            next();
        });
    },

    forgotPassword: (req, res) => {
        console.log("the email who forgot is  " + req.body.email);

        // const { errors, isValid } = validateForgotPwdInput(req.params.email);
        // if (!isValid) {
        //   return res.status(400).json(errors);
        // }
        console.log("reaching forgotPassword");
        console.log("the email is here:" + req.body.email);

        const token = crypto.randomBytes(20).toString("hex");

        let query = { email: req.body.email };
        let updateDetails = {
            resetPasswordToken: token,
            resetPasswordExpires: Date.now() + 3600000,
        };
        User.findOneAndUpdate(query, updateDetails, (error, response) => {
            if (error) {
                return res.status(HTTPStatus.BAD_GATEWAY).json(error);
            } else if (response) {
                const mailOptions = {
                    from: `info@airqo.net`,
                    to: `${req.body.email}`,
                    subject: `Link To Reset Password`,
                    text: `${msgs.recovery_email(token)}`,
                };
                //we shall review other third party libraries for making emails....^^

                console.log("sending mail");

                //deliver the message object using sendMail
                transporter.sendMail(mailOptions, (err, response) => {
                    if (err) {
                        console.error("there was an error: ", err);
                        return res.status(500).json(err);
                    } else {
                        console.log("here is the res: ", response);
                        return res.status(200).json({ msg: "recovery email sent" });
                    }
                });
                //return res.status(HTTPStatus.OK).json(response);
            } else {
                return res.status(HTTPStatus.BAD_REQUEST);
            }
        });
    },

    registerUser: (req, res) => {
        console.log(process.env.ATLAS_URI);

        const { errors, isValid } = validateRegisterInput(req.body);

        if (!isValid) {
            return res.status(400).json(errors);
        }

        User.findOne({ email: req.body.email }).then((user) => {
            if (user) {
                return res.status(400).json({ email: "Email already exists" });
            } else {
                const user = new User({
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    email: req.body.email,
                    userName: req.body.userName,
                    password: req.body.password,
                });
                user.save((error, savedData) => {
                    if (error) {
                        return console.log(error);
                    } else {
                        //sending the confirmation email to the user
                        const mailOptions = {
                            from: `info@airqo.net`,
                            to: `${user.email}`,
                            subject: "Welcome to AirQo",
                            text: msgs.welcome,
                        };

                        transporter.sendMail(mailOptions, (err, response) => {
                            if (err) {
                                console.error("there was an error: ", err);
                            } else {
                                console.log("here is the res: ", response);
                                res.status(200).json(savedData);
                            }
                        });
                    }
                });
            }
        });
    },

    registerCandidate: (req, res) => {
        //console.log(process.env.ATLAS_URI);
        const { errors, isValid } = validateCandidateInput(req.body);

        if (!isValid) {
            return res.status(400).json(errors);
        }
        console.log("past the error phase...");
        Candidate.findOne({ email: req.body.email }).then((user) => {
            console.log("finding one....");
            if (user) {
                return res.status(400).json({ email: "Email already exists" });
            } else {
                const {
                    firstName,
                    lastName,
                    email,
                    jobTitle,
                    company,
                    phoneNumber,
                    country,
                    desc,
                } = req.body;
                const user = new Candidate({
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    jobTitle: jobTitle,
                    company: company,
                    phoneNumber: phoneNumber,
                    country: country,
                    desc: desc,
                });
                user.save((error, savedData) => {
                    if (error) {
                        return console.log(error);
                    } else {
                        //sending the confirmation email to the user
                        const mailOptions = {
                            from: `info@airqo.net`,
                            to: `${email}`,
                            subject: "AirQo Platform JOIN request",
                            text: msgs.joinRequest,
                        };

                        transporter.sendMail(mailOptions, (err, response) => {
                            if (err) {
                                console.error("there was an error: ", err);
                            } else {
                                console.log("here is the res: ", response);
                                res.status(200).json(savedData);
                            }
                        });
                    }
                });
            }
        });
    },

    //invoked when the user visits the confirmation url on the client
    confirmEmail: async(req, res) => {
        const { id } = req.params;
        User.findById(id)
            .then((user) => {
                //when the user does not exist in the DB
                if (!user) {
                    res.json({ msg: msgs.couldNotFind });
                }
                // The user exists but has not been confirmed. So we confirm them...
                else if (user && !user.emailConfirmed) {
                    User.findByIdAndUpdate(id, { confirmed: true })
                        .then(() => res.json({ msg: msgs.confirmed }))
                        .catch((err) => console.log(err));
                }
                //when the user has already confirmed their email address
                else {
                    res.json({ msg: msgs.alreadyConfirmed });
                }
            })
            .catch((err) => console.log(err));
    },

    loginUser: (req, res, next) => {
        console.log("we have reached loginUser....");
        const { errors, isValid } = validateLoginInput(req.body);

        if (!isValid) {
            return res.status(400).json(errors);
        }

        res.status(200).json(req.user.toAuthJSON());
        return next();
    },

    loginCollaborator: (req, res, next) => {
        res.status(200).json(req.colab.toAuthJSON());
        return next();
    },

    deleteUser: (req, res, next) => {
        let query = { _id: req.params.id };
        User.findOneAndDelete(query, (error, response) => {
            if (error) {
                return res
                    .status(400)
                    .json({ error: errorHandler.getErrorMessage(err) });
            } else {
                res.status(200).send("user deleted");
            }
        });
    },

    updateUser: (req, res, next) => {
        let query = { _id: req.params.id };
        let updateDetails = req.body;
        User.findOneAndUpdate(query, updateDetails, (error, response) => {
            if (error) {
                return res.status(HTTPStatus.BAD_GATEWAY).json(e);
            } else if (response) {
                return res.status(HTTPStatus.OK).json(response);
            } else {
                return res.status(HTTPStatus.BAD_REQUEST);
            }
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

    logout: async(req, res) => {
        try {
            await req.logout();
            req.session = null;
            return res.status(HTTPStatus.OK).send("successfully logged out");
        } catch (e) {
            return res.status(HTTPStatus.BAD_GATEWAY).json(e);
        }
    },
    resetPassword: (req, res, next) => {
        console.log("inside the reset password function...");
        console.log(`${req.params.resetPasswordToken}`);
        User.findOne({
            resetPasswordToken: req.params.resetPasswordToken,
            resetPasswordExpires: {
                $gt: Date.now(),
            },
        }).then((user) => {
            console.log("this is the user " + ` ${user}`);
            if (user == null) {
                res.status(403).send("password reset link is invalid or has expired");
            } else {
                res.status(200).send({
                    userName: user.userName,
                    message: "passworkd reset link a-ok",
                });
            }
        });
    },

    updatePasswordViaEmail: (req, res, next) => {
        const { errors, isValid } = validatePwdUpdateInput(req.body);
        if (!isValid) {
            return res.status(400).json(errors);
        }

        const { userName, password } = req.body;

        User.findOne({
            userName: userName,
            resetPasswordToken: req.body.resetPasswordToken,
            resetPasswordExpires: {
                $gt: Date.now(),
            },
        }).then((user) => {
            if (user == null) {
                console.log("password reset link is invalid or has expired");
                res
                    .status(403)
                    .json({ msg: "password reset link is invalid or has expired" });
            } else if (user != null) {
                user.update({
                    password: password,
                    resetPasswordToken: null,
                    resetPasswordExpires: null,
                });
                console.log("password updated");
                res.status(200).json({ msg: "password updated" });
            } else {
                console.log("no user exists in db to update");
                res.status(401).json({ msg: "no user exists in db to update" });
            }
        });
    },
};

module.exports = join;