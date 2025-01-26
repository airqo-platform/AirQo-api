const constants = require("@config/constants");
const allowedOrigins = constants.ALLOWED_ORIGINS?.split(",") || ["*"];

const headers = (req, res, next) => {
  const origin = req.get("Origin");
  res.setHeader(
    "Access-Control-Allow-Origin",
    allowedOrigins.includes("*")
      ? "*"
      : allowedOrigins.includes(origin)
      ? origin
      : ""
  );
  // res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
};

module.exports = headers;
