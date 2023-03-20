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

  const logUserActivity = (req, res, next) => {
    const userId = req.user ? req.user.id : "anonymous";
    const message = `User ${userId} performed ${req.method} request to ${req.originalUrl}`;
    logger.info(message);
    next();
  };

  // Use logging middleware for all routes
  app.use(logUserActivity);

  /***
   * 
   * In this example, we first connect to MongoDB 
   * using Mongoose, and define a schema and 
   * model for the log collection. 
   * We then configure the Winston logger to log to the 
   * console and to a MongoDB collection named "logs", 
   * using the winston.transports.MongoDB transport.

We define a middleware function called logUserActivity 
that logs the user's ID (if available) and 
the HTTP method and URL of the incoming request, 
using the configured Winston logger. 
This middleware is added to the Express app using app.use, 
which applies it to all routes.

Finally, we define a simple route handler that returns 
a "Hello World!" response, and start the server on port 3000.

With this setup, all incoming requests to the Node.js 
authentication microservice will be logged to the console 
and to a MongoDB collection, with the user's ID 
(if available), HTTP method, and URL. 
You can customize the logging behavior 
further by modifying the Winston logger or 
the middleware function as needed.
   * 
   * 
   */

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
