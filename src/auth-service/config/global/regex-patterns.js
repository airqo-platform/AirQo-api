const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const regexPatterns = {
  PASSWORD_REGEX: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#?!$%^&*,.]{6,}$/,
};
module.exports = regexPatterns;
