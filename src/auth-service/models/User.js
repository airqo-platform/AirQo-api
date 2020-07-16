// Using DataStore from GCP
// const { instances } = require("gstore-node");
// const gstoreDefaultInstance = instances.get("default");
// const gstoreWithCache = instances.get("cache-on");
// const gstoreStaging = instances.get("staging");
// const Schema = gstoreDefaultInstance.Schema;

//const DataAccess = require("../config/das");
const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const validator = require("validator");
const { passwordReg } = require("../utils/validations");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const constants = require("../config/constants");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { tenantModel } = require("../config/multiTenant");

function oneMonthFromNow() {
  var d = new Date();
  var targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

const UserSchema = new Schema({
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
  privilege: { type: String, default: "admin" },
  accountStatus: { type: String, default: "false" },
  hasAccess: { type: Boolean, default: false },
  publisher: { type: Boolean, default: false },
  duration: { type: Date, default: oneMonthFromNow },
  bus_nature: { type: String, default: "none" },
  org_department: { type: String, default: "none" },
  uni_faculty: { type: String, default: "none" },
  uni_course_yr: { type: String, default: 0 },
  pref_locations: [{ type: ObjectId, ref: "loc" }],
  country: { type: String, default: "Uganda" },
  phoneNumber: { type: Number, default: 0, unique: true },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  role: {
    job_title: { type: String, default: "none" },
    org_name: { type: String, default: "none" },
  },
  product: {
    analytics: { type: Boolean, default: false },
    locate: { type: Boolean, default: false },
    admin: { type: Boolean, default: false },
  },
  notifications: {
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    text: { type: Boolean, default: false },
    phone: { type: Boolean, default: false },
  },
});

UserSchema.pre("save", function (next) {
  if (this.isModified("password")) {
    this.password = this._hashPassword(this.password);
  }
  return next();
});

// UserSchema.pre("findOneAndUpdate", function(next) {
//     if (this.isModified("password")) {
//         this.password = this._hashPassword(this.password);
//     }
//     return next();
// });

UserSchema.pre("findOneAndUpdate", function () {
  let that = this;
  const update = that.getUpdate();
  if (update.__v != null) {
    delete update.__v;
  }
  const keys = ["$set", "$setOnInsert"];
  for (const key of keys) {
    if (update[key] != null && update[key].__v != null) {
      delete update[key].__v;
      if (Object.keys(update[key]).length === 0) {
        delete update[key];
      }
    }
  }
  update.$inc = update.$inc || {};
  update.$inc.__v = 1;
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
        email: this.email,
        pref_locations: this.pref_locations,
        privilege: this.privilege,
      },
      constants.JWT_SECRET
    );
  },
  toAuthJSON() {
    return {
      _id: this._id,
      userName: this.userName,
      token: `JWT ${this.createToken()}`,
      email: this.email,
    };
  },
  toJSON() {
    return {
      _id: this._id,
      userName: this.userName,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      graph_defaults: this.graph_defaults,
      pref_locations: this.pref_locations,
      privilege: this.privilege,
      phoneNumber: this.phoneNumber,
    };
  },
};

const user = mongoose.model("user", UserSchema);

module.exports = { user, UserSchema };

// module.exports = tenantModel("user", UserSchema);

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
