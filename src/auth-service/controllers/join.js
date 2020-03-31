const User = require("../models/User");
const Collaborator = require("../models/Collaborator");
const HTTPStatus = require("http-status");
const transport = require("../services/mailer");
const constants = require("../config/constants");
const privileges = require("../utils/privileges");
const sendEmail = require("../services/mailer");
const templates = require("../utils/email.templates");
const msgs = require("../utils/email.msgs");

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

  findUserById: (req, res, next, id) => {
    User.findById(id).exec((err, user) => {
      if (err || !user) {
        return res.status(400).json({
          error: "No user found with these credentials!"
        });
      }
      req.profile = user;
      next();
    });
  },

  register: (req, res) => {
    const {
      email,
      firstName,
      lastName,
      userName,
      password,
      privilege
    } = req.body;

    console.log(process.env.ATLAS_URI);

    try {
      const user = new User(req.body);
      user.save((error, savedData) => {
        if (error) {
          return res.status(500).json(error);
        } else {
          //sending the confirmation email to the user
          sendEmail(email, templates.confirm(savedData._id))
            .then(() => {
              res.json({ msg: msgs.confirm });
            })
            .catch(err => console.log(err));
          // return res.status(201).json(savedData);
          // return res.status(201).json({ msg: msgs.confirm });
        }
      });
    } catch (e) {
      return res.status(500).json(e);
    }
  },

  //invoked when the user visits the confirmation url on the client
  confirmEmail: async (req, res) => {
    const { id } = req.params;
    User.findById(id)
      .then(user => {
        //when the user does not exist in the DB
        if (!user) {
          res.json({ msg: msgs.couldNotFind });
        }
        // The user exists but has not been confirmed. So we confirm them...
        else if (user && !user.emailConfirmed) {
          User.findByIdAndUpdate(id, { confirmed: true })
            .then(() => res.json({ msg: msgs.confirmed }))
            .catch(err => console.log(err));
        }
        //when the user has already confirmed their email address
        else {
          res.json({ msg: msgs.alreadyConfirmed });
        }
      })
      .catch(err => console.log(err));
  },

  loginUser: (req, res, next) => {
    console.log("we have reached loginUser....");
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
  }
};

module.exports = join;
