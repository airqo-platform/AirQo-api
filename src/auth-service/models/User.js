//const DataAccess = require("../config/das");
const mongoose = require("mongoose");
const validator = require("validator");
const { passwordReg } = require("../utils/validations");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const constants = require("../config/constants");
const ObjectId = mongoose.Schema.Types.ObjectId;

function oneMonthFromNow() {
  var d = new Date();
  var targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: [true, "Email is required"],
    trim: true,
    validate: {
      validator(email) {
        return validator.isEmail(email);
      },
      message: "{VALUE} is not a valid email!",
    },
  },
  emailConfirmed: {
    type: Boolean,
    default: false,
  },
  firstName: {
    type: String,
    required: [true, "FirstName is required!"],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, "LastName is required"],
    trim: true,
  },
  userName: {
    type: String,
    required: [true, "UserName is required!"],
    trim: true,
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Password is required!"],
    trim: true,
    minlength: [6, "Password is required"],
    validate: {
      validator(password) {
        return passwordReg.test(password);
      },
      message: "{VALUE} is not a valid password!",
    },
  },
  interest: { type: String, default: "none" },
  org_name: { type: String, default: "none" },
  privilege: { type: String, default: "admin" },
  accountStatus: { type: String, default: "false" },
  hasAccess: { type: Boolean, default: false },
  collaborators: [{ type: ObjectId, ref: "colab" }],
  publisher: { type: Boolean, default: false },
  duration: { type: Date, default: oneMonthFromNow },
  bus_nature: { type: String, default: "none" },
  org_department: { type: String, default: "none" },
  uni_faculty: { type: String, default: "none" },
  uni_course_yr: { type: String, default: 0 },
  pref_locations: [{ type: ObjectId, ref: "loc" }],
  country: { type: String, default: "Uganda" },
  job_title: { type: String, default: "none" },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
});

UserSchema.pre("save", function (next) {
  if (this.isModified("password")) {
    this.password = this._hashPassword(this.password);
  }
  return next();
});

UserSchema.pre("update", function (next) {
  if (this.isModified("password")) {
    this.password = this._hashPassword(this.password);
  }
  return next();
});

UserSchema.methods = {
  _hashPassword(password) {
    // bcrypt.hash(password, saltRounds).then(function (hash) {
    //     return hash;
    // })
    return bcrypt.hashSync(password, saltRounds);
  },
  authenticateUser(password) {
    // bcrypt.compare(password, this.password).then(function (res) {
    //     return res;
    // })
    return bcrypt.compareSync(password, this.password);
  },
  createToken() {
    return jwt.sign(
      {
        _id: this._id,
        firstName: this.firstName,
        lastName: this.lastName,
      },
      constants.JWT_SECRET
    );
  },
  toAuthJSON() {
    return {
      _id: this._id,
      userName: this.userName,
      token: `JWT ${this.createToken()}`,
    };
  },
  toJSON() {
    return {
      _id: this._id,
      userName: this.userName,
    };
  },
};

const user = mongoose.model("user", UserSchema);

module.exports = user;

// shall consider this when implementing the Bridge Design Pattern
// const Model = function () {

// }

// Model.prototype.GetUsers = function () {
//     return new Promise(function (fulfill, reject) {
//         DataAccess.GetEntities("auth_service", "users")
//             .then(function (docs) {
//                 fulfill(docs);
//             }).catch(function (err) {
//                 reject(err);
//             });
//     });
// };
