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
const isEmpty = require("is-empty");

const join = {
  listAll: async (req, res) => {
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
        .json({ success: false, message: "Unable to list all" });
    }
  },

  listOne: async (req, res) => {
    User.find({ _id: req.params.id }).exec((err, user) => {
      if (err) {
        return res.json({ success: false, message: "Unable to list one" });
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

  forgotPassword: async (req, res) => {
    console.log("the email who forgot is  " + req.body.email);

    // const { errors, isValid } = validateForgotPwdInput(req.body.email);
    // if (!isValid) {
    //     return res.status(400).json(errors);
    // }
    console.log("reaching forgotPassword");
    console.log("the email is here: " + req.body.email);

    const token = crypto.randomBytes(20).toString("hex");

    let query = { email: req.body.email };
    let updateDetails = {
      resetPasswordToken: token,
      resetPasswordExpires: Date.now() + 3600000,
    };
    await User.findOneAndUpdate(query, updateDetails, (error, response) => {
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
      text: `${msgs.welcome(
        req.body.firstName,
        req.body.lastName,
        req.body.password,
        req.body.userName
      )}`,
    };

    /**** I will consider this for the confirmation process ******/
    // let userData = req.body;
    // userData.password = password;

    console.log("the values we are sending");
    console.dir(req.body);

    register(req, res, mailOptions, req.body, User);
  },
  //invoked when the user visits the confirmation url on the client
  confirmEmail: async (req, res) => {
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
        return res.json({ success: false, message: "Unable to delete user" });
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
      req.body,
      { new: true },
      (err, user) => {
        if (err) {
          res.json({
            success: false,
            message: "Unable to update user",
            error: err,
          });
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

  updateUserDefaults: async (req, res, next) => {
    try {
      const { user, chartTitle } = req.query;
      if (!isEmpty(user) && !isEmpty(chartTitle)) {
        const filter = {
            user: req.query.user,
            chartTitle: req.query.chartTitle,
          },
          update = req.body,
          options = { upsert: true, new: true };
        let doc = await Defaults.findOneAndUpdate(filter, update, options);

        if (doc) {
          res.status(200).json({
            success: true,
            message: "updated/created the user defaults",
            doc,
          });
        } else {
          res.status(500).json({
            success: false,
            message: "unable to create/update these defaults",
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "please crosscheck the api query parameters using the documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message:
          "please crosscheck the api query parameters using the documentation",
        error: e.message,
      });
    }
  },

  getDefaults: async (req, res) => {
    try {
      const { user, chartTitle } = req.query;
      let filter = {};
      console.log;
      if (!isEmpty(user) && isEmpty(chartTitle)) {
        filter = {
          user: user,
        };
      } else if (!isEmpty(user) && !isEmpty(chartTitle)) {
        filter = {
          user: user,
          chartTitle: chartTitle,
        };
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "please crosscheck the api query parameters using the documentation",
        });
      }
      // const filter = {
      //   user: req.query.user,
      //   chartTitle: req.query.chartTitle,
      // };
      const defaults = await Defaults.find(filter);
      return res.status(HTTPStatus.OK).json({
        success: true,
        message: " defaults fetched successfully",
        defaults,
      });
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "Unable to fetch the defaults for the user",
        error: e.message,
      });
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
              req.params.id,
              { $push: { pref_locations: savedLocation._id } },
              { new: true },
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

  resetPassword: async (req, res, next) => {
    console.log("inside the reset password function...");
    console.log(`${req.query.resetPasswordToken}`);
    await User.findOne(
      {
        resetPasswordToken: req.query.resetPasswordToken,
        resetPasswordExpires: {
          $gt: Date.now(),
        },
      },
      (err, result) => {
        if (err) {
          res
            .status(403)
            .json({ message: "password reset link is invalid or has expired" });
        } else if (result) {
          res.status(200).send({
            userName: result.userName,
            message: "password reset link a-ok",
          });
        } else {
          res
            .status(403)
            .json({ message: "password reset link is invalid or has expired" });
        }
      }
    );
  },

  updatePasswordViaEmail: (req, res, next) => {
    const { userName, password } = req.body;

    User.findOne({
      userName: userName,
      resetPasswordToken: req.body.resetPasswordToken,
      resetPasswordExpires: {
        $gt: Date.now(),
      },
    }).then((user) => {
      if (user === null) {
        console.log("password reset link is invalid or has expired");
        res
          .status(403)
          .json({ msg: "password reset link is invalid or has expired" });
      } else if (user !== null) {
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        user.password = password;
        user.save((error, saved) => {
          if (error) {
            console.log("no user exists in db to update");
            res.status(401).json({ message: "no user exists in db to update" });
          } else if (saved) {
            console.log("password updated");
            res.status(200).json({ message: "password updated" });
          }
        });
      } else {
        console.log("no user exists in db to update");
        res.status(401).json({ message: "no user exists in db to update" });
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
