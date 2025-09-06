// const constants = require("@config/constants");
// const allowedOrigins =
//   constants.ALLOWED_ORIGINS && constants.ALLOWED_ORIGINS.trim() !== ""
//     ? constants.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
//     : ["*"];

const headers = (req, res, next) => {
  // const origin = req.get("Origin");
  // res.setHeader(
  //   "Access-Control-Allow-Origin",
  //   allowedOrigins.includes("*")
  //     ? "*"
  //     : allowedOrigins.includes(origin)
  //     ? origin
  //     : ""
  // );
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  // Handle preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
};

module.exports = headers;
