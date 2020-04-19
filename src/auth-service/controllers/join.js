const User = require("../models/User");
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

const join = {
  listAll: async (req, res) => {
    try {
      const users = await User.find();
      return res.status(HTTPStatus.OK).json(users);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  listOne: async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      return res.status(HTTPStatus.OK).json(user);
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

  forgotPassword: async (req, res) => {
    try {
      if (req.params.email === "") {
        res.status(400).send("email required");
      }
      console.error(req.params.email);
      User.findOne({
        email: req.params.email,
      }).then((user) => {
        if (user === null) {
          console.error("email is not recognized");
          res.status(403).send("email not in db");
        } else {
          //if the user does exist, we generate a token and attach it to this account
          // time limit is also set for this.
          const token = crypto.randomBytes(20).toString("hex");
          user.update({
            resetPasswordToken: token,
            resetPasswordExpires: Date.now() + 3600000,
          });

          //create mail options - who sends what and to whom?
          const mailOptions = {
            from: `info@airqo.net`,
            to: `${user.email}`,
            subject: `Link To Reset Password`,
            text: `${msgs.recovery_email(token)}`,
          };
          //we shall review other third party libraries for making emails....^^

          console.log("sending mail");

          //deliver the message object using sendMail
          transporter.sendMail(mailOptions, (err, response) => {
            if (err) {
              console.error("there was an error: ", err);
            } else {
              console.log("here is the res: ", response);
              res.status(200).json("recovery email sent");
            }
          });
        }
      });
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  register: (req, res) => {
    //hitting the register endpoint....
    const {
      email,
      firstName,
      lastName,
      userName,
      password,
      privilege,
    } = req.body;

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
              subject: `AirQo Platform JOIN request`,
              text: `${msgs.join_request}`,
            };

            transporter.sendMail(mailOptions, (err, response) => {
              if (err) {
                console.error("there was an error: ", err);
              } else {
                console.log("here is the res: ", response);
                res.status(200).json(savedData);
              }
            });

            // sendEmail(email, templates.confirm(savedData._id))
            //   .then(() => {
            //     res.json({ msg: msgs.confirm });
            //   })
            //   .catch(err => console.log(err));
            // return res.status(201).json(savedData);
            // return res.status(201).json({ msg: msgs.confirm });
          }
        });
      }
    });
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
  addCollaborator: async (req, res, next) => {
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

  logout: async (req, res) => {
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
    User.findOne({
      userName: req.body.userName,
      resetPasswordToken: req.body.resetPasswordToken,
      resetPasswordExpires: {
        $gt: Date.now(),
      },
    }).then((user) => {
      if (user == null) {
        console.log("password reset link is invalid or has expired");
        res.status(403).send("password reset link is invalid or has expired");
      } else if (user != null) {
        user.update({
          password: req.body.password,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        });
        console.log("password updated");
        res.status(200).send({ message: "password updated" });
      } else {
        console.log("no user exists in db to update");
        res.status(401).json({ message: "no user exists in db to update" });
      }
    });
  },
};

module.exports = join;
