// users.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo"])
    .withMessage("the tenant value is not among the expected ones"),
]);

const validateAirqoTenantOnly = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["airqo"])
    .withMessage("the tenant value is not among the expected ones"),
]);

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  if (Number.isNaN(limit) || limit < 1) {
    req.query.limit = 100;
  } else if (limit > 500) {
    req.query.limit = 500;
  }
  if (Number.isNaN(skip) || skip < 0) {
    req.query.skip = 0;
  }
  next();
};

const deleteMobileUserData = [
  param("userId")
    .exists()
    .withMessage("the userId is missing in the request")
    .bail(),
  param("token")
    .exists()
    .withMessage("The deletion token is missing in the request")
    .bail(),
];

const login = [
  validateTenant,
  [
    body("userName").exists().withMessage("the userName must be provided"),
    body("password").exists().withMessage("the password must be provided"),
  ],
];

const emailLogin = [
  [
    body("email")
      .exists()
      .withMessage("the email must be provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address"),
  ],
];

const emailAuth = [
  [
    body("email")
      .exists()
      .withMessage("the email must be provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address"),
  ],
  [
    param("purpose")
      .optional()
      .notEmpty()
      .withMessage("The purpose should not be empty if provided"),
  ],
];

const feedback = oneOf([
  [
    body("email")
      .exists()
      .withMessage("the email must be provided")
      .bail()
      .notEmpty()
      .withMessage("the email must not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address"),
    body("subject")
      .exists()
      .withMessage("the subject must be provided")
      .bail()
      .notEmpty()
      .withMessage("the subject must not be empty if provided"),
    body("message")
      .exists()
      .withMessage("the message must be provided")
      .bail()
      .notEmpty()
      .withMessage("the message must not be empty if provided"),
  ],
]);

const firebaseLookup = oneOf([
  body("email")
    .exists()
    .withMessage(
      "the user identifier is missing in request, consider using the email"
    )
    .bail()
    .notEmpty()
    .withMessage("the email must not be empty if provided")
    .bail()
    .isEmail()
    .withMessage("this is not a valid email address"),
  body("phoneNumber")
    .exists()
    .withMessage(
      "the user identifier is missing in request, consider using the phoneNumber"
    )
    .bail()
    .notEmpty()
    .withMessage("the phoneNumber must not be empty if provided")
    .bail()
    .isMobilePhone()
    .withMessage("the phoneNumber must be valid"),
]);

const firebaseCreate = oneOf([
  body("email")
    .exists()
    .withMessage(
      "the user identifier is missing in request, consider using the email"
    )
    .bail()
    .notEmpty()
    .withMessage("the email must not be empty if provided")
    .bail()
    .isEmail()
    .withMessage("this is not a valid email address"),
  body("phoneNumber")
    .exists()
    .withMessage(
      "the user identifier is missing in request, consider using the phoneNumber"
    )
    .bail()
    .notEmpty()
    .withMessage("the phoneNumber must not be empty if provided")
    .bail()
    .isMobilePhone()
    .withMessage("the phoneNumber must be valid"),
]);

const firebaseLogin = oneOf([
  body("email")
    .exists()
    .withMessage(
      "the user identifier is missing in request, consider using the email"
    )
    .bail()
    .notEmpty()
    .withMessage("the email must not be empty if provided")
    .bail()
    .isEmail()
    .withMessage("this is not a valid email address"),
  body("phoneNumber")
    .exists()
    .withMessage(
      "the user identifier is missing in request, consider using the phoneNumber"
    )
    .bail()
    .notEmpty()
    .withMessage("the phoneNumber must not be empty if provided")
    .bail()
    .isMobilePhone()
    .withMessage("the phoneNumber must be valid"),
]);

const firebaseSignup = oneOf([
  body("email")
    .exists()
    .withMessage(
      "the user identifier is missing in request, consider using the email"
    )
    .bail()
    .notEmpty()
    .withMessage("the email must not be empty if provided")
    .bail()
    .isEmail()
    .withMessage("this is not a valid email address"),
  body("phoneNumber")
    .exists()
    .withMessage(
      "the user identifier is missing in request, consider using the phoneNumber"
    )
    .bail()
    .notEmpty()
    .withMessage("the phoneNumber must not be empty if provided")
    .bail()
    .isMobilePhone()
    .withMessage("the phoneNumber must be valid"),
]);

const syncAnalyticsAndMobile = oneOf([
  body("firebase_uid")
    .exists()
    .withMessage(
      "the firebase_uid is missing in body, consider using firebase_uid"
    )
    .bail()
    .notEmpty()
    .withMessage("the firebase_uid must not be empty")
    .bail()
    .trim(),
  body("email")
    .exists()
    .withMessage("the email is missing in body, consider using email")
    .bail()
    .notEmpty()
    .withMessage("the email is missing in body, consider using email")
    .bail()
    .isEmail()
    .withMessage("this is not a valid email address"),
  body("phoneNumber")
    .optional()
    .notEmpty()
    .withMessage("the phoneNumber must not be empty if provided")
    .bail()
    .isMobilePhone()
    .withMessage("the phoneNumber must be valid"),
  body("firstName").optional().trim(),
  body("lastName").optional().trim(),
]);

const emailReport = oneOf([
  body("senderEmail")
    .exists()
    .withMessage("senderEmail is missing in your request")
    .bail()
    .notEmpty()
    .withMessage("senderEmail should not be empty")
    .bail()
    .isEmail()
    .withMessage("senderEmail is not valid"),

  body("recepientEmails").isArray().withMessage("emails should be an array"),

  body("recepientEmails.*")
    .exists()
    .withMessage("An email is missing in the array")
    .bail()
    .notEmpty()
    .withMessage("An email in the array is empty")
    .bail()
    .isEmail()
    .withMessage("One or more emails in the array are not valid"),
]);

const firebaseVerify = [
  validateTenant,
  [
    body("token")
      .exists()
      .withMessage("the token is missing in the request body")
      .bail()
      .notEmpty()
      .withMessage("the token should not be empty")
      .trim(),
  ],
  oneOf([
    body("email")
      .exists()
      .withMessage(
        "a user identifier is missing in request, consider using email"
      )
      .bail()
      .notEmpty()
      .withMessage("the email should not be empty")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address"),
    body("phoneNumber")
      .exists()
      .withMessage(
        "a user identifier is missing in request, consider using phoneNumber"
      )
      .bail()
      .notEmpty()
      .withMessage("the phoneNumber should not be empty")
      .bail()
      .isMobilePhone()
      .withMessage("the phoneNumber must be valid"),
  ]),
];

const verifyEmail = [
  validateTenant,

  [
    param("user_id")
      .exists()
      .withMessage("the user ID param is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user ID must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    param("token")
      .exists()
      .withMessage("the token param is missing in the request")
      .bail()
      .trim(),
  ],
];

const registerUser = [
  validateTenant,
  [
    body("firstName")
      .exists()
      .withMessage("firstName is missing in your request")
      .bail()
      .trim(),
    body("lastName")
      .exists()
      .withMessage("lastName is missing in your request")
      .bail()
      .trim(),
    body("email")
      .exists()
      .withMessage("email is missing in your request")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("organization")
      .exists()
      .withMessage("organization is missing in your request")
      .bail()
      .trim(),
    body("long_organization")
      .exists()
      .withMessage("long_organization is missing in your request")
      .bail()
      .trim(),
    body("privilege")
      .optional()
      .notEmpty()
      .withMessage("privilege should not be empty if provided")
      .bail()
      .isIn(["admin", "netmanager", "user", "super"])
      .withMessage("the privilege value is not among the expected ones")
      .trim(),
  ],
];

const createUser = [
  validateTenant,
  [
    body("firstName")
      .exists()
      .withMessage("firstName is missing in your request")
      .bail()
      .trim(),
    body("lastName")
      .exists()
      .withMessage("lastName is missing in your request")
      .bail()
      .trim(),
    body("category")
      .exists()
      .withMessage("category is missing in your request")
      .bail()
      .isIn(["individual", "organisation"])
      .withMessage(
        "the category value is not among the expected ones: individual, organisation"
      )
      .trim(),
    body("email")
      .exists()
      .withMessage("email is missing in your request")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("organization")
      .optional()
      .notEmpty()
      .withMessage("organization should not be empty if provided")
      .bail()
      .trim(),
    body("long_organization")
      .optional()
      .notEmpty()
      .withMessage("long_organization should not be empty if provided")
      .bail()
      .trim(),
    body("privilege")
      .optional()
      .notEmpty()
      .withMessage("privilege should not be empty if provided")
      .bail()
      .isIn(["admin", "netmanager", "user", "super"])
      .withMessage("the privilege value is not among the expected ones")
      .trim(),
    body("password")
      .exists()
      .withMessage("password is missing in your request")
      .bail()
      .trim()
      .isLength({ min: 6, max: 30 })
      .withMessage("Password must be between 6 and 30 characters long")
      .bail()
      .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#?!$%^&*,.]{6,}$/)
      .withMessage("Password must contain at least one letter and one number"),
  ],
];

const updatePasswordViaEmail = [
  validateTenant,
  [
    body("resetPasswordToken")
      .exists()
      .withMessage("the resetPasswordToken must be provided")
      .trim(),
    body("password")
      .exists()
      .withMessage("the password must be provided")
      .trim(),
  ],
];

const updatePassword = [
  validateTenant,
  [
    query("id")
      .exists()
      .withMessage("the user ID must be provided")
      .trim()
      .bail()
      .isMongoId()
      .withMessage("the user ID must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("old_password")
      .exists()
      .withMessage("the old_password must be provided")
      .trim(),
    body("password")
      .exists()
      .withMessage("the password must be provided")
      .trim(),
  ],
];

const forgotPassword = [
  validateTenant,
  [
    body("email")
      .exists()
      .withMessage("the email must be provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("version")
      .optional()
      .notEmpty()
      .withMessage("version should not be empty IF provided")
      .trim()
      .bail()
      .isNumeric()
      .withMessage("the provided version should be a number"),
  ],
];

const updateUser = [
  validateTenant,
  [
    query("id")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  [
    body("networks")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the networks should be an array")
      .bail()
      .notEmpty()
      .withMessage("the networks should not be empty"),
    body("networks.*")
      .optional()
      .isMongoId()
      .withMessage("each network should be an object ID"),
  ],
];

const updateUserById = [
  validateTenant,
  [
    param("user_id")
      .exists()
      .withMessage("the user ID parameter is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  [
    body("networks")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the networks should be an array")
      .bail()
      .notEmpty()
      .withMessage("the networks should not be empty"),
    body("networks.*")
      .optional()
      .isMongoId()
      .withMessage("each network should be an object ID"),
  ],
];

const deleteUser = [
  validateTenant,
  [
    query("id")
      .exists()
      .withMessage("the user ID must be provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const deleteUserById = [
  validateTenant,
  [
    param("user_id")
      .exists()
      .withMessage("the user ID parameter is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const newsletterSubscribe = [
  validateTenant,
  [
    body("email")
      .exists()
      .withMessage("the email must be provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("tags")
      .optional()
      .notEmpty()
      .withMessage("the tags should not be empty if provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the tags should be an array"),
    body("firstName")
      .optional()
      .notEmpty()
      .withMessage("the provided firstName should not be empty IF provided")
      .bail()
      .trim(),
    body("lastName")
      .optional()
      .notEmpty()
      .withMessage("the provided lastName should not be empty IF provided")
      .bail()
      .trim(),
    body("address")
      .optional()
      .notEmpty()
      .withMessage("the provided address should not be empty IF provided")
      .bail()
      .trim(),
    body("city")
      .optional()
      .notEmpty()
      .withMessage("the provided city should not be empty IF provided")
      .bail()
      .trim(),
    body("state")
      .optional()
      .notEmpty()
      .withMessage("the provided state should not be empty IF provided")
      .bail()
      .trim(),
    body("zipCode")
      .optional()
      .notEmpty()
      .withMessage("the provided zipCode should not be empty IF provided")
      .bail()
      .trim(),
  ],
];

const newsletterResubscribe = [
  validateTenant,
  [
    body("email")
      .exists()
      .withMessage("the email must be provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
  ],
];

const newsletterUnsubscribe = [
  validateTenant,
  [
    body("email")
      .exists()
      .withMessage("the email must be provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
  ],
];

const cache = [validateAirqoTenantOnly];

const subscribeToNotifications = [
  validateAirqoTenantOnly,
  oneOf([
    body("email")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the email"
      )
      .bail()
      .notEmpty()
      .withMessage("the email must not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("user_id")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the user_id"
      )
      .bail()
      .notEmpty()
      .withMessage("the user_id must not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  [
    param("type")
      .exists()
      .withMessage("the type must be provided")
      .bail()
      .notEmpty()
      .withMessage("the type should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["email", "phone", "push", "text"])
      .withMessage(
        "the type value is not among the expected ones: email, phone, push and text"
      ),
  ],
];

const unSubscribeFromNotifications = [
  validateAirqoTenantOnly,
  oneOf([
    body("email")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the email"
      )
      .bail()
      .notEmpty()
      .withMessage("the email must not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("user_id")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the user_id"
      )
      .bail()
      .notEmpty()
      .withMessage("the user_id must not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  [
    param("type")
      .exists()
      .withMessage("the type must be provided")
      .bail()
      .notEmpty()
      .withMessage("the type should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["email", "phone", "push", "text"])
      .withMessage(
        "the type value is not among the expected ones: email, phone, push and text"
      ),
  ],
];

const notificationStatus = [
  validateAirqoTenantOnly,
  oneOf([
    body("email")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the email"
      )
      .bail()
      .notEmpty()
      .withMessage("the email must not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("user_id")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the user_id"
      )
      .bail()
      .notEmpty()
      .withMessage("the user_id must not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  [
    param("type")
      .exists()
      .withMessage("the type must be provided")
      .bail()
      .notEmpty()
      .withMessage("the type should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["email", "phone", "push", "text"])
      .withMessage(
        "the type value is not among the expected ones: email, phone, push and text"
      ),
  ],
];

const getUser = [
  validateTenant,
  [
    param("user_id")
      .exists()
      .withMessage("the user ID param is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user ID must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

module.exports = {
  tenant: validateTenant,
  AirqoTenantOnly: validateAirqoTenantOnly,
  pagination,
  deleteMobileUserData,
  login,
  emailLogin,
  emailAuth,
  feedback,
  firebaseLookup,
  firebaseCreate,
  firebaseLogin,
  firebaseSignup,
  syncAnalyticsAndMobile,
  emailReport,
  firebaseVerify,
  verifyEmail,
  registerUser,
  createUser,
  updatePasswordViaEmail,
  updatePassword,
  forgotPassword,
  updateUser,
  updateUserById,
  deleteUser,
  deleteUserById,
  newsletterSubscribe,
  newsletterResubscribe,
  newsletterUnsubscribe,
  cache,
  subscribeToNotifications,
  unSubscribeFromNotifications,
  notificationStatus,
  getUser,
};
