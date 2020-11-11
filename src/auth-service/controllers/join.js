const UserSchema = require("../models/User");
const LocationSchema = require("../models/Location");
const DefaultSchema = require("../models/Defaults");
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
const isEmpty = require("is-empty");
const { logElement, logText, logObject } = require("../utils/log");
const { getModelByTenant } = require("../utils/multitenancy");
const bcrypt = require("bcrypt");
const sendEmail = require("../utils/sendEmail");

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const DefaultModel = (tenant) => {
  return getModelByTenant(tenant, "default", DefaultSchema);
};

const LocationModel = (tenant) => {
  return getModelByTenant(tenant, "location", LocationSchema);
};

const join = {
  addUserByTenant: async (req, res) => {
    try {
      logText("...................................");
      console.log("inside add user by tenant");
      const { tenant } = req.query;
      const { body } = req;
      logObject("checking the body", body);
      const user = await UserModel(tenant.toLowerCase()).createUser(body);
      if (user) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: "User creation successful",
          user,
        });
      }
    } catch (e) {
      logText(`User created with response`, e.message);
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "User creation failed userDao.js",
        error: e.message,
      });
    }
  },

  listAll: async (req, res) => {
    try {
      //....
      logText(".....................................");
      logText("list all users by tenant...");
      const { tenant, id } = req.query;

      if (tenant && id) {
        logElement("the tenant", tenant);
        logElement("the id", id);
        const user = await UserModel(tenant.toLowerCase()).findOne({ _id: id });
        logObject("the user", user);
        if (!isEmpty(user)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "User fetched successfully",
            user,
          });
        } else if (isEmpty(user)) {
          return res.json({
            success: false,
            message: `this organisation (${tenant}) does not have this user or they do not exist, please crosscheck`,
          });
        }
      } else if (tenant && !id) {
        const users = await UserModel(tenant.toLowerCase()).find();
        if (!isEmpty(users)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Users fetched successfully",
            users,
          });
        } else if (isEmpty(users)) {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: `this organisation (${tenant}) does not have users or it does not exist, please crosscheck`,
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message:
            "request is missing the required query params, please crosscheck",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "A bad request has been made, please crosscheck",
        error: e.message,
      });
    }
  },

  forgotPassword: async (req, res) => {
    console.log("inside forgot password");
    try {
      logElement("the email", req.body.email);
      // const { errors, isValid } = validateForgotPwdInput(req.body.email);
      // if (!isValid) {
      //     return res.status(400).json(errors);
      // }
      console.log("reaching forgotPassword");
      console.log("the email is here: " + req.body.email);

      const token = crypto.randomBytes(20).toString("hex");

      let query = { email: req.body.email };

      if (!query.email) {
        return res
          .status(400)
          .json({ success: false, message: "email field is required" });
      }
      let updateDetails = {
        resetPasswordToken: token,
        resetPasswordExpires: Date.now() + 3600000,
      };
      //get the model based on tenant
      const { tenant } = req.query;

      await UserModel(tenant.toLowerCase()).findOneAndUpdate(
        query,
        updateDetails,
        (error, response) => {
          if (error) {
            return res.status(400).json({ message: "Email does not exist" });
          } else if (response) {
            const mailOptions = {
              from: constants.EMAIL,
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
                return res.status(200).json({ message: "recovery email sent" });
              }
            });
            //return res.status(HTTPStatus.OK).json(response);
          } else {
            return res.status(400).json({
              message:
                "unable to send email. Please crosscheck the organisation and email information provided.",
            });
          }
        }
      );
    } catch (e) {}
  },

  registerUser: (req, res) => {
    console.log("inside register user");
    try {
      const { errors, isValid } = validateRegisterInput(req.body);
      if (!isValid) {
        return res
          .status(400)
          .json({ success: false, errors, message: "validation error" });
      }

      const { tenant } = req.query;
      const { firstName, lastName, password, userName } = req.body;

      let mailOptions = {};
      if (tenant == "kcca") {
        mailOptions = {
          from: `airqo.analytics@gmail.com`,
          to: `${req.body.email}`,
          subject: "Welcome to the AirQo KCCA Platform",
          text: `${msgs.welcome_kcca(firstName, lastName, password, userName)}`,
        };
      } else {
        mailOptions = {
          from: `airqo.analytics@gmail.com`,
          to: `${req.body.email}`,
          subject: "Welcome to the AirQo Platform",
          text: `${msgs.welcome_general(
            firstName,
            lastName,
            password,
            userName
          )}`,
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
      logElement("the error", e);
      return res.status(500).json({
        success: false,
        message: "unable to register user",
        error: e.message,
      });
    }
  },
  //invoked when the user visits the confirmation url on the client
  confirmEmail: async (req, res) => {
    console.log("inside confirm email");
    try {
      const { tenant, id } = req.query;
      UserModel(tenant.toLowerCase())
        .findById(id)
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
    } catch (e) {
      return res.status(500).json({
        success: false,
        e,
        message: "unable to confirm email",
        error: e.message,
      });
    }
  },

  loginUser: (req, res, next) => {
    logText("..................................");
    logText("user login......");
    try {
      const { errors, isValid } = validateLoginInput(req.body);

      if (!isValid) {
        return res.status(400).json(errors);
      }
      res.status(200).json(req.user.toAuthJSON());
      return next();
    } catch (e) {
      res.json({ success: false, message: e.message });
    }
  },

  deleteUser: (req, res, next) => {
    console.log("inside delete update");
    const { tenant, id } = req.query;
    UserModel(tenant.toLowerCase()).findByIdAndRemove(id, (err, user) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: "unable to remove User",
          error: err,
        });
      } else if (user) {
        return res.status(200).json({
          success: true,
          message: user.userName + " deleted successfully",
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "unable to delete the user due to a server error",
        });
      }
    });
  },

  updateUser: (req, res, next) => {
    console.log("inside user update");
    const { tenant, id } = req.query;
    delete req.body.password;
    delete req.body.email;
    UserModel(tenant.toLowerCase()).findByIdAndUpdate(
      id,
      req.body,
      { new: true },
      (err, user) => {
        if (err) {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: "Unable to update user",
            error: err,
          });
        } else if (user) {
          const mailOptions = {
            from: constants.EMAIL,
            to: `${user.email}`,
            subject: "AirQo Platform account updated",
            text: `${msgs.user_updated(user.firstName, user.lastName)}`,
          };
          const message = constants.ACCOUNT_UPDATED;
          sendEmail(req, res, mailOptions, message);
        } else {
          res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: "user does not exist in the db",
          });
        }
      }
    );
  },

  updateUserDefaults: async (req, res, next) => {
    console.log("inside update user defaults");
    try {
      const { tenant, user, chartTitle } = req.query;
      logElement("title", chartTitle);
      logElement("type of title", typeof chartTitle);
      logElement("user", user);
      logElement("tenant", tenant);

      if (!isEmpty(user) && !isEmpty(chartTitle) && !isEmpty(tenant)) {
        const filter = {
          user: user,
          chartTitle: chartTitle,
        };
        delete req.body.chartTitle;
        delete req.body.user;
        let update = req.body,
          options = { upsert: true, new: true };
        let doc = await DefaultModel(tenant.toLowerCase())
          .findOneAndUpdate(filter, update, options)
          .exec();

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
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "there is a server error",
        error: e.message,
      });
    }
  },

  getDefaults: async (req, res) => {
    try {
      //....
      logText(".....................................");
      logText("list all defaults by tenant...");
      const { tenant, user, chartTitle } = req.query;

      if (tenant && user && !chartTitle) {
        logElement("the tenant", tenant);
        logElement("the user", user);
        const defaults = await DefaultModel(tenant.toLowerCase())
          .find({ user: user })
          .exec();
        logObject("the defaults", defaults);
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: `Customised chart defaults for ${user} fetched successfully`,
          defaults,
        });
      } else if (tenant && user && chartTitle) {
        const userdefault = await DefaultModel(tenant.toLowerCase())
          .find({
            user: user,
            chartTitle: chartTitle,
          })
          .exec();
        if (userdefault) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: `Customised chart defaults for ${user} on chart ${chartTitle} fetched successfully`,
            userdefault,
          });
        } else if (!userdefault) {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: `this organisation (${tenant}) does not have defaults or it does not exist, please crosscheck`,
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message:
            "request is missing the required query params, please crosscheck",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "A bad request has been made, please crosscheck",
        error: e.message,
      });
    }
  },
  updateLocations: (req, res) => {
    console.log("inside update locations");
    const { tenant, id } = req.query;
    let response = {};
    UserModel(tenant.toLowerCase()).find({ _id: id }, (error, user) => {
      if (error) {
        response.success = false;
        response.message = "Internal Server Error";
        res.status(500).json(response);
      } else if (user.length) {
        let location = new LocationModel(tenant.toLowerCase())(req.body);
        location.user = user[0]._id;
        location.save((error, savedLocation) => {
          if (error) {
            response.success = false;
            response.message = "Internal Server Error";
            res.status(500).json(response);
          } else {
            UserModel(tenant.toLowerCase()).findByIdAndUpdate(
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
    const { tenant, resetPasswordToken } = req.query;
    console.log("inside the reset password function...");
    console.log(`${resetPasswordToken}`);
    await UserModel(tenant.toLowerCase()).findOne(
      {
        resetPasswordToken: resetPasswordToken,
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
    const { tenant } = req.query;
    console.log("inside update password via email");

    const { userName, password, resetPasswordToken } = req.body;

    UserModel(tenant.toLowerCase())
      .findOne({
        userName: userName,
        resetPasswordToken: resetPasswordToken,
        resetPasswordExpires: {
          $gt: Date.now(),
        },
      })
      .then((user) => {
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
              res
                .status(401)
                .json({ message: "no user exists in db to update" });
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
    console.log("inside update password");

    try {
      const { errors, isValid } = validatePasswordUpdate(req.body);
      if (!isValid) {
        return res.status(400).json(errors);
      }
      const { tenant, id } = req.query;
      const { password, password2, old_pwd } = req.body;
      if ((password, password2, old_pwd)) {
        UserModel(tenant.toLowerCase())
          .findOne({
            _id: id,
          })
          .then((user) => {
            if (user !== null) {
              //first compare old_pwd with current one
              bcrypt.compare(old_pwd, user.password, (err, resp) => {
                if (err) {
                  res
                    .status(500)
                    .json({ message: "please crosscheck your old password" });
                } else if (resp == false) {
                  res
                    .status(404)
                    .json({ message: "please crosscheck your old password" });
                } else {
                  user.password = password;
                  user.save((error, saved) => {
                    if (error) {
                      console.log("no user exists in db to update");
                      res
                        .status(401)
                        .json({ message: "no user exists in db to update" });
                    } else if (saved) {
                      console.log("password updated");
                      res.status(200).json({ message: "password updated" });
                    }
                  });
                }
              });
            } else {
              console.log("no user exists in db to update");
              res
                .status(401)
                .json({ message: "no user exists in db to update" });
            }
          });
      } else {
        res.status(HTTPStatus.BAD_REQUEST).json({
          message:
            "missing some query params or request body items, please check documentation",
        });
      }
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  },
};

module.exports = join;
