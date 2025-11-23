// users.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const constants = require("@config/constants");
const ObjectId = mongoose.Types.ObjectId;

const createInterestValidation = () => [
  body("interests")
    .optional()
    .customSanitizer((value) => {
      let interests = value;
      if (interests === null || interests === undefined || interests === "") {
        return [];
      }
      if (typeof interests === "string") {
        interests = interests.trim() ? [interests.trim()] : [];
      }

      if (!Array.isArray(interests)) {
        // Let the .isArray() validator catch it if it's not a convertible type
        return interests;
      }

      const interestMap = {
        "Health Professional": "health",
        "Software Developer": "software developer",
        "Community Champion": "community champion",
        "Environmental Scientist": "environmental",
        Student: "student",
        "Policy Maker": "policy maker",
        Researcher: "researcher",
        "Air Quality Partner": "air quality partner",
      };

      return interests
        .map((interest) => {
          if (typeof interest !== "string") return "";
          const trimmedInterest = interest.trim();
          return interestMap[trimmedInterest] || trimmedInterest.toLowerCase();
        })
        .filter(Boolean);
    })
    .isArray()
    .withMessage("interests should be an array")
    .custom((value) => {
      const validInterests = [
        "health",
        "software developer",
        "community champion",
        "environmental",
        "student",
        "policy maker",
        "researcher",
        "air quality partner",
      ];
      if (value && Array.isArray(value)) {
        for (let interest of value) {
          if (!validInterests.includes(interest)) {
            throw new Error(`${interest} is not a valid interest option`);
          }
        }
      }
      return true;
    }),
  body("interestsDescription")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Interests description cannot exceed 1000 characters")
    .trim(),
  body("country")
    .optional()
    .notEmpty()
    .withMessage("country should not be empty if provided")
    .trim(),
];

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo", "airqount"])
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
    body("userName")
      .exists()
      .withMessage("the userName must be provided")
      .bail()
      .notEmpty()
      .withMessage("userName should not be empty")
      .trim(),
    body("password")
      .exists()
      .withMessage("the password must be provided")
      .bail()
      .notEmpty()
      .withMessage("password should not be empty"),
  ],
];

const loginLegacyCompatible = [
  validateTenant,
  [
    body("email")
      .exists()
      .withMessage("email is required")
      .bail()
      .notEmpty()
      .withMessage("email should not be empty")
      .bail()
      .isEmail()
      .withMessage("Invalid email format")
      .trim(),
    body("password")
      .exists()
      .withMessage("password is required")
      .bail()
      .notEmpty()
      .withMessage("password should not be empty"),
  ],
];

const validStrategies = Object.values(constants.TOKEN_STRATEGIES);

const loginEnhanced = [
  validateTenant,
  [
    body("email")
      .exists()
      .withMessage("email is required")
      .bail()
      .notEmpty()
      .withMessage("email should not be empty")
      .bail()
      .isEmail()
      .withMessage("Invalid email format")
      .trim(),
    body("password")
      .exists()
      .withMessage("password is required")
      .bail()
      .notEmpty()
      .withMessage("password should not be empty"),
    body("preferredStrategy")
      .optional()
      .notEmpty()
      .withMessage("preferredStrategy should not be empty if provided")
      .bail()
      .isIn(validStrategies)
      .withMessage(
        `Invalid token strategy provided. Valid strategies are: ${validStrategies.join(
          ", "
        )}`
      ),
    body("includeDebugInfo")
      .optional()
      .isBoolean()
      .withMessage("includeDebugInfo must be a boolean"),
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

const verifyMobileEmail = [
  validateTenant,
  [
    param("token")
      .exists()
      .withMessage("Token is required")
      .bail()
      .notEmpty()
      .withMessage("the token should not be empty")
      .bail()
      .isNumeric()
      .withMessage("Token must be numeric")
      .bail()
      .isLength({ min: 5, max: 5 })
      .withMessage("Token must be 5 digits")
      .trim(),
    body("email")
      .exists()
      .withMessage("email is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the email should not be empty")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
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
    ...createInterestValidation(),
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
      .bail()
      .customSanitizer((value) => {
        return value.toLowerCase().trim();
      }),
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
    ...createInterestValidation(),
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
    body("slug")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Invalid slug parameter. Must be a non-empty string."),
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
    ...createInterestValidation(),
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
  ...createInterestValidation(),
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

const getEnhancedProfileForUser = [
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

const resetPasswordRequest = [
  body("email")
    .exists()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .trim(),
  //Potentially add tenant validation here as well, using the oneOf approach if necessary
];

const resetPassword = [
  param("token")
    .exists()
    .withMessage("Token is required")
    .bail()
    .isNumeric()
    .withMessage("Token must be numeric")
    .isLength({ min: 5, max: 5 })
    .withMessage("Token must be 5 digits")
    .trim(),
  body("password")
    .exists()
    .withMessage("Password is required")
    .bail()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .trim(),
  body("confirmPassword")
    .exists()
    .withMessage("Confirm Password is required")
    .bail()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    })
    .trim(),
];

const getOrganizationBySlug = [
  param("org_slug")
    .exists()
    .withMessage("Organization slug is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Organization slug cannot be empty")
    .bail()
    .isAlphanumeric("en-US", { ignore: "-_" })
    .withMessage(
      "Organization slug must be alphanumeric with optional hyphens and underscores"
    ),
];

const registerViaOrgSlug = [
  param("org_slug")
    .exists()
    .withMessage("Organization slug is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Organization slug cannot be empty")
    .bail()
    .isAlphanumeric("en-US", { ignore: "-_" })
    .withMessage(
      "Organization slug must be alphanumeric with optional hyphens and underscores"
    ),
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
  body("captchaToken")
    .optional()
    .notEmpty()
    .withMessage("captchaToken should not be empty if provided"),
  ...createInterestValidation(),
];

const userCleanup = [
  validateTenant,
  [
    body("cleanupType")
      .exists()
      .withMessage("cleanupType is required")
      .bail()
      .isIn([
        "fix-missing-group-roles",
        "fix-email-casing",
        "fix-email-casing-all-collections",
      ])
      .withMessage("Invalid cleanupType specified"),
    body("dryRun")
      .optional()
      .isBoolean()
      .withMessage("dryRun must be a boolean value")
      .bail()
      .toBoolean(),
  ],
];

const generateToken = [
  validateTenant,
  [
    body("userId")
      .exists()
      .withMessage("userId is required")
      .bail()
      .notEmpty()
      .withMessage("userId should not be empty")
      .bail()
      .isMongoId()
      .withMessage("userId must be a valid Mongo ID"),
    body("strategy")
      .optional()
      .notEmpty()
      .withMessage("strategy should not be empty if provided")
      .bail()
      .isIn(validStrategies)
      .withMessage(
        `Invalid token strategy provided. Valid strategies are: ${validStrategies.join(
          ", "
        )}`
      ),
    body("options")
      .optional()
      .isObject()
      .withMessage("options must be an object"),
  ],
];

const updateTokenStrategy = [
  validateTenant,
  [
    body("userId")
      .optional()
      .notEmpty()
      .withMessage("userId should not be empty if provided")
      .bail()
      .isMongoId()
      .withMessage("userId must be a valid Mongo ID"),
    body("strategy")
      .exists()
      .withMessage("strategy is required")
      .bail()
      .notEmpty()
      .withMessage("strategy should not be empty")
      .bail()
      .isIn(validStrategies)
      .withMessage(
        `Invalid token strategy provided. Valid strategies are: ${validStrategies.join(
          ", "
        )}`
      ),
  ],
];

const refreshPermissions = [
  validateTenant,
  [
    body("userId")
      .optional()
      .notEmpty()
      .withMessage("userId should not be empty if provided")
      .bail()
      .isMongoId()
      .withMessage("userId must be a valid Mongo ID"),
    body("strategy")
      .optional()
      .notEmpty()
      .withMessage("strategy should not be empty if provided")
      .bail()
      .isIn(validStrategies)
      .withMessage(
        `Invalid token strategy provided. Valid strategies are: ${validStrategies.join(
          ", "
        )}`
      ),
  ],
];

const analyzeTokenStrategies = [
  validateTenant,
  [
    param("userId")
      .exists()
      .withMessage("userId is required")
      .bail()
      .notEmpty()
      .withMessage("userId should not be empty")
      .bail()
      .isMongoId()
      .withMessage("userId must be a valid Mongo ID"),
  ],
];

const getContextPermissions = [
  validateTenant,
  [
    query("userId")
      .optional()
      .isMongoId()
      .withMessage("userId must be a valid Mongo ID"),
    query("contextId")
      .optional()
      .isMongoId()
      .withMessage("contextId must be a valid Mongo ID"),
    query("contextType")
      .optional()
      .isIn(["group", "network"])
      .withMessage("contextType must be either 'group' or 'network'"),
  ],
];

const debugPermissions = [
  validateTenant,
  [
    param("userId")
      .exists()
      .withMessage("userId is required")
      .bail()
      .notEmpty()
      .withMessage("userId should not be empty")
      .bail()
      .isMongoId()
      .withMessage("userId must be a valid Mongo ID"),
  ],
];

const initiateAccountDeletion = [
  validateTenant,
  [
    body("email")
      .exists()
      .withMessage("email is required")
      .bail()
      .notEmpty()
      .withMessage("email should not be empty")
      .bail()
      .isEmail()
      .withMessage("Invalid email format")
      .trim(),
  ],
];

const confirmAccountDeletion = [
  validateTenant,
  [
    param("token")
      .exists()
      .withMessage("The deletion token is missing in the request")
      .bail()
      .notEmpty()
      .withMessage("token should not be empty")
      .trim()
      .isHexadecimal()
      .withMessage("token must be a hexadecimal string")
      .isLength({ min: 40, max: 40 })
      .withMessage("token must be 40 characters long"),
  ],
];

const confirmMobileAccountDeletion = [
  validateTenant,
  [
    body("token")
      .exists()
      .withMessage("The deletion token is missing in the request")
      .bail()
      .notEmpty()
      .withMessage("token should not be empty")
      .trim()
      .isNumeric()
      .withMessage("token must be a numeric string")
      .isLength({ min: 5, max: 5 })
      .withMessage("token must be 5 characters long"),
  ],
];

const updateConsent = [
  validateTenant,
  [
    body("analytics")
      .exists()
      .withMessage("the analytics field is required")
      .isBoolean()
      .withMessage("the analytics field must be a boolean"),
  ],
];

const assignCohorts = [
  validateTenant,
  param("user_id")
    .exists()
    .withMessage("the user ID param is missing in the request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the user ID must be an object ID"),
  body("cohort_ids")
    .exists()
    .withMessage("cohort_ids are required")
    .isArray({ min: 1 })
    .withMessage("cohort_ids must be a non-empty array of ObjectIDs"),
  body("cohort_ids.*").isMongoId().withMessage("Each ID must be a valid ID"),
];

module.exports = {
  tenant: validateTenant,
  AirqoTenantOnly: validateAirqoTenantOnly,
  pagination,
  deleteMobileUserData,
  loginEnhanced,
  loginLegacyCompatible,
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
  getEnhancedProfileForUser,
  resetPasswordRequest,
  resetPassword,
  verifyMobileEmail,
  getOrganizationBySlug,
  registerViaOrgSlug,
  userCleanup,
  generateToken,
  updateTokenStrategy,
  refreshPermissions,
  analyzeTokenStrategies,
  getContextPermissions,
  debugPermissions,
  initiateAccountDeletion,
  confirmAccountDeletion,
  confirmMobileAccountDeletion,
  updateConsent,
  assignCohorts,
};
