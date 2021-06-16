const UserSchema = require("../models/User");
const HTTPStatus = require("http-status");
const constants = require("../config/constants");
const privileges = require("../utils/privileges");
const transporter = require("../services/mailer");
const templates = require("../utils/email.templates");
const msgs = require("../utils/email.msgs");
const crypto = require("crypto");
const validations = require("../utils/validations");
const register = require("../utils/register");
const isEmpty = require("is-empty");
const { logElement, logText, logObject } = require("../utils/log");
const { getModelByTenant } = require("../utils/multitenancy");
const bcrypt = require("bcrypt");
const sendEmail = require("../utils/sendEmail");
const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");

const joinUtil = require("../utils/join");
const generateFilter = require("../utils/generate-filter");

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const join = {
  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all users by query params provided");
      const { tenant, id } = req.query;
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      if (!tenant) {
        return missingQueryParams(req, res);
      }
      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        let responseFromListUsers = await joinUtil.list(
          tenant,
          filter,
          limit,
          skip
        );
        logObject("responseFromListUsers", responseFromListUsers);
        if (responseFromListUsers.success == true) {
          res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromListUsers.message,
            users: responseFromListUsers.data,
          });
        } else if (responseFromListUsers.success == false) {
          if (responseFromListUsers.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListUsers.message,
              error: responseFromListUsers.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListUsers.message,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: error.message,
      });
    }
  },

  forgot: async (req, res) => {
    logText("...........................................");
    logText("forgot password");
    try {
      let { email } = req.body;
      let { tenant } = req.query;
      if (!tenant && !email) {
        missingQueryParams(req, res);
      }
      logElement("the email", email);
      const { error, isValid } = validations.forgot(email);
      if (!isValid) {
        return res.status(HTTPStatus.BAD_REQUEST).json(errors);
      }
      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        let update = { email };
        let responseFromForgotPassword = await joinUtil.forgotPassword(
          tenant,
          filter,
          update
        );
        logObject("responseFromForgotPassword", responseFromForgotPassword);
        if (responseFromForgotPassword.success == true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromForgotPassword.message,
            response: responseFromForgotPassword.data,
          });
        } else if (responseFromForgotPassword.success == false) {
          if (responseFromForgotPassword.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromForgotPassword.message,
              error: responseFromForgotPassword.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromForgotPassword.message,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        }
      }

      // const token = crypto.randomBytes(20).toString("hex");

      // let query = { email: req.body.email };

      // if (!query.email) {
      //   return res
      //     .status(HTTPStatus.BAD_REQUEST)
      //     .json({ success: false, message: "email field is required" });
      // }
      // let updateDetails = {
      //   resetPasswordToken: token,
      //   resetPasswordExpires: Date.now() + 3600000,
      // };
      // //get the model based on tenant
      // const { tenant } = req.query;

      // await UserModel(tenant.toLowerCase()).findOneAndUpdate(
      //   query,
      //   updateDetails,
      //   (error, response) => {
      //     if (error) {
      //       return res
      //         .status(HTTPStatus.BAD_GATEWAY)
      //         .json({ message: "Email does not exist" });
      //     } else if (response) {
      //       /**
      //        * afterwards, send them emails accordingly
      //        */
      //       const mailOptions = {
      //         from: constants.EMAIL,
      //         to: `${req.body.email}`,
      //         subject: `Link To Reset Password`,
      //         text: `${msgs.recovery_email(token, tenant)}`,
      //       };

      //       console.log("sending mail");

      //       //deliver the message object using sendMail
      //       transporter.sendMail(mailOptions, (err, response) => {
      //         if (err) {
      //           console.error("there was an error: ", err);
      //           return res
      //             .status(HTTPStatus.BAD_GATEWAY)
      //             .json({ email: "unable to send email" });
      //         } else {
      //           console.log("here is the res: ", response);
      //           return res
      //             .status(HTTPStatus.OK)
      //             .json({ message: "recovery email sent" });
      //         }
      //       });
      //     } else {
      //       return res.status(HTTPStatus.BAD_GATEWAY).json({
      //         message:
      //           "unable to send email. Please crosscheck the organisation and email information provided.",
      //       });
      //     }
      //   }
      // );
    } catch (error) {
      // tryCatchErrors(res, error);
      res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: error.message,
      });
    }
  },

  register: async (req, res) => {
    logText("..................................................");
    logText("register user.............");
    try {
      const { errors, isValid } = validations.register(req.body);
      const { tenant } = req.query;
      const { firstName, lastName, email, organization, privilege } = req.body;

      if (!isValid) {
        return res
          .status(HTTPStatus.BAD_REQUEST)
          .json({ success: false, errors, message: "validation error" });
      }

      let responseFromCreateUser = await joinUtil.create(
        tenant.toLowerCase(),
        firstName,
        lastName,
        email,
        organization,
        privilege
      );
      logObject("responseFromCreateUser in controller", responseFromCreateUser);
      if (responseFromCreateUser.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromCreateUser.message,
          user: responseFromCreateUser.data,
        });
      } else if (responseFromCreateUser.success == false) {
        if (responseFromCreateUser.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromCreateUser.message,
            error: responseFromCreateUser.error,
          });
        } else {
          return res.status(HTTPStatus).json({
            success: false,
            message: responseFromCreateUser.message,
          });
        }
      }
    } catch (error) {
      tryCatchErrors(res, error);
    }
  },

  confirmEmail: async (req, res) => {
    logText(".......................................................");
    logText("confirming email...............");
    try {
      const { tenant, id } = req.query;
      if (!tenant) {
        missingQueryParams(req, res);
      }
      let responseFromFilter = generateFilter.users(req);
      logElement("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        filter["emailConfirmed"] = false;
        update = { confirmed: true };
        let responseFromConfirmEmail = joinUtil.confirmEmail(
          tenant,
          filter,
          update
        );
        if (responseFromConfirmEmail.success == true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromConfirmEmail.message,
          });
        } else if (responseFromConfirmEmail.success == false) {
          if (responseFromConfirmEmail.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromConfirmEmail.message,
              error: responseFromConfirmEmail.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromConfirmEmail.message,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        }
      }

      // UserModel(tenant.toLowerCase())
      //   .findById(id)
      //   .then((user) => {
      //     //when the user does not exist in the DB
      //     if (!user) {
      //       res.json({ msg: msgs.couldNotFind });
      //     }
      //     // The user exists but has not been confirmed. So we confirm them...
      //     else if (user && !user.emailConfirmed) {
      //       User.findByIdAndUpdate(id, { confirmed: true })
      //         .then(() => res.json({ msg: msgs.confirmed }))
      //         .catch((err) => console.log(err));
      //     }
      //     //when the user has already confirmed their email address
      //     else {
      //       res.json({ msg: msgs.alreadyConfirmed });
      //     }
      //   })
      //   .catch((err) => console.log(err));
    } catch (error) {
      logElement("controller server error", error.message);
      tryCatchErrors(res, error);
    }
  },

  login: (req, res) => {
    logText("..................................");
    logText("user login......");
    try {
      const { errors, isValid } = validations.login(req.body);
      if (!isValid) {
        return res.status(HTTPStatus.BAD_REQUEST).json(errors);
      }
      if (req.auth.success == true) {
        res.status(HTTPStatus.OK).json(req.user.toAuthJSON());
      } else {
        if (req.auth.error) {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: req.auth.success,
            error: req.auth.error,
            message: req.auth.message,
          });
        }
        res.status(HTTPStatus.BAD_GATEWAY).json({
          success: req.auth.success,
          message: req.auth.message,
        });
      }
    } catch (error) {
      tryCatchErrors(res, error);
    }
  },

  delete: async (req, res) => {
    logText(".................................................");
    logText("inside delete user............");
    const { tenant, id } = req.query;
    if (!tenant && !id) {
      return missingQueryParams(req, res);
    }
    let responseFromFilter = generateFilter.users(req);
    logObject("responseFromFilter", responseFromFilter);
    if (responseFromFilter.success == true) {
      let filter = responseFromFilter.data;
      let responseFromRemoveUser = await joinUtil.delete(tenant, filter);
      if (responseFromRemoveUser.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromRemoveUser.message,
          user: responseFromRemoveUser.data,
        });
      } else if (responseFromRemoveUser.success == false) {
        if (responseFromRemoveUser.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromRemoveUser.message,
            error: responseFromRemoveUser.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromRemoveUser.message,
          });
        }
      }
    } else if (responseFromFilter.success == false) {
      if (responseFromFilter.error) {
        res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromFilter.message,
          error: responseFromFilter.error,
        });
      } else {
        res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromFilter.message,
        });
      }
    }
  },

  update: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside user update................");
      const { tenant, id } = req.query;
      if (!tenant && !id) {
        return missingQueryParams(req, res);
      }
      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        let update = req.body;
        delete update.password;
        delete update._id;
        let responseFromUpdateUser = await joinUtil.update(
          tenant,
          filter,
          update
        );
        logObject("responseFromUpdateUser", responseFromUpdateUser);
        if (responseFromUpdateUser.success == true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromUpdateUser.message,
            user: responseFromUpdateUser.data,
          });
        } else if (responseFromUpdateUser.success == false) {
          if (responseFromUpdateUser.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateUser.message,
              error: responseFromUpdateUser.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateUser.message,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      tryCatchErrors(res, error);
    }
  },

  updateForgottenPassword: async (req, res) => {
    try {
      const { tenant } = req.query;
      const { password, resetPasswordToken } = req.body;
      if (!tenant && !resetPasswordToken && !password) {
        return missingQueryParams(req, res);
      }
      let responseFromFilter = generateFilter.users(req);
      if (responseFromFilter.success == true) {
        let update = {
          password,
          resetPasswordToken,
        };
        let filter = responseFromFilter.data;
        let responseFromUpdateForgottenPassword =
          await joinUtil.updateForgottenPassword(tenant, filter, update);
        if (responseFromUpdateForgottenPassword.success == true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromUpdateForgottenPassword.message,
          });
        } else if (responseFromUpdateForgottenPassword.success == false) {
          if (responseFromUpdateForgottenPassword.error) {
            res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateForgottenPassword.message,
              error: responseFromUpdateForgottenPassword.error,
            });
          } else {
            res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateForgottenPassword.message,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }

      // await UserModel(tenant.toLowerCase())
      //   .findOne({
      //     resetPasswordToken: resetPasswordToken,
      //     resetPasswordExpires: {
      //       $gt: Date.now(),
      //     },
      //   })
      //   .then((user) => {
      //     if (user === null) {
      //       console.log("password reset link is invalid or has expired");
      //       res.status(HTTPStatus.BAD_REQUEST).json({
      //         message: "password reset link is invalid or has expired",
      //         success: false,
      //       });
      //     } else if (user !== null) {
      //       user.resetPasswordToken = null;
      //       user.resetPasswordExpires = null;
      //       user.password = password;
      //       user.save((error, saved) => {
      //         if (error) {
      //           console.log("user does not exist");
      //           res.status(HTTPStatus.BAD_GATEWAY).json({
      //             success: false,
      //             message: "user does not exist",
      //           });
      //         } else if (saved) {
      //           console.log("password updated");
      //           res.status(HTTPStatus.OK).json({
      //             success: true,
      //             message: "password updated successfully",
      //             userName: user.userName,
      //           });
      //         }
      //       });
      //     } else {
      //       console.log("the user does not exist");
      //       res.status(HTTPStatus.BAD_GATEWAY).json({
      //         success: false,
      //         message: "the user does not exist",
      //       });
      //     }
      //   });
    } catch (error) {
      tryCatchErrors(res, error);
    }
  },

  updateKnownPassword: async (req, res) => {
    try {
      logText("update known password............");
      /**
       * check that all needed params are present
       * check that the user does exist (happen from the util I presume)
       * if user exists, then check that their old passwords matches
       * if the old password matches, then perform the password update
       */
      const { errors, isValid } = validations.updateKnownPassword(req.body);
      if (!isValid) {
        return res.status(400).json(errors);
      }
      const { tenant, id } = req.query;
      const { password, old_password } = req.body;
      if (!tenant && !password && !old_password && id) {
        return missingQueryParams(req, res);
      }

      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        let responseFromUpdatePassword = await joinUtil.updateKnownPassword(
          tenant,
          password,
          old_password,
          filter
        );
        if (responseFromUpdatePassword.success == true) {
          return res.status(HTTPStatus).json({
            success: true,
            message: responseFromUpdatePassword.message,
          });
        } else if (responseFromUpdatePassword.success == false) {
          if (responseFromUpdatePassword.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdatePassword.message,
              error: responseFromUpdatePassword.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdatePassword.message,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: error.message,
      });
    }
  },
};

module.exports = join;
