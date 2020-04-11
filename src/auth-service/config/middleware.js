const morgan = require("morgan");
const bodyParser = require("body-parser");
const compression = require("compression");
const helmet = require("helmet");
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const mongoose = require("mongoose");

const { isPrimitive } = require("util");

const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

//we export a middleware funtion which takes in the express application as the input

module.exports = app => {
  if (isProd) {
    app.use(compression());
    app.use(helmet());
  }

  const options = { mongooseConnection: mongoose.connection };

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      store: new MongoStore(options),
      resave: false, //been told that this thing clears the user after logout
      saveUninitialized: false //same story here...
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(bodyParser.json());
  app.use(
    bodyParser.urlencoded({
      extended: true
    })
  );

  if (isDev) {
    app.use(morgan("dev"));
  }
};
