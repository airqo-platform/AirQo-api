const User = require("../models/User");
const Location = require("../models/Location");
const Defaults = require("../models/Defaults");
const HTTPStatus = require("http-status");
const constants = require("../config/constants");
const privileges = require("../utils/privileges");
const transporter = require("../services/mailer");
const templates = require("../utils/email.templates");
const msgs = require("../utils/email.msgs");
const crypto = require("crypto");
const validateRegisterInput = require("../utils/validations.register");
const validateLoginInput = require("../utils/validations.login");
const validateForgotPwdInput = require("../utils/validations.forgot");
const validatePwdUpdateInput = require("../utils/validations.update.pwd");
const validatePasswordUpdate = require("../utils/validations.update.pwd.in");
const register = require("../utils/register");
var generatorPassword = require("generate-password");

const join = {
    listAll: async(req, res) => {
        try {
            const users = await User.find(req.query);
            return res.status(HTTPStatus.OK).json({
                success: true,
                message: "Users fetched successfully",
                users,
            });
        } catch (e) {
            return res
                .status(HTTPStatus.BAD_REQUEST)
                .json({ success: false, message: "Some Error" });
        }
    },

    listOne: async(req, res) => {
        User.find({ _id: req.params.id }).exec((err, user) => {
            if (err) {
                return res.json({ success: false, message: "Some Error" });
            }
            if (user.length) {
                return res.json({
                    success: true,
                    message: "User fetched by id successfully",
                    user,
                });
            } else {
                return res.json({
                    success: false,
                    message: "User with the given id not found",
                });
            }
        });
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

        const { errors, isValid } = validateForgotPwdInput(req.body.email);
        if (!isValid) {
            return res.status(400).json(errors);
        }
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
                return res.status(400).json({ email: "Email does not exist" });
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
                        return res.status(500).json({ email: "unable to send email" });
                    } else {
                        console.log("here is the res: ", response);
                        return res.status(200).json({ email: "recovery email sent" });
                    }
                });
                //return res.status(HTTPStatus.OK).json(response);
            } else {
                return res.status(400).json({ email: "unable to send email" });
            }
        });
    },

    registerUser: (req, res) => {
        console.log("the elements we need:");
        console.dir(req.body);

        const { errors, isValid } = validateRegisterInput(req.body);

        if (!isValid) {
            return res
                .status(400)
                .json({ success: false, errors, message: "validation error" });
        }
        /**** generate the password */
        var password = generatorPassword.generate({
            length: 6,
            numbers: true,
            uppercase: true,
            lowercase: true,
        });

        const mailOptions = {
            from: `info@airqo.net`,
            to: `${req.body.email}`,
            subject: "Welcome to AirQo",
            text: `${msgs.welcome(req.body.firstName, req.body.lastName, password)}`,
        };

        /**** I will consider this for the confirmation process ******/
        // let userData = req.body;
        // userData.password = password;

        console.log("the values we are sending");
        console.dir(req.body);

        register(req, res, mailOptions, req.body, User);
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
        console.log("the body:");
        console.dir(req.body);
        const { errors, isValid } = validateLoginInput(req.body);

        if (!isValid) {
            return res.status(400).json(errors);
        }

        res.status(200).json(req.user.toAuthJSON());
        return next();
    },

    deleteUser: (req, res, next) => {
        User.findByIdAndRemove(req.params.id, (err, user) => {
            if (err) {
                return res.json({ success: false, message: "Some Error" });
            } else if (user) {
                return res.status(200).json({
                    success: true,
                    message: user.userName + " deleted successfully",
                });
            } else {
                return res.status(400).json({
                    success: true,
                    message: user.userName + " deleted successfully",
                });
            }
        });
    },

    updateUser: (req, res, next) => {
        User.findByIdAndUpdate(
            req.params.id,
            req.body, { new: true },
            (err, user) => {
                if (err) {
                    res.json({ success: false, message: "Some Error", error: err });
                } else if (user) {
                    console.log(user);
                    res.json({ success: true, message: "Updated successfully", user });
                } else {
                    res.json({
                        success: false,
                        message: "user does not exist in the db",
                    });
                }
            }
        );
    },

    updateUserDefaults: (req, res, next) => {
        let response = {};
        User.find({ _id: req.params.id }, (error, user) => {
            if (error) {
                response.success = false;
                response.message = "Unable to find the user";
                res.status(500).json(response);
            } else if (user.length) {
                let defaults = new Defaults(req.body);
                console.log("the user is here:");
                console.dir(user);
                console.log("the type of the user is: " + typeof user);
                defaults.user = user[0]._id;
                defaults.save((error, savedDefault) => {
                    if (error) {
                        response.success = false;
                        response.message = "Unable to save the default value";
                        response.error = error;
                        res.status(500).json(response);
                    } else {
                        response.success = true;
                        response.message = "successfully saved the defaults";
                        res.status(200).json(response);
                        console.log("the user object:");
                        console.dir(user[0]);
                        user[0].graph_defaults.push(savedDefault._id.valueOf());

                        user[0].save((error) => {
                            if (error) {
                                console.log(error);
                            } else {
                                console.log("user updates");
                            }
                        });
                    }
                });
            }
        });
    },

    getDefaults: async(req, res) => {
        try {
            console.log("the query");
            console.log(req.query);
            const prefs = await Defaults.find({ user: req.params.id });
            return res.status(HTTPStatus.OK).json({
                success: true,
                message: " defaults fetched successfully",
                prefs,
            });
        } catch (e) {
            return res
                .status(HTTPStatus.BAD_REQUEST)
                .json({ success: false, message: "Some Error" });
        }
    },
    updateLocations: (req, res) => {
        console.log("the user ID");
        console.log(req.params.id);
        let response = {};
        User.find({ _id: req.params.id }, (error, user) => {
            if (error) {
                response.success = false;
                response.message = "Internal Server Error";
                res.status(500).json(response);
            } else if (user.length) {
                let location = new Location(req.body);
                location.user = user[0]._id;
                location.save((error, savedLocation) => {
                    if (error) {
                        response.success = false;
                        response.message = "Internal Server Error";
                        res.status(500).json(response);
                    } else {
                        User.findByIdAndUpdate(
                            req.params.id, { $push: { pref_locations: savedLocation._id } }, { new: true },
                            (err, updatedUser) => {
                                if (err) {
                                    response.success = false;
                                    response.message = "Internal Server Error";
                                    res.status(500).json(response);
                                } else {
                                    res.status(200).json({
                                        message: "Sucessfully added the locations to the user",
                                        success: true,
                                        updatedUser,
                                    });
                                }
                            }
                        );
                    }
                });
            }
        });
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

    updatePassword: (req, res) => {
        const { errors, isValid } = validatePasswordUpdate(req.body);
        if (!isValid) {
            return res.status(400).json(errors);
        }

        User.findByIdAndUpdate({ _id: req.body.id }, req.body, (err, result) => {
            if (err) {
                res.status(500).json({ message: "server error", err, success: false });
            } else if (result) {
                res
                    .status(200)
                    .json({ message: "password updated", success: true, result });
            } else {
                res.status(400).json({
                    message: "user does not exist in the database",
                    success: false,
                });
            }
        });
    },
};

module.exports = join;