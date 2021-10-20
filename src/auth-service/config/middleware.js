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

module.exports = (app) => {
  if (isProd) {
    app.use(compression());
    app.use(helmet());
  }

  const options = { mongooseConnection: mongoose.connection };

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      store: new MongoStore(options),
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(bodyParser.json());
  app.use(
    bodyParser.urlencoded({
      extended: true,
    })
  );

  if (isDev) {
    app.use(morgan("dev"));
    // console.log = function () {};
  }
};
