const UserModel = require("@models/User");
const SubscriptionModel = require("@models/Subscription");
const DashboardAnalyticsModel = require("@models/DashboardAnalytics");
const VerifyTokenModel = require("@models/VerifyToken");
const AccessRequestModel = require("@models/AccessRequest");
const RoleModel = require("@models/Role");
const PermissionModel = require("@models/Permission");
const { LogModel } = require("@models/log");
const NetworkModel = require("@models/Network");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const crypto = require("crypto");
const isEmpty = require("is-empty");
const { getAuth } = require("firebase-admin/auth");
const httpStatus = require("http-status");
const analyticsService = require("@services/analytics.service");
const constants = require("@config/constants");
const mailchimp = require("@config/mailchimp");
const md5 = require("md5");
const accessCodeGenerator = require("generate-password");
const createGroupUtil = require("@utils/group.util.js");
const registrationLocks = new Map();
const moment = require("moment-timezone");
const admin = require("firebase-admin");
const { db } = require("@config/firebase-admin");
const {
  redisGetAsync,
  redisSetAsync,
  redisExpireAsync,
  redisDelAsync,
  redisSetWithTTLAsync,
} = require("@config/redis");
const { tokenConfig } = require("@config/tokenStrategyConfig");

const log4js = require("log4js");
const GroupModel = require("@models/Group");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- user util`);
const { logObject, logText, HttpError, stringify } = require("@utils/shared");

const {
  mailer,
  generateFilter,
  generateDateFormatWithoutHrs,
} = require("@utils/common");

const RBACService = require("@services/rbac.service");
const { AbstractTokenFactory } = require("@services/atf.service");

function generateNumericToken(length) {
  const charset = "0123456789";
  let token = "";

  const byteLength = Math.ceil(length * 0.5); // Each byte can represent two characters from the charset

  while (token.length < length) {
    const randomBytes = crypto.randomBytes(byteLength);

    for (let i = 0; i < randomBytes.length && token.length < length; i++) {
      const randomIndex = randomBytes[i] % charset.length;
      token += charset[randomIndex];
    }
  }

  return token;
}

const normalizeName = (name) => {
  if (!name || typeof name !== "string") {
    return "";
  }
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_\s-]/g, "") // Keep underscores, spaces, hyphens
    .replace(/[\s-]+/g, "_") // Replace spaces and hyphens with a single underscore
    .replace(/_+/g, "_"); // Collapse multiple underscores into one
};
async function deleteCollection({ db, collectionPath, batchSize } = {}) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy("__name__").limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch({ db, query, batchSize, resolve, reject });
  });
}
function deleteQueryBatch({ db, query, batchSize, resolve, reject } = {}) {
  query
    .get()
    .then((snapshot) => {
      // When there are no documents left, we are done
      if (snapshot.size === 0) {
        return 0;
      }

      // Delete documents in a batch
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      return batch.commit().then(() => {
        return snapshot.size;
      });
    })
    .then((numDeleted) => {
      if (numDeleted === 0) {
        resolve();
        return;
      }

      // Recurse on the next process tick, to avoid
      // exploding the stack.
      process.nextTick(() => {
        deleteQueryBatch({ db, query, batchSize, resolve, reject });
      });
    })
    .catch(reject);
}

const cascadeUserDeletion = async ({ userId, tenant } = {}) => {
  try {
    const dbTenant = tenant ? String(tenant).toLowerCase() : tenant;
    const user = await UserModel(dbTenant).findById(userId).lean();

    if (isEmpty(user)) {
      throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
        message: `User ${userId} not found in the system`,
      });
    }

    const updatedGroup = await GroupModel(dbTenant).updateMany(
      { grp_manager: userId },
      {
        $set: {
          grp_manager: null,
          grp_manager_username: null,
          grp_manager_firstname: null,
          grp_manager_lastname: null,
        },
      }
    );

    if (!isEmpty(updatedGroup.err)) {
      logger.error(
        `error while attempting to delete User from the corresponding Group ${stringify(
          updatedGroup.err
        )}`
      );
    }

    const updatedNetwork = await NetworkModel(dbTenant).updateMany(
      { net_manager: userId },
      {
        $set: {
          net_manager: null,
          net_manager_username: null,
          net_manager_firstname: null,
          net_manager_lastname: null,
        },
      }
    );

    if (!isEmpty(updatedNetwork.err)) {
      logger.error(
        `error while attempting to delete User from the corresponding Network ${stringify(
          updatedNetwork.err
        )}`
      );
    }

    return {
      success: true,
      message: "Successfully Cascaded the User deletion",
      data: [],
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error --- ${stringify(error)}`);
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(
      "Internal Server Error",
      httpStatus.INTERNAL_SERVER_ERROR,
      { message: error.message }
    );
  }
};

const generateCacheID = (request, next) => {
  const {
    privilege,
    id,
    userName,
    active,
    email_address,
    role_id,
    email,
    resetPasswordToken,
    user,
    user_id,
  } = { ...request.body, ...request.query, ...request.params };
  const currentTime = new Date().toISOString();
  const day = generateDateFormatWithoutHrs(currentTime, next);
  return `list_users_${privilege ? privilege : "no_privilege"}_${
    id ? id : "no_id"
  }_${userName ? userName : "no_userName"}_${active ? active : "no_active"}_${
    email_address ? email_address : "no_email_address"
  }_${role_id ? role_id : "no_role_id"}_${email ? email : "no_email"}_${
    resetPasswordToken ? resetPasswordToken : "no_resetPasswordToken"
  }_${user ? user : "no_user"}_${user_id ? user_id : "no_user_id"}_${
    day ? day : "noDay"
  }`;
};
const setCache = async ({ data, request } = {}, next) => {
  try {
    const cacheID = generateCacheID(request, next);
    await redisSetAsync(
      cacheID,
      stringify({
        isCache: true,
        success: true,
        message: "Successfully retrieved the users",
        data,
      })
    );
    // FIX: Change from 0 to 600 (10 minutes = 600 seconds)
    await redisExpireAsync(cacheID, 600); // 10 minutes = 600 seconds

    return {
      success: true,
      message: "Response stored in cache",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
const getCache = async (request, next) => {
  try {
    const cacheID = generateCacheID(request, next);
    logObject("cacheID", cacheID);

    const result = await redisGetAsync(cacheID);

    logObject("result", result);
    const resultJSON = JSON.parse(result);
    logObject("resultJSON", resultJSON);

    if (result) {
      return {
        success: true,
        message: "Utilizing cache...",
        data: resultJSON,
        status: httpStatus.OK,
      };
    } else {
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: "No cache present",
          }
        )
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const createUserModule = {
  _validatePassword: (password) => {
    if (!password || !constants.PASSWORD_REGEX.test(password)) {
      return {
        isValid: false,
        error: new HttpError("Validation Error", httpStatus.BAD_REQUEST, {
          message:
            "The password does not meet the security requirements. It must be at least 6 characters long and contain at least one letter and one number.",
        }),
      };
    }
    return { isValid: true };
  },
  _getEnhancedProfile: async ({ userId, tenant }, next) => {
    try {
      // Get user permissions context
      const permissionsRequest = {
        body: { userId },
        query: { tenant },
      };

      const permissionsResult =
        await createUserModule.getUserContextPermissions(
          permissionsRequest,
          next
        );

      if (!permissionsResult.success) {
        logger.error("Failed to get user permissions for profile", {
          userId,
          tenant,
          error: permissionsResult.message,
        });
        return permissionsResult;
      }

      // Get basic user data
      const basicUser = await UserModel(tenant)
        .findById(userId)
        .select("-password -resetPasswordToken -resetPasswordExpires")
        .lean();

      if (!basicUser) {
        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "User profile not found" },
        };
      }

      // Manually populate group_roles.group if they exist
      let populatedUser = { ...basicUser };

      if (basicUser.group_roles && basicUser.group_roles.length > 0) {
        try {
          const GroupModel = require("@models/Group");
          const groupIds = basicUser.group_roles.map((gr) => gr.group);

          const groups = await GroupModel(tenant)
            .find({ _id: { $in: groupIds } })
            .select("grp_title grp_status organization_slug")
            .lean();

          populatedUser.group_roles = basicUser.group_roles.map(
            (groupRole) => ({
              ...groupRole,
              group:
                groups.find(
                  (g) => g._id.toString() === groupRole.group.toString()
                ) || groupRole.group,
            })
          );
        } catch (error) {
          logger.warn(`Could not populate group roles: ${error.message}`);
          populatedUser.group_roles = basicUser.group_roles;
        }
      }

      // Manually populate network_roles.network if they exist
      if (basicUser.network_roles && basicUser.network_roles.length > 0) {
        try {
          const NetworkModel = require("@models/Network");
          const networkIds = basicUser.network_roles.map((nr) => nr.network);

          const networks = await NetworkModel(tenant)
            .find({ _id: { $in: networkIds } })
            .select("net_name net_status net_acronym")
            .lean();

          populatedUser.network_roles = basicUser.network_roles.map(
            (networkRole) => ({
              ...networkRole,
              network:
                networks.find(
                  (n) => n._id.toString() === networkRole.network.toString()
                ) || networkRole.network,
            })
          );
        } catch (error) {
          logger.warn(`Could not populate network roles: ${error.message}`);
          populatedUser.network_roles = basicUser.network_roles;
        }
      }

      const user = populatedUser;

      const enhancedProfile = {
        ...user,
        ...permissionsResult.data.permissions,
        profileLastUpdated: new Date().toISOString(),
        hasEnhancedPermissions: true,
        contextSummary: {
          totalPermissions:
            permissionsResult.data.permissions?.allPermissions?.length || 0,
          groupMemberships:
            permissionsResult.data.permissions?.groupMemberships?.length || 0,
          networkMemberships:
            permissionsResult.data.permissions?.networkMemberships?.length || 0,
          isSuperAdmin:
            permissionsResult.data.permissions?.isSuperAdmin || false,
        },
      };

      return {
        success: true,
        message: "Enhanced profile retrieved successfully",
        data: enhancedProfile,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 _getEnhancedProfile util error: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Failed to retrieve enhanced profile" },
      };
    }
  },

  listLogs: async (request, next) => {
    try {
      const { tenant, limit = 1000, skip = 0 } = request.query;
      const filter = generateFilter.logs(request, next);
      const responseFromListLogs = await LogModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      if (responseFromListLogs.success === true) {
        return {
          success: true,
          message: responseFromListLogs.message,
          data: responseFromListLogs.data,
          status: responseFromListLogs.status
            ? responseFromListLogs.status
            : httpStatus.OK,
        };
      } else if (responseFromListLogs.success === false) {
        const errorObject = responseFromListLogs.errors
          ? responseFromListLogs.errors
          : { message: "Internal Server Error" };
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: responseFromListLogs.message,
              ...errorObject,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listStatistics: async (tenant, next) => {
    try {
      const responseFromListStatistics = await UserModel(tenant).listStatistics(
        tenant
      );
      return responseFromListStatistics;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listUsersAndAccessRequests: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.users(request, next);
      const combinedData = await UserModel(tenant)
        .aggregate([
          {
            $lookup: {
              from: "access_requests",
              localField: "email",
              foreignField: "email",
              as: "accessRequests",
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              isActive: 1,
              jobTitle: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              verified: 1,
              accessRequests: {
                $cond: [
                  {
                    $eq: [{ $size: "$accessRequests" }, 0],
                  },
                  [null],
                  {
                    $map: {
                      input: "$accessRequests",
                      as: "ar",
                      in: {
                        _id: "$$ar._id",
                        status: "$$ar.status",
                        targetId: "$$ar.targetId",
                        requestType: "$$ar.requestType",
                        createdAt: "$$ar.createdAt",
                      },
                    },
                  },
                ],
              },
            },
          },
        ])
        .match(filter)
        .exec();

      return {
        success: true,
        message: "User and access request data retrieved successfully",
        data: combinedData,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listCache: async (request, next) => {
    try {
      return {
        success: false,
        status: httpStatus.SERVICE_UNAVAILABLE,
        message: "Service Unavailable",
        errors: { message: "Service Temporarily Disabled" },
      };
      let missingDataMessage = "";
      const { query } = request;
      const { tenant, limit, skip } = query;

      try {
        const cacheResult = await Promise.race([
          getCache(request),
          new Promise((resolve) =>
            setTimeout(resolve, 60000, {
              success: false,
              message: "Internal Server Error",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: { message: "Cache timeout" },
            })
          ),
        ]);

        logObject("Cache result", cacheResult);

        if (cacheResult.success === true) {
          logText(cacheResult.message);
          return cacheResult.data;
        }
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Errors -- ${stringify(error)}`);
      }

      const filter = generateFilter.users(request, next);
      const responseFromListUser = await UserModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );

      if (responseFromListUser.success === true) {
        const data = responseFromListUser.data;
        logObject("data", data);
        data[0].data = !isEmpty(missingDataMessage) ? [] : data[0].data;

        logText("Setting cache...");

        try {
          const resultOfCacheOperation = await Promise.race([
            setCache(data, request),
            new Promise((resolve) =>
              setTimeout(resolve, 60000, {
                success: false,
                message: "Internal Server Error",
                status: httpStatus.INTERNAL_SERVER_ERROR,
                errors: { message: "Cache timeout" },
              })
            ),
          ]);
          if (resultOfCacheOperation.success === false) {
            const errors = resultOfCacheOperation.errors
              ? resultOfCacheOperation.errors
              : { message: "Internal Server Error" };
            logger.error(`🐛🐛 Internal Server Error -- ${stringify(errors)}`);
          }
        } catch (error) {
          logger.error(`🐛🐛 Internal Server Errors -- ${stringify(error)}`);
        }

        logText("Cache set.");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data[0].data)
            ? "no users for this search"
            : responseFromListUser.message,
          data,
          status: responseFromListUser.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(
            responseFromListUser.errors
          )}`
        );

        const errorObject = responseFromListUser.errors || { message: "" };
        next(
          new HttpError(
            "Internal Server Error",
            responseFromListUser.status || httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: responseFromListUser.message,
              ...errorObject,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      const filter = generateFilter.users(request, next);
      const responseFromListUser = await UserModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );

      return responseFromListUser;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getDetailedUserInfo: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const { user_id } = params;

      const filter = { _id: user_id };
      const responseFromListUser = await UserModel(tenant).list(
        {
          filter,
          limit: 1,
          skip: 0,
        },
        next
      );

      return responseFromListUser;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  update: async (request, next) => {
    try {
      const { query, body, params } = request;
      const { tenant } = { ...body, ...query, ...params };
      const dbTenant = tenant ? String(tenant).toLowerCase() : tenant;

      // 1. Create a sanitized copy of the body for the database update.
      const sanitizedUpdate = { ...body };

      // Comprehensive sanitization for 'interests' field
      if ("interests" in sanitizedUpdate) {
        const interestsValue = sanitizedUpdate.interests;
        if (typeof interestsValue === "string") {
          // If it's a string, trim it. If it's not empty, put it in an array. Otherwise, empty array.
          sanitizedUpdate.interests = interestsValue.trim()
            ? [interestsValue.trim()]
            : [];
        } else if (Array.isArray(interestsValue)) {
          // If it's an array, ensure all elements are strings and filter out any empty ones.
          sanitizedUpdate.interests = interestsValue
            .map((item) => (item ? String(item).trim() : ""))
            .filter(Boolean);
        } else {
          // If it's null, undefined, or another type, remove it from the update payload.
          delete sanitizedUpdate.interests;
        }
      }

      // Drop any keys with undefined values to prevent them from being written to the DB
      Object.keys(sanitizedUpdate).forEach((key) => {
        if (sanitizedUpdate[key] === undefined) {
          delete sanitizedUpdate[key];
        }
      });

      // Fields that should never be updated via this endpoint.
      delete sanitizedUpdate.password;
      delete sanitizedUpdate._id;
      delete sanitizedUpdate.user_id;
      delete sanitizedUpdate.id;
      delete sanitizedUpdate.email;
      delete sanitizedUpdate.userName;

      if (Object.keys(sanitizedUpdate).length === 0) {
        return {
          success: false,
          message: "No updatable fields provided",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Payload contains no mutable fields" },
        };
      }

      // 2. Generate the filter to find the user.
      const filter = generateFilter.users(request, next);
      const user = await UserModel(dbTenant)
        .findOne(filter)
        .lean()
        .select("email firstName lastName");

      if (!user) {
        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "User not found" },
        };
      }

      // 3. Perform the database modification.
      const responseFromModifyUser = await UserModel(dbTenant).modify(
        {
          filter,
          update: { $set: sanitizedUpdate },
        },
        next
      );

      logObject("responseFromModifyUser", responseFromModifyUser);

      if (responseFromModifyUser.success === true) {
        // 4. Prepare the payload for the email notification.
        const emailUpdatePayload = { ...sanitizedUpdate };

        const apiResponseData = responseFromModifyUser.data.toJSON
          ? responseFromModifyUser.data.toJSON()
          : responseFromModifyUser.data;

        if (
          constants.ENVIRONMENT &&
          constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT"
        ) {
          return {
            success: true,
            message: responseFromModifyUser.message,
            data: apiResponseData,
          };
        } else {
          const { email, firstName, lastName } = user;

          const responseFromSendEmail = await mailer.update(
            {
              email,
              firstName,
              lastName,
              updatedUserDetails: emailUpdatePayload,
            },
            next
          );

          if (responseFromSendEmail && responseFromSendEmail.success === true) {
            return {
              success: true,
              message: responseFromModifyUser.message,
              data: apiResponseData,
            };
          } else if (
            responseFromSendEmail &&
            responseFromSendEmail.success === false
          ) {
            return responseFromSendEmail;
          } else {
            logger.error("mailer.update did not return a response");
            return next(
              new HttpError(
                "Internal Server Error",
                httpStatus.INTERNAL_SERVER_ERROR,
                { message: "Failed to send update email" }
              )
            );
          }
        }
      } else {
        return responseFromModifyUser;
      }
    } catch (error) {
      logObject("the util error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  lookUpFirebaseUser: async (request, next) => {
    try {
      const { body } = request;
      const { email, phoneNumber, providerId, providerUid } = body;
      let userIdentificationArray = [];

      if (isEmpty(email) && !isEmpty(phoneNumber)) {
        userIdentificationArray.push({ phoneNumber });
      } else if (!isEmpty(email) && isEmpty(phoneNumber)) {
        userIdentificationArray.push({ email });
      } else {
        userIdentificationArray.push({ phoneNumber });
        userIdentificationArray.push({ email });
      }

      const getUsersResult = await getAuth().getUsers(userIdentificationArray);
      logObject("getUsersResult", getUsersResult);

      const successResponses = getUsersResult.users.map((userRecord) => ({
        success: true,
        message: "Successfully fetched user data",
        status: httpStatus.OK,
        data: [],
        userRecord,
      }));

      const errorResponses = getUsersResult.notFound.map((user_identifier) => ({
        success: false,
        message: "Unable to find users corresponding to these identifiers",
        status: httpStatus.NOT_FOUND,
        data: user_identifier,
      }));

      return [...successResponses, ...errorResponses];
    } catch (error) {
      logObject("Internal Server Error", error);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      // return [
      //   {
      //     success: false,
      //     message: "Internal Server Error",
      //     status: httpStatus.INTERNAL_SERVER_ERROR,
      //     errors: { message: error.message },
      //   },
      // ];
    }
  },
  createFirebaseUser: async (request, next) => {
    try {
      const { body } = request;
      const { email, password, phoneNumber } = body;
      logText("createFirebaseUser util......");

      // Check if either email or phoneNumber is provided
      if (isEmpty(email) && isEmpty(phoneNumber)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Please provide either email or phoneNumber",
          })
        );
        // return [
        //   {
        //     success: false,
        //     message: "Please provide either email or phoneNumber",
        //     status: httpStatus.BAD_REQUEST,
        //   },
        // ];
      }

      if (!isEmpty(email) && isEmpty(phoneNumber) && isEmpty(password)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "password must be provided when using email",
          })
        );

        // return [
        //   {
        //     success: false,
        //     message: "Bad Request",
        //     errors: { message: "password must be provided when using email" },
        //     status: httpStatus.BAD_REQUEST,
        //   },
        // ];
      }

      // Create the user object with either email or phoneNumber
      let userObject;
      if (!isEmpty(email)) {
        userObject = {
          email,
          password, // Password is required when creating a user with email
        };
      } else {
        userObject = {
          phoneNumber,
        };
      }

      // Create the user using the createUser method from Firebase Auth
      const userRecord = await getAuth().createUser(userObject);

      // Extract the user ID from the created user record
      const { uid } = userRecord;

      // You can add more data to the userRecord using the update method if needed
      // For example, to set custom claims, use: await updateCustomClaims(getAuth(), uid, { isAdmin: true });

      // Return the success response with the user ID
      return [
        {
          success: true,
          message: "User created successfully",
          status: httpStatus.CREATED,
          data: { uid },
        },
      ];
    } catch (error) {
      logObject("Internal Server Error:", error);
      logObject("error.code", error.code);
      if (error.code && error.code === "auth/email-already-exists") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: error.message,
          })
        );

        // return [
        //   {
        //     success: false,
        //     message: "Bad Request Error",
        //     errors: { message: error.message },
        //     status: httpStatus.BAD_REQUEST,
        //   },
        // ];
      }

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      // return [
      //   {
      //     success: false,
      //     message: "Internal Server Error",
      //     errors: { message: error.message },
      //     status: httpStatus.INTERNAL_SERVER_ERROR,
      //   },
      // ];
    }
  },
  syncAnalyticsAndMobile: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const { email, phoneNumber, firebase_uid } = body;
      let { firstName, lastName } = body;
      const password = accessCodeGenerator.generate(
        constants.RANDOM_PASSWORD_CONFIGURATION(10)
      );

      const userExistsLocally = await UserModel(tenant).findOne({
        $or: [{ email }],
      });

      if (!userExistsLocally) {
        let newAnalyticsUserDetails = {};
        newAnalyticsUserDetails.firebase_uid = firebase_uid;
        newAnalyticsUserDetails.userName = email;
        newAnalyticsUserDetails.email = email;
        newAnalyticsUserDetails.phoneNumber = phoneNumber || null;
        newAnalyticsUserDetails.firstName = firstName || "Unknown";
        newAnalyticsUserDetails.lastName = lastName || "Unknown";
        newAnalyticsUserDetails.password = password;

        logObject("newAnalyticsUserDetails:", newAnalyticsUserDetails);

        const responseFromCreateUser = await UserModel(tenant).register(
          newAnalyticsUserDetails,
          next
        );
        if (responseFromCreateUser.success === true) {
          const createdUser = await responseFromCreateUser.data;
          logObject("created user in util", createdUser._doc);
          if (firstName === "Unknown" || firstName === undefined) {
            firstName = "User";
          }
          if (lastName === "Unknown" || lastName === undefined) {
            lastName = "";
          }

          const responseFromSendEmail = await mailer.user(
            {
              firstName,
              lastName,
              email,
              password,
              tenant,
              type: "user",
            },
            next
          );
          logObject("responseFromSendEmail", responseFromSendEmail);
          if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else if (responseFromCreateUser.success === false) {
          return responseFromCreateUser;
        }
        return {
          success: true,
          message: "User created successfully.",
          status: httpStatus.CREATED,
          user: responseFromCreateUser.data,
          syncOperation: "Created",
        };
      } else if (userExistsLocally) {
        let updatedAnalyticsUserDetails = {};
        updatedAnalyticsUserDetails.firebase_uid = firebase_uid;
        if (!userExistsLocally.phoneNumber) {
          updatedAnalyticsUserDetails.phoneNumber = phoneNumber || null;
        }
        if (!userExistsLocally.firstName) {
          updatedAnalyticsUserDetails.firstName = firstName || "Unknown";
        }
        if (!userExistsLocally.lastName) {
          updatedAnalyticsUserDetails.lastName = lastName || "Unknown";
        }

        const responseFromUpdateUser = await UserModel(tenant).modify(
          {
            filter: { _id: userExistsLocally._id },
            update: updatedAnalyticsUserDetails,
          },
          next
        );
        const updatedUser = await UserModel(tenant).list(
          {
            filter: { _id: userExistsLocally._id },
          },
          next
        );

        if (responseFromUpdateUser.success === true) {
          logObject("updated user in util", updatedUser);
          return {
            success: true,
            message: "User updated successfully.",
            status: httpStatus.OK,
            user: updatedUser.data,
            syncOperation: "Updated",
          };
        }
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  signUpWithFirebase: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const { email, phoneNumber, firstName, lastName, userName, password } =
        body;

      // Step 1: Check if the user exists on Firebase using lookUpFirebaseUser function
      const firebaseUserResponse = await createUserModule.lookUpFirebaseUser(
        request
      );
      logObject("firebaseUserResponse[0]:", firebaseUserResponse[0]);

      if (
        firebaseUserResponse[0].success === true &&
        firebaseUserResponse[0].data.length > 0
      ) {
        // Step 2: User exists on Firebase, send error message

        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "User already exists on Firebase. Please login using Firebase.",
          })
        );
      } else {
        // Step 3: User does not exist on Firebase, create user on Firebase first
        // Create the user on Firebase using createFirebaseUser function
        const firebaseCreateResponse =
          await createUserModule.createFirebaseUser({
            body: { email, phoneNumber, password },
          });
        logObject("firebaseCreateResponse[0]:", firebaseCreateResponse[0]);

        if (firebaseCreateResponse[0].success === false) {
          return firebaseCreateResponse[0];
        } else if (firebaseCreateResponse[0].success === true) {
          // Step 4: Firebase user created successfully, proceed with local user creation
          // Check if user exists locally in your MongoDB using UserModel
          const userExistsLocally = await UserModel(tenant).findOne({
            $or: [{ email }, { phoneNumber }],
          });

          if (!userExistsLocally) {
            // User does not exist locally, perform create operation
            let newAnalyticsUserDetails = {
              ...(!isEmpty(phoneNumber) && { phoneNumber }),
            };
            newAnalyticsUserDetails.userName = userName || email;
            newAnalyticsUserDetails.firstName = firstName || "Unknown";
            newAnalyticsUserDetails.lastName = lastName || "Unknown";
            newAnalyticsUserDetails.password = accessCodeGenerator.generate(
              constants.RANDOM_PASSWORD_CONFIGURATION(10)
            );

            logObject("newAnalyticsUserDetails:", newAnalyticsUserDetails);
            const newUser = await UserModel(tenant).create(
              newAnalyticsUserDetails
            );
            return {
              success: true,
              message: "User created successfully.",
              status: httpStatus.CREATED,
              data: newUser,
            };
          }
        }
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  generateMobileUserCacheID: (request) => {
    const { tenant } = request.query;
    const { context } = request;
    if (isEmpty(context) || isEmpty(tenant)) {
      logger.error(`the request is either missing the context or the tenant`);

      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "the request is either missing the context or tenant",
        })
      );
    }
    return `${context}_${tenant}`;
  },
  setMobileUserCache: async ({ data, cacheID } = {}, next) => {
    try {
      logObject("cacheID supplied to setMobileUserCache", cacheID);
      // Use the consistent wrapper function
      const result = await redisSetWithTTLAsync(cacheID, stringify(data), 3600);
      return result;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getMobileUserCache: async (cacheID, next) => {
    try {
      logText("we are getting the cache......");
      logObject("cacheID supplied", cacheID);

      const result = await redisGetAsync(cacheID);
      logObject("ze result....", result);
      if (isEmpty(result)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Invalid Request -- Either Token or Email provided is invalid",
          })
        );
      }
      return JSON.parse(result);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteCachedItem: async (cacheID, next) => {
    try {
      const result = await redisDelAsync(cacheID);
      return {
        success: true,
        data: { numberOfDeletedKeys: result },
        message: "successfully deleted the cached item",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  loginWithFirebase: async (request, next) => {
    try {
      const { body } = request;
      const { email } = body;

      // Step 1: Check if the user exists on Firebase using lookUpFirebaseUser function
      const firebaseUserResponse = await createUserModule.lookUpFirebaseUser(
        request
      );
      logObject("firebaseUserResponse[0]...", firebaseUserResponse[0]);
      if (
        firebaseUserResponse &&
        firebaseUserResponse.length > 0 &&
        firebaseUserResponse[0].success === true &&
        !isEmpty(firebaseUserResponse[0].userRecord)
      ) {
        // Step 2: User exists on Firebase, update or create locally using UserModel
        const firebaseUser = firebaseUserResponse[0].userRecord;
        logObject("firebaseUser", firebaseUser);
        logObject("firebaseUser.uid", firebaseUser.uid);
        const firebase_uid = firebaseUser.uid;

        // Generate the custom token
        const token = generateNumericToken(5);

        let generateCacheRequest = Object.assign({}, request);
        const userIdentifier = firebaseUser.email
          ? firebaseUser.email
          : firebaseUser.phoneNumber;
        generateCacheRequest.context = userIdentifier;
        const cacheID =
          createUserModule.generateMobileUserCacheID(generateCacheRequest);
        logObject("cacheID", cacheID);
        if (cacheID.success && cacheID.success === false) {
          return cacheID;
        } else {
          const data = {
            token,
            ...firebaseUser,
          };

          const responseFromSettingCache =
            await createUserModule.setMobileUserCache(data, cacheID);
          if (
            responseFromSettingCache.success &&
            responseFromSettingCache.success === false
          ) {
            return responseFromSettingCache;
          } else {
            logObject("Cache set successfully", responseFromSettingCache);
            logObject("token", token);

            const responseFromSendEmail = await mailer.verifyMobileEmail(
              {
                token,
                email,
                firebase_uid,
              },
              next
            );

            if (responseFromSendEmail) {
              logObject("responseFromSendEmail", responseFromSendEmail);
              if (responseFromSendEmail.success === true) {
                return {
                  success: true,
                  message: "An Email sent to your account, please verify",
                  data: firebaseUser,
                  status: responseFromSendEmail.status
                    ? responseFromSendEmail.status
                    : "",
                };
              } else if (responseFromSendEmail.success === false) {
                return responseFromSendEmail;
              }
            } else {
              logger.error(
                "mailer.verifyMobileEmail did not return a response"
              );
              return next(
                new HttpError(
                  "Internal Server Error",
                  httpStatus.INTERNAL_SERVER_ERROR,
                  { message: "Failed to send after email verification email" }
                )
              );
            }
          }
        }
      } else {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Unable to Login, User does not exist on Firebase",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  verifyFirebaseCustomToken: async (request, next) => {
    try {
      logText("we are in verifying things");
      const { tenant } = request.query;
      const { email, phoneNumber, token } = request.body;

      let generateCacheRequest = Object.assign({}, request);
      const userIdentifier = email ? email : phoneNumber;
      generateCacheRequest.context = userIdentifier;

      const cacheID =
        createUserModule.generateMobileUserCacheID(generateCacheRequest);
      logObject("the cacheID search results", cacheID);

      if (cacheID.success && cacheID.success === false) {
        return cacheID;
      }

      const cachedData = await createUserModule.getMobileUserCache(
        cacheID,
        next
      );

      if (!cachedData) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid or expired token",
          })
        );
      }

      if (cachedData.success === false) {
        return cachedData;
      } else {
        logObject("the cachedData", cachedData);

        if (!isEmpty(cachedData.token) && cachedData.token !== token) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Either Token or Email are Incorrect",
            })
          );
        }

        const firebaseUser = cachedData;

        if (!firebaseUser.email && !firebaseUser.phoneNumber) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Email or phoneNumber is required.",
            })
          );
        }

        let filter = {};
        if (email) {
          filter.email = email;
        }
        if (phoneNumber) {
          filter.phoneNumber = phoneNumber;
        }
        const userExistsLocally = await UserModel(tenant)
          .findOne(filter)
          .exec();

        logObject("userExistsLocally", userExistsLocally);

        if (userExistsLocally) {
          const updatedFields = {};
          if (firebaseUser.firstName !== null) {
            updatedFields.firstName = firebaseUser.firstName;
          }
          if (firebaseUser.lastName !== null) {
            updatedFields.lastName = firebaseUser.lastName;
          }
          const updatedUser = await UserModel(tenant).updateOne(
            { _id: userExistsLocally._id },
            {
              $set: updatedFields,
            }
          );
          logObject("updatedUser", updatedUser);
          const responseFromDeleteCachedItem =
            await createUserModule.deleteCachedItem(cacheID, next);
          logObject(
            "responseFromDeleteCachedItem after updating existing user",
            responseFromDeleteCachedItem
          );
          if (
            responseFromDeleteCachedItem &&
            responseFromDeleteCachedItem.success === true
          ) {
            return {
              success: true,
              message: "Successful login!",
              status: httpStatus.CREATED,
              data: userExistsLocally.toAuthJSON(),
            };
          } else {
            return next(
              new HttpError(
                "Internal Sever Error",
                httpStatus.INTERNAL_SERVER_ERROR,
                {
                  message:
                    "Unable to delete the token after successful operation",
                }
              )
            );
          }
        } else {
          // User does not exist locally, perform create operation
          logText("this user does not exist locally");
          const generatedUserName =
            firebaseUser.displayName || firebaseUser.email;
          const generatedFirstName = firebaseUser.firstName || "Unknown";
          const generatedLastName = firebaseUser.lastName || "Unknown";
          const generatedPassword = accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(10)
          );
          const generatedProfilePicture = firebaseUser.photoURL || "";
          const newUser = await UserModel(tenant).create({
            email: firebaseUser.email,
            phoneNumber: firebaseUser.phoneNumber,
            firstName: generatedFirstName,
            lastName: generatedLastName,
            userName: generatedUserName,
            password: generatedPassword,
            firebase_uid: firebaseUser.uid,
            profilePicture: generatedProfilePicture,
          });
          logObject("newUser", newUser);
          const responseFromDeleteCachedItem =
            await createUserModule.deleteCachedItem(cacheID, next);
          logObject(
            "responseFromDeleteCachedItem after creating new user",
            responseFromDeleteCachedItem
          );
          if (
            responseFromDeleteCachedItem &&
            responseFromDeleteCachedItem.success === true
          ) {
            return {
              success: true,
              message: "Successful login!",
              status: httpStatus.CREATED,
              data: newUser.toAuthJSON(),
            };
          } else {
            return next(
              new HttpError(
                "Internal Sever Error",
                httpStatus.INTERNAL_SERVER_ERROR,
                {
                  message:
                    "Unable to delete the token after successful operation",
                }
              )
            );
          }
        }
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  generateSignInWithEmailLink: async (request, next) => {
    try {
      const { body, query } = request;
      const { email } = body;
      const { purpose } = query;

      const link = await getAuth().generateSignInWithEmailLink(
        email,
        constants.ACTION_CODE_SETTINGS
      );

      let linkSegments = link.split("%").filter((segment) => segment);
      const indexBeforeCode = linkSegments.indexOf("26oobCode", 0);
      const indexOfCode = indexBeforeCode + 1;
      let emailLinkCode = linkSegments[indexOfCode].substring(2);

      let responseFromSendEmail = {};
      let token = 100000;
      if (email !== constants.EMAIL) {
        token = Math.floor(Math.random() * (999999 - 100000) + 100000);
      }
      if (purpose === "mobileAccountDelete") {
        responseFromSendEmail = await mailer.deleteMobileAccountEmail(
          {
            email,
            token,
          },
          next
        );
      }
      if (purpose === "auth") {
        responseFromSendEmail = await mailer.authenticateEmail(
          { email, token },
          next
        );
      }
      if (purpose === "login") {
        responseFromSendEmail = await mailer.signInWithEmailLink(
          { email, token },
          next
        );
      }

      if (responseFromSendEmail && responseFromSendEmail.success === true) {
        return {
          success: true,
          message: "process successful, check your email for token",
          status: httpStatus.OK,
          data: {
            link,
            token,
            email,
            emailLinkCode,
          },
        };
      } else {
        logger.error(`email sending process unsuccessful`);
        const errorObject =
          responseFromSendEmail && responseFromSendEmail.errors
            ? responseFromSendEmail.errors
            : {};
        return next(
          new HttpError(
            "Internal Sever Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email sending process unsuccessful",
              ...errorObject,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getDashboardAnalyticsFromCache: async (request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsData = await DashboardAnalyticsModel(tenant)
        .findOne({ tenant })
        .lean();

      if (analyticsData) {
        return {
          success: true,
          message: "Analytics retrieved successfully",
          data: analyticsData,
          status: httpStatus.OK,
        };
      } else {
        // Data is not yet available. The cron job will populate this soon.
        return next(
          new HttpError("Service Unavailable", httpStatus.SERVICE_UNAVAILABLE, {
            message:
              "Analytics data is currently being generated. Please try again in a few moments.",
          })
        );
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in getDashboardAnalyticsFromCache: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getDashboardAnalyticsDirect: async (request, next) => {
    try {
      const { tenant } = request.query;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const startOfTwoMonthsAgo = new Date(
        twoMonthsAgo.getFullYear(),
        twoMonthsAgo.getMonth(),
        1
      );
      const endOfTwoMonthsAgo = new Date(
        twoMonthsAgo.getFullYear(),
        twoMonthsAgo.getMonth() + 1,
        0
      );

      const aggregationPipeline = [
        {
          $facet: {
            totalUsers: [{ $count: "count" }],
            dailyActiveUsers: [
              { $match: { lastLogin: { $gte: twentyFourHoursAgo } } },
              { $count: "count" },
            ],
            dailyActiveUsersTwoMonthsAgo: [
              {
                $match: {
                  lastLogin: {
                    $gte: startOfTwoMonthsAgo,
                    $lte: endOfTwoMonthsAgo,
                  },
                },
              },
              { $count: "count" },
            ],
            featureAdoption: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  withInterests: {
                    $sum: {
                      $cond: [
                        {
                          $gt: [{ $size: { $ifNull: ["$interests", []] } }, 0],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            userContribution: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  withProfilePicture: {
                    $sum: {
                      $cond: [{ $ifNull: ["$profilePicture", false] }, 1, 0],
                    },
                  },
                  withDescription: {
                    $sum: {
                      $cond: [{ $ifNull: ["$description", false] }, 1, 0],
                    },
                  },
                },
              },
            ],
            sessionDurationProxy: [
              {
                $group: {
                  _id: null,
                  averageLoginCount: { $avg: "$loginCount" },
                },
              },
            ],
            userSegments: [
              { $unwind: "$interests" },
              {
                $group: {
                  _id: "$interests",
                  count: { $sum: 1 },
                  averageLoginCount: { $avg: "$loginCount" },
                },
              },
              { $sort: { count: -1 } },
            ],
            behavioralInsights: [
              {
                $group: {
                  _id: null,
                  usersWithProfilePic: {
                    $sum: { $cond: ["$profilePicture", 1, 0] },
                  },
                },
              },
            ],
          },
        },
      ];

      const results = await UserModel(tenant).aggregate(aggregationPipeline);
      const analytics = results[0];

      const totalUsers = analytics.totalUsers[0]?.count || 0;
      const dau = analytics.dailyActiveUsers[0]?.count || 0;
      const featureAdoption = analytics.featureAdoption[0] || {};
      const dauTwoMonthsAgo =
        analytics.dailyActiveUsersTwoMonthsAgo[0]?.count || 0;
      const { withInterests = 0 } = analytics.featureAdoption[0] || {};
      const { withProfilePicture = 0, withDescription = 0 } =
        analytics.userContribution[0] || {};
      const { averageLoginCount = 0 } = analytics.sessionDurationProxy[0] || {};
      const userSegments = analytics.userSegments || [];
      const behavioralInsights = analytics.behavioralInsights[0] || {};

      const dauChange =
        dauTwoMonthsAgo > 0
          ? ((dau - dauTwoMonthsAgo) / dauTwoMonthsAgo) * 100
          : dau > 0
          ? 100
          : 0;

      const response = {
        userSatisfaction: null, // Placeholder
        dailyActiveUsers: dau,
        dailyActiveUsersChange: dauChange,
        featureAdoptionRate:
          totalUsers > 0 ? (withInterests / totalUsers) * 100 : 0,
        featureAdoptionRateChange: null, // Placeholder
        extendedUserSessionDuration: averageLoginCount,
        increasedUserDataContribution:
          totalUsers > 0
            ? ((withProfilePicture + withDescription) / (totalUsers * 2)) * 100
            : 0,
        stakeholderDecisionMaking: null, // Placeholder
        userSegments: userSegments.map((segment) => ({
          segment: segment._id,
          userCount: segment.count,
          engagementScore: segment.averageLoginCount || 0,
          trends: "Stable",
          recommendations: `Target ${segment._id} with specific content.`,
        })),
        behavioralInsights: {
          usersWithProfilePic: behavioralInsights.usersWithProfilePic || 0,
          profilePicAdoptionRate:
            totalUsers > 0
              ? (behavioralInsights.usersWithProfilePic / totalUsers) * 100
              : 0,
        },
      };

      return {
        success: true,
        message: "Live dashboard analytics retrieved successfully",
        data: response,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in getDashboardAnalyticsDirect: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  initiateAccountDeletion: async (request, next) => {
    try {
      logObject("the request query in initiateAccountDeletion", request.query);
      const { tenant } = request.query;
      const { email } = request.body;
      const user = request.user;

      logObject("the tenant in initiateAccountDeletion", tenant);

      if (user.email.toLowerCase() !== email.toLowerCase()) {
        return {
          success: false,
          message: "Forbidden",
          status: httpStatus.FORBIDDEN,
          errors: {
            message: "You can only initiate deletion for your own account.",
          },
        };
      }

      const responseFromGenerateResetToken =
        createUserModule.generateResetToken();
      if (!responseFromGenerateResetToken.success) {
        return responseFromGenerateResetToken;
      }

      const token = responseFromGenerateResetToken.data;
      const update = {
        deletionToken: token,
        deletionTokenExpires: Date.now() + 3600000, // 1 hour
      };

      const responseFromModifyUser = await UserModel(tenant).modify(
        {
          filter: { _id: user._id },
          update,
        },
        next
      );

      if (responseFromModifyUser.success) {
        const mailerResponse = await mailer.sendAccountDeletionConfirmation({
          email: user.email,
          token,
          tenant,
          firstName: user.firstName,
        });

        if (mailerResponse.success) {
          return {
            success: true,
            message:
              "Account deletion process initiated. Please check your email for a confirmation link.",
            status: httpStatus.OK,
          };
        } else {
          return mailerResponse;
        }
      } else {
        return responseFromModifyUser;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in initiateAccountDeletion: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  initiateMobileAccountDeletion: async (request, next) => {
    try {
      const { tenant: tenantFromQuery } = request.query;
      const tenant = tenantFromQuery || constants.DEFAULT_TENANT;
      const { email } = request.body;
      const user = request.user;

      if (user.email.toLowerCase() !== email.toLowerCase()) {
        return {
          success: false,
          message: "Forbidden",
          status: httpStatus.FORBIDDEN,
          errors: {
            message: "You can only initiate deletion for your own account.",
          },
        };
      }

      const token = generateNumericToken(5); // 5-digit code
      const update = {
        deletionToken: token,
        deletionTokenExpires: Date.now() + 3600000, // 1 hour
      };

      const responseFromModifyUser = await UserModel(tenant).modify(
        {
          filter: { _id: user._id },
          update,
        },
        next
      );

      if (responseFromModifyUser.success) {
        const mailerResponse = await mailer.sendMobileAccountDeletionCode({
          email: user.email,
          token,
          firstName: user.firstName,
        });

        if (mailerResponse.success) {
          return {
            success: true,
            message:
              "Account deletion process initiated. Please check your email for a 5-digit confirmation code.",
            status: httpStatus.OK,
          };
        } else {
          return mailerResponse;
        }
      } else {
        return responseFromModifyUser;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in initiateMobileAccountDeletion: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  confirmMobileAccountDeletion: async (request, next) => {
    // This re-uses the logic from the web confirmation, but is called from a different route.
    // The logic is identical because it just needs a token and tenant.
    // The mobile app will pass the numeric code as the token.
    return createUserModule.confirmAccountDeletion(request, next);
  },

  confirmAccountDeletion: async (request, next) => {
    try {
      const { tenant } = request.query;
      const token = request.params.token || request.body.token;
      const authenticatedUser = request.user; // This may be undefined for mobile flow
      const timeZone = moment.tz.guess();

      // If user is authenticated (web flow), verify the token belongs to them.
      // Otherwise (mobile flow), just find a valid token.
      const filter = authenticatedUser
        ? {
            _id: authenticatedUser._id,
            deletionToken: token,
            deletionTokenExpires: { $gt: moment().tz(timeZone).toDate() },
          }
        : {
            deletionToken: token,
            deletionTokenExpires: { $gt: moment().tz(timeZone).toDate() },
          };

      const user = await UserModel(tenant).findOne(filter).lean();

      if (!user) {
        return {
          success: false,
          message: "Invalid or expired token",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "Your account deletion token is invalid or has expired. Please try again.",
          },
        };
      }

      const deleteRequest = {
        query: { tenant, id: user._id.toString() },
      };

      const deletionResult = await createUserModule.delete(deleteRequest);

      if (deletionResult.success) {
        await mailer.sendAccountDeletionSuccess({
          email: user.email,
          firstName: user.firstName,
        });
        return {
          success: true,
          message: "Your account has been successfully deleted.",
          status: httpStatus.OK,
        };
      } else {
        return deletionResult;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in confirmAccountDeletion: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  delete: async (request) => {
    try {
      const { tenant } = request.query;
      const dbTenant = tenant ? String(tenant).toLowerCase() : tenant;
      const filter = generateFilter.users(request);
      const userId = filter._id;
      const responseFromCascadeDeletion = await cascadeUserDeletion({
        userId,
        tenant,
      });
      if (
        responseFromCascadeDeletion &&
        responseFromCascadeDeletion.success === true
      ) {
        const responseFromRemoveUser = await UserModel(dbTenant).remove({
          filter,
        });
        return responseFromRemoveUser;
      } else {
        return responseFromCascadeDeletion;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },

  sendFeedback: async (request, next) => {
    try {
      const { body } = request;
      const { email, message, subject } = body;
      const responseFromSendEmail = await mailer.feedback(
        {
          email,
          message,
          subject,
        },
        next
      );

      logObject("responseFromSendEmail ....", responseFromSendEmail);

      if (responseFromSendEmail && responseFromSendEmail.success === true) {
        return {
          success: true,
          message: "email successfully sent",
          status: httpStatus.OK,
        };
      } else {
        return responseFromSendEmail;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  registerMobileUser: async (request, next) => {
    try {
      const { tenant, email, firstName, lastName, password } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const dbTenant = tenant ? String(tenant).toLowerCase() : tenant;

      // ✅ STEP 1: Enhanced input validation
      if (!email || !firstName || !password) {
        return {
          success: false,
          message: "Missing required fields for mobile registration",
          errors: {
            email: !email ? "Email is required" : undefined,
            firstName: !firstName ? "First name is required" : undefined,
            password: !password ? "Password is required" : undefined,
          },
        };
      }

      const normalizedEmail = email.toLowerCase().trim();

      // ✅ STEP 2: Create mobile registration lock
      const lockKey = `mobile-reg-${normalizedEmail}-${tenant}`;

      if (registrationLocks.has(lockKey)) {
        logger.warn(
          `Duplicate mobile registration attempt blocked for ${normalizedEmail}`,
          {
            email: normalizedEmail,
            tenant,
            lockExists: true,
            userAgent: request.headers?.["user-agent"]?.substring(0, 100),
          }
        );

        return {
          success: false,
          message: "Registration already in progress",
          errors: {
            email:
              "A mobile registration for this email is currently being processed. Please wait a moment and try again.",
          },
        };
      }

      // Set lock with automatic cleanup
      registrationLocks.set(lockKey, {
        createdAt: Date.now(),
        type: "mobile",
        userAgent: request.headers?.["user-agent"]?.substring(0, 100),
      });

      setTimeout(() => {
        registrationLocks.delete(lockKey);
      }, 30000); // 30 second lock

      try {
        // ✅ STEP 3: Check for existing user with enhanced feedback
        const existingUser = await UserModel(dbTenant)
          .findOne({
            email: normalizedEmail,
          })
          .lean();

        if (!isEmpty(existingUser)) {
          // ✅ Provide specific guidance for mobile users
          if (existingUser.verified) {
            // For verified users, direct them to login
            return {
              success: false,
              message: "Account already exists",
              errors: {
                email:
                  "This email is already registered. Please use the login option or 'Forgot Password' if needed.",
              },
              data: {
                accountExists: true,
                verified: true,
                shouldLogin: true,
                userId: existingUser._id,
              },
            };
          } else {
            // For unverified users, offer to resend verification

            try {
              await createUserModule.mobileVerificationReminder(
                {
                  tenant,
                  email: normalizedEmail,
                },
                next
              );

              return {
                success: false,
                message: "Account exists but not verified",
                errors: {
                  email:
                    "This email is already registered but not verified. A new verification code has been sent to your email.",
                },
                data: {
                  accountExists: true,
                  verified: false,
                  verificationEmailSent: true,
                  userId: existingUser._id,
                },
              };
            } catch (emailError) {
              logger.error(
                `Failed to send mobile verification reminder: ${emailError.message}`
              );

              return {
                success: false,
                message: "Account exists but not verified",
                errors: {
                  email:
                    "This email is already registered but not verified. Please check your email for the verification code or contact support.",
                },
                data: {
                  accountExists: true,
                  verified: false,
                  verificationEmailFailed: true,
                },
              };
            }
          }
        }

        // ✅ STEP 4: Prepare user data for mobile registration
        const userData = {
          ...request.body,
          email: normalizedEmail,
          userName: normalizedEmail,
          analyticsVersion: 4, // Mobile users get version 4
          ...(request.body.interests && { interests: request.body.interests }),
          ...(request.body.interestsDescription && {
            interestsDescription: request.body.interestsDescription,
          }),
          ...(request.body.country && { country: request.body.country }),
          // Add mobile-specific metadata
          registrationSource: "mobile_app",
          userAgent: request.headers?.["user-agent"]?.substring(0, 200),
        };

        // ✅ STEP 5: Create user with enhanced error handling
        const newUserResponse = await UserModel(dbTenant).register(
          userData,
          next,
          {
            sendDuplicateEmail: false, // Mobile handles its own verification flow
          }
        );

        if (newUserResponse && newUserResponse.success === true) {
          const newUser = newUserResponse.data;
          const userId = newUser._doc._id;

          // ✅ STEP 6: Generate mobile verification token
          const verificationToken = generateNumericToken(5);
          const tokenExpiry = 86400; // 24hrs in seconds

          const tokenCreationBody = {
            token: verificationToken,
            name: newUser._doc.firstName,
            expires: new Date(Date.now() + tokenExpiry * 1000),
          };

          const verifyTokenResponse = await VerifyTokenModel(dbTenant).register(
            tokenCreationBody,
            next
          );

          if (verifyTokenResponse && verifyTokenResponse.success === false) {
            logger.error(
              `Failed to create verification token for mobile user ${normalizedEmail}: ${verifyTokenResponse.message}`,
              {
                email: normalizedEmail,
                userId,
                tenant,
                tokenError: verifyTokenResponse.message,
              }
            );

            // Consider rolling back user creation
            try {
              await UserModel(dbTenant).findByIdAndDelete(userId);
              logger.info(
                `Rolled back user creation due to token failure: ${userId}`
              );
            } catch (rollbackError) {
              logger.error(
                `Failed to rollback user creation: ${rollbackError.message}`
              );
            }

            return verifyTokenResponse;
          }

          // ✅ STEP 7: Send verification email with enhanced monitoring
          try {
            const emailResult = await mailer.sendVerificationEmail({
              email: normalizedEmail,
              token: verificationToken,
              tenant,
            });

            if (emailResult && emailResult.success === true) {
              return {
                success: true,
                message:
                  "Mobile user registered successfully. Please verify your email.",
                data: {
                  user: {
                    _id: newUser._doc._id,
                    email: newUser._doc.email,
                    firstName: newUser._doc.firstName,
                    lastName: newUser._doc.lastName,
                    verified: newUser._doc.verified,
                    analyticsVersion: newUser._doc.analyticsVersion,
                  },
                  verificationEmailSent: true,
                  nextStep: "Check your email for a 5-digit verification code",
                },
              };
            } else {
              logger.error("Mobile verification email failed", {
                email: normalizedEmail,
                userId,
                tenant,
                emailError:
                  (emailResult && emailResult.message) || "Unknown email error",
              });

              return {
                success: false,
                message: "User created but verification email failed",
                data: {
                  user: {
                    _id: newUser._doc._id,
                    email: newUser._doc.email,
                    firstName: newUser._doc.firstName,
                    lastName: newUser._doc.lastName,
                    verified: false,
                  },
                  verificationEmailSent: false,
                  emailError:
                    (emailResult && emailResult.message) ||
                    "Email service unavailable",
                },
              };
            }
          } catch (emailError) {
            logger.error(
              `Mobile verification email exception: ${emailError.message}`,
              {
                email: normalizedEmail,
                userId,
                tenant,
                error: emailError.message,
                stack: emailError.stack && emailError.stack.substring(0, 500),
              }
            );

            return {
              success: false,
              message: "User created but email delivery failed",
              data: {
                user: {
                  _id: newUser._doc._id,
                  email: newUser._doc.email,
                  firstName: newUser._doc.firstName,
                  lastName: newUser._doc.lastName,
                  verified: false,
                },
                verificationEmailSent: false,
                emailError: emailError.message,
              },
            };
          }
        } else {
          logger.error("Mobile user creation failed", {
            email: normalizedEmail,
            tenant,
            error:
              (newUserResponse && newUserResponse.message) ||
              "Unknown creation error",
            errors: newUserResponse && newUserResponse.errors,
          });
          return newUserResponse && Object.keys(newUserResponse).length > 0
            ? newUserResponse
            : newUserResponse || {
                success: false,
                message: "Failed to create mobile user account",
              };
        }
      } finally {
        // ✅ STEP 8: Always cleanup the lock
        registrationLocks.delete(lockKey);
      }
    } catch (error) {
      logger.error(`🐛🐛 Mobile registration error: ${error.message}`, {
        email: request.body?.email,
        tenant: request.query?.tenant,
        stack: error.stack,
        userAgent:
          request.headers &&
          request.headers["user-agent"] &&
          request.headers["user-agent"].substring(0, 100),
      });

      return {
        success: false,
        message: "An unexpected error occurred during mobile registration",
        errors: {
          server:
            "Please try again or contact support if the problem persists.",
        },
      };
    }
  },

  verificationReminder: async (request, next) => {
    try {
      const { tenant, email } = request;
      const dbTenant = tenant ? String(tenant).toLowerCase() : tenant;

      if (!email) {
        return {
          success: false,
          message: "Email is required for verification reminder",
          status: httpStatus.BAD_REQUEST,
          errors: { email: "Email address is required" },
        };
      }

      const normalizedEmail = email.toLowerCase().trim();

      // ✅ STEP 1: Rate limiting for verification reminders
      const reminderKey = `verify-reminder-${normalizedEmail}-${tenant}`;

      if (registrationLocks.has(reminderKey)) {
        const lockData = registrationLocks.get(reminderKey);
        const timeElapsed = Date.now() - lockData.createdAt;
        const remainingTime = Math.ceil((300000 - timeElapsed) / 1000); // 5 minutes lock

        logger.warn(
          `Verification reminder rate limited for ${normalizedEmail}`,
          {
            email: normalizedEmail,
            tenant,
            timeElapsed: timeElapsed / 1000,
            remainingSeconds: remainingTime,
          }
        );

        return {
          success: false,
          message: "Please wait before requesting another verification email",
          status: httpStatus.TOO_MANY_REQUESTS,
          errors: {
            rateLimit: `Please wait ${remainingTime} seconds before requesting another verification email.`,
          },
        };
      }

      // Set rate limiting lock
      registrationLocks.set(reminderKey, {
        createdAt: Date.now(),
        type: "verification_reminder",
      });

      setTimeout(() => {
        registrationLocks.delete(reminderKey);
      }, 300000); // 5 minute rate limit

      // ✅ STEP 2: Enhanced user lookup with verification status check
      const user = await UserModel(dbTenant)
        .findOne({ email: normalizedEmail })
        .select(
          "_id email firstName lastName verified createdAt lastLogin analyticsVersion"
        )
        .lean();

      if (isEmpty(user)) {
        logger.warn(
          `Verification reminder requested for non-existent user: ${normalizedEmail}`,
          {
            email: normalizedEmail,
            tenant,
          }
        );

        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
          errors: {
            email:
              "No account found with this email address. Please check the email or register a new account.",
          },
        };
      }

      // ✅ STEP 3: Check if user is already verified
      if (user.verified) {
        return {
          success: false,
          message: "Account is already verified",
          status: httpStatus.BAD_REQUEST,
          errors: {
            verification:
              "Your account is already verified. You can proceed to login.",
          },
          data: {
            alreadyVerified: true,
            canLogin: true,
          },
        };
      }

      const user_id = user._id;

      // ✅ STEP 4: Generate new verification token with enhanced security
      const token = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
        )
        .toUpperCase();

      const tokenCreationBody = {
        token,
        name: user.firstName,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      // ✅ STEP 5: Create verification token with cleanup of old tokens
      try {
        // Clean up any existing tokens for this user first
        await VerifyTokenModel(dbTenant).deleteMany({
          name: user.firstName,
          expires: { $lt: new Date() }, // Delete expired tokens
        });

        const responseFromCreateToken = await VerifyTokenModel(
          dbTenant
        ).register(tokenCreationBody, next);

        if (!responseFromCreateToken) {
          logger.error(
            `🐛🐛 Error creating verification reminder token: responseFromCreateToken is undefined`,
            { email: normalizedEmail, userId: user_id, tenant }
          );
          return {
            success: false,
            message: "Failed to create verification token",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: { token: "Unable to generate verification token" },
          };
        }

        if (responseFromCreateToken.success === false) {
          logger.error("Verification token creation failed", {
            email: normalizedEmail,
            userId: user_id,
            tenant,
            tokenError: responseFromCreateToken.message,
          });
          return responseFromCreateToken;
        }

        // ✅ STEP 6: Send verification email with enhanced monitoring
        try {
          const responseFromSendEmail = await mailer.verifyEmail(
            {
              user_id,
              token,
              email: normalizedEmail,
              firstName: user.firstName,
              category: "reminder", // Mark as reminder for analytics
            },
            next
          );

          if (responseFromSendEmail) {
            if (responseFromSendEmail.success === true) {
              const userDetails = {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                verified: user.verified,
              };

              return {
                success: true,
                message: "Verification email sent successfully",
                data: {
                  ...userDetails,
                  reminderSent: true,
                  expiresIn: "24 hours",
                },
                status: responseFromSendEmail.status || httpStatus.OK,
              };
            } else if (responseFromSendEmail.success === false) {
              logger.error("Verification reminder email failed", {
                email: normalizedEmail,
                userId: user_id,
                tenant,
                emailError: responseFromSendEmail.message,
              });
              return responseFromSendEmail;
            }
          } else {
            logger.error(
              "mailer.verifyEmail did not return a response for reminder"
            );
            return {
              success: false,
              message: "Email service unavailable",
              status: httpStatus.SERVICE_UNAVAILABLE,
              errors: {
                email: "Unable to send verification email at this time",
              },
            };
          }
        } catch (emailError) {
          logger.error(
            `Verification reminder email exception: ${emailError.message}`,
            {
              email: normalizedEmail,
              userId: user_id,
              tenant,
              error: emailError.message,
            }
          );

          return {
            success: false,
            message: "Failed to send verification email",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: { email: emailError.message },
          };
        }
      } catch (tokenError) {
        logger.error(
          `Token creation error for verification reminder: ${tokenError.message}`,
          {
            email: normalizedEmail,
            userId: user_id,
            tenant,
            error: tokenError.message,
          }
        );

        return {
          success: false,
          message: "Failed to create verification token",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { token: tokenError.message },
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Verification reminder error: ${error.message}`, {
        email: request.email,
        tenant: request.tenant,
        stack: error.stack,
      });

      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { server: "An unexpected error occurred" },
      };
    }
  },

  mobileVerificationReminder: async (request, next) => {
    try {
      const { tenant, email } = request;
      const dbTenant = tenant ? String(tenant).toLowerCase() : tenant;

      if (!email) {
        return {
          success: false,
          message: "Email is required for mobile verification reminder",
          errors: { email: "Email address is required" },
        };
      }

      const normalizedEmail = email.toLowerCase().trim();

      // ✅ STEP 1: Enhanced rate limiting for mobile
      const reminderKey = `mobile-verify-reminder-${normalizedEmail}-${tenant}`;

      if (registrationLocks.has(reminderKey)) {
        const lockData = registrationLocks.get(reminderKey);
        const timeElapsed = Date.now() - lockData.createdAt;
        const remainingTime = Math.ceil((180000 - timeElapsed) / 1000); // 3 minutes lock for mobile

        logger.warn(
          `Mobile verification reminder rate limited for ${normalizedEmail}`,
          {
            email: normalizedEmail,
            tenant,
            timeElapsed: timeElapsed / 1000,
            remainingSeconds: remainingTime,
          }
        );

        return {
          success: false,
          message: "Please wait before requesting another verification code",
          errors: {
            rateLimit: `Please wait ${remainingTime} seconds before requesting another code.`,
          },
        };
      }

      // Set rate limiting lock (shorter for mobile UX)
      registrationLocks.set(reminderKey, {
        createdAt: Date.now(),
        type: "mobile_verification_reminder",
      });

      setTimeout(() => {
        registrationLocks.delete(reminderKey);
      }, 180000); // 3 minute rate limit for mobile

      // ✅ STEP 2: Enhanced user lookup
      const user = await UserModel(dbTenant)
        .findOne({ email: normalizedEmail })
        .select(
          "_id email firstName lastName verified analyticsVersion createdAt"
        )
        .lean();

      if (isEmpty(user)) {
        logger.warn(
          `Mobile verification reminder for non-existent user: ${normalizedEmail}`,
          {
            email: normalizedEmail,
            tenant,
          }
        );

        return {
          success: false,
          message: "User not found",
          errors: {
            email:
              "No mobile account found with this email. Please register first.",
          },
        };
      }

      // ✅ STEP 3: Check verification status
      if (user.verified) {
        return {
          success: false,
          message: "Account already verified",
          errors: {
            verification:
              "Your mobile account is already verified. You can proceed to login.",
          },
          data: {
            alreadyVerified: true,
            canLogin: true,
          },
        };
      }

      // ✅ STEP 4: Generate mobile verification token (5-digit numeric)
      const token = generateNumericToken(5);

      const tokenCreationBody = {
        token,
        name: user.firstName,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      // ✅ STEP 5: Create token with cleanup
      try {
        // Clean up old mobile tokens first
        await VerifyTokenModel(dbTenant).deleteMany({
          name: user.firstName,
          token: { $regex: /^\d{5}$/ }, // Delete old 5-digit tokens
          expires: { $lt: new Date() },
        });

        const responseFromCreateToken = await VerifyTokenModel(
          dbTenant
        ).register(tokenCreationBody, next);

        if (responseFromCreateToken.success === false) {
          logger.error("Mobile verification token creation failed", {
            email: normalizedEmail,
            userId: user._id,
            tenant,
            error: responseFromCreateToken.message,
          });
          return responseFromCreateToken;
        }

        // ✅ STEP 6: Send mobile verification email
        try {
          const emailResponse = await mailer.sendVerificationEmail(
            {
              email: normalizedEmail,
              token,
              tenant,
            },
            next
          );

          if (emailResponse && emailResponse.success === true) {
            const userDetails = {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              verified: user.verified,
            };

            return {
              success: true,
              message: "Verification code sent to your email.",
              data: {
                ...userDetails,
                reminderSent: true,
                codeLength: 5,
                expiresIn: "24 hours",
              },
            };
          } else {
            logger.error("Mobile verification reminder email failed", {
              email: normalizedEmail,
              userId: user._id,
              tenant,
              emailError: emailResponse && emailResponse.message,
            });
            return (
              emailResponse || {
                success: false,
                message: "Failed to send verification code",
              }
            );
          }
        } catch (emailError) {
          logger.error(
            `Mobile verification reminder email exception: ${emailError.message}`,
            {
              email: normalizedEmail,
              userId: user._id,
              tenant,
              error: emailError.message,
            }
          );

          return {
            success: false,
            message: "Email delivery failed",
            errors: { email: emailError.message },
          };
        }
      } catch (tokenError) {
        logger.error(
          `Mobile verification token creation error: ${tokenError.message}`,
          {
            email: normalizedEmail,
            userId: user._id,
            tenant,
            error: tokenError.message,
          }
        );

        return {
          success: false,
          message: "Failed to generate verification code",
          errors: { token: tokenError.message },
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Mobile verification reminder error: ${error.message}`,
        {
          email: request.email,
          tenant: request.tenant,
          stack: error.stack,
        }
      );

      return {
        success: false,
        message: "An unexpected error occurred",
        errors: { server: "Please try again or contact support" },
      };
    }
  },

  verifyMobileEmail: async (request, next) => {
    try {
      const {
        email,
        token,
        tenant,
        skip = 0,
        limit = 1000,
      } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      // ✅ STEP 1: Enhanced input validation
      if (!email || !token) {
        return {
          success: false,
          message: "Email and verification code are required",
          errors: {
            email: !email ? "Email is required" : undefined,
            token: !token ? "Verification code is required" : undefined,
          },
        };
      }

      const normalizedEmail = email.toLowerCase().trim();

      // ✅ STEP 2: Token format validation for mobile (5-digit numeric)
      if (!/^\d{5}$/.test(token)) {
        logger.warn(
          `Invalid mobile verification token format for ${normalizedEmail}`,
          {
            email: normalizedEmail,
            tenant,
            tokenFormat: "invalid",
            providedToken: token.replace(/./g, "*"), // Mask token in logs
          }
        );

        return {
          success: false,
          message: "Invalid verification code format",
          errors: {
            token: "Verification code must be a 5-digit number",
          },
        };
      }

      // ✅ STEP 3: Rate limiting for verification attempts
      const verifyKey = `mobile-verify-${normalizedEmail}-${tenant}`;

      if (registrationLocks.has(verifyKey)) {
        const lockData = registrationLocks.get(verifyKey);
        const attempts = lockData.attempts || 0;

        if (attempts >= 5) {
          // Max 5 attempts per 15 minutes
          const timeElapsed = Date.now() - lockData.createdAt;
          const remainingTime = Math.ceil((900000 - timeElapsed) / 1000); // 15 minutes

          logger.warn(
            `Mobile verification rate limited for ${normalizedEmail}`,
            {
              email: normalizedEmail,
              tenant,
              attempts,
              remainingSeconds: remainingTime,
            }
          );

          return {
            success: false,
            message: "Too many verification attempts",
            errors: {
              rateLimit: `Please wait ${Math.ceil(
                remainingTime / 60
              )} minutes before trying again.`,
            },
          };
        }

        // Increment attempts
        lockData.attempts = attempts + 1;
        registrationLocks.set(verifyKey, lockData);
      } else {
        // First attempt
        registrationLocks.set(verifyKey, {
          createdAt: Date.now(),
          attempts: 1,
          type: "mobile_verification",
        });

        setTimeout(() => {
          registrationLocks.delete(verifyKey);
        }, 900000); // 15 minute window
      }

      const timeZone = moment.tz.guess();
      let filter = {
        token,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      // ✅ STEP 4: Enhanced user lookup with verification status
      const userDetails = await UserModel(tenant)
        .find({ email: normalizedEmail })
        .select(
          "_id firstName lastName userName email verified analyticsVersion"
        )
        .lean();

      const user = userDetails[0];

      if (isEmpty(user)) {
        logger.warn(
          `Mobile verification attempted for non-existent user: ${normalizedEmail}`,
          {
            email: normalizedEmail,
            tenant,
            token: token.replace(/./g, "*"),
          }
        );

        return {
          success: false,
          message: "User not found",
          errors: {
            email: "No account found with this email address",
          },
        };
      }

      // ✅ STEP 5: Check if already verified
      if (user.verified) {
        // Clear rate limiting on successful verification check
        registrationLocks.delete(verifyKey);

        return {
          success: true,
          message: "Account already verified",
          data: {
            user: {
              _id: user._id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              verified: true,
            },
            alreadyVerified: true,
          },
        };
      }

      // ✅ STEP 6: Validate verification token

      const responseFromListAccessToken = await VerifyTokenModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next
      );

      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          logger.warn(
            `Invalid or expired mobile verification token for ${normalizedEmail}`,
            {
              email: normalizedEmail,
              userId: user._id,
              tenant,
              tokenStatus: "not_found_or_expired",
            }
          );

          return {
            success: false,
            message: "Invalid or expired verification code",
            errors: {
              token:
                "The verification code is invalid or has expired. Please request a new code.",
            },
          };
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          // ✅ STEP 7: Update user as verified
          filter = { email: normalizedEmail };
          let update = { verified: true };

          const responseFromUpdateUser = await UserModel(tenant).modify(
            {
              filter,
              update,
            },
            next
          );

          if (responseFromUpdateUser.success === true) {
            if (responseFromUpdateUser.status === httpStatus.BAD_REQUEST) {
              return responseFromUpdateUser;
            }

            // ✅ STEP 8: Delete verification token
            filter = { token };
            const responseFromDeleteToken = await VerifyTokenModel(
              tenant
            ).remove({ filter }, next);

            if (responseFromDeleteToken.success === true) {
              // ✅ STEP 9: Send welcome email for mobile users
              try {
                const responseFromSendEmail =
                  await mailer.afterEmailVerification(
                    {
                      firstName: user.firstName,
                      username: user.userName,
                      email: user.email,
                      analyticsVersion: user.analyticsVersion || 4,
                    },
                    next
                  );

                // Clear rate limiting on successful verification
                registrationLocks.delete(verifyKey);

                if (
                  responseFromSendEmail &&
                  responseFromSendEmail.success === true
                ) {
                  return {
                    success: true,
                    message: "Email verified successfully! Welcome to AirQo.",
                    data: {
                      user: {
                        _id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        verified: true,
                        analyticsVersion: user.analyticsVersion,
                      },
                      verificationCompleted: true,
                      welcomeEmailSent: true,
                    },
                    status: httpStatus.OK,
                  };
                } else {
                  // Verification successful but welcome email failed
                  return {
                    success: true,
                    message: "Email verified successfully!",
                    data: {
                      user: {
                        _id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        verified: true,
                        analyticsVersion: user.analyticsVersion,
                      },
                      verificationCompleted: true,
                      welcomeEmailSent: false,
                      welcomeEmailError: responseFromSendEmail?.message,
                    },
                    status: httpStatus.OK,
                  };
                }
              } catch (emailError) {
                logger.error(
                  `Welcome email error after mobile verification: ${emailError.message}`,
                  {
                    email: normalizedEmail,
                    userId: user._id,
                    tenant,
                    error: emailError.message,
                  }
                );

                // Still return success since verification completed
                return {
                  success: true,
                  message: "Email verified successfully!",
                  data: {
                    user: {
                      _id: user._id,
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName,
                      verified: true,
                    },
                    verificationCompleted: true,
                    welcomeEmailSent: false,
                  },
                  status: httpStatus.OK,
                };
              }
            } else if (responseFromDeleteToken.success === false) {
              logger.error(
                "Failed to delete verification token after mobile verification",
                {
                  email: normalizedEmail,
                  userId: user._id,
                  tenant,
                  deleteError: responseFromDeleteToken.message,
                }
              );

              return {
                success: false,
                message: "Verification process incomplete",
                status:
                  responseFromDeleteToken.status ||
                  httpStatus.INTERNAL_SERVER_ERROR,
                errors: responseFromDeleteToken.errors || {
                  message: "Token cleanup failed",
                },
              };
            }
          } else if (responseFromUpdateUser.success === false) {
            logger.error("Failed to update user verification status", {
              email: normalizedEmail,
              userId: user._id,
              tenant,
              updateError: responseFromUpdateUser.message,
            });

            return {
              success: false,
              message: "Failed to update verification status",
              status:
                responseFromUpdateUser.status ||
                httpStatus.INTERNAL_SERVER_ERROR,
              errors: responseFromUpdateUser.errors || {
                message: "Database update failed",
              },
            };
          }
        }
      } else if (responseFromListAccessToken.success === false) {
        logger.error("Token lookup failed for mobile verification", {
          email: normalizedEmail,
          userId: user._id,
          tenant,
          tokenError: responseFromListAccessToken.message,
        });

        return responseFromListAccessToken;
      }
    } catch (error) {
      logger.error(`🐛🐛 Mobile email verification error: ${error.message}`, {
        email: request.body?.email,
        tenant: request.query?.tenant,
        stack: error.stack,
      });

      return {
        success: false,
        message: "An unexpected error occurred during verification",
        errors: {
          server:
            "Please try again or contact support if the problem persists.",
        },
      };
    }
  },
  verifyEmail: async (request, next) => {
    try {
      const {
        tenant,
        limit = 1000,
        skip = 0,
        user_id,
        token,
      } = {
        ...request.query,
        ...request.params,
      };

      // ✅ STEP 1: Enhanced input validation
      if (!user_id || !token) {
        return {
          success: false,
          message: "User ID and verification token are required",
          status: httpStatus.BAD_REQUEST,
          errors: {
            user_id: !user_id ? "User ID is required" : undefined,
            token: !token ? "Verification token is required" : undefined,
          },
        };
      }

      // ✅ STEP 2: Enhanced user lookup
      const userDetails = await UserModel(tenant)
        .find({ _id: ObjectId(user_id) })
        .select(
          "_id firstName lastName userName email verified analyticsVersion"
        )
        .lean();

      if (isEmpty(userDetails)) {
        logger.warn(
          `Web verification attempted for non-existent user ID: ${user_id}`,
          {
            userId: user_id,
            tenant,
            token: token.substring(0, 5) + "...",
          }
        );

        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
          errors: { user: "User account not found" },
        };
      }

      const user = userDetails[0];

      // ✅ STEP 3: Check if already verified
      if (user.verified) {
        return {
          success: true,
          message: "Account already verified",
          status: httpStatus.OK,
          data: {
            user: {
              _id: user._id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              verified: true,
            },
            alreadyVerified: true,
          },
        };
      }

      // ✅ STEP 4: Validate token with expiration check
      const timeZone = moment.tz.guess();
      let filter = {
        token,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const responseFromListAccessToken = await VerifyTokenModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next
      );

      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          logger.warn(
            `Invalid or expired web verification token for user: ${user.email}`,
            {
              email: user.email,
              userId: user_id,
              tenant,
              tokenStatus: "not_found_or_expired",
            }
          );

          return {
            success: false,
            message: "Invalid or expired verification link",
            status: httpStatus.BAD_REQUEST,
            errors: {
              token:
                "The verification link is invalid or has expired. Please request a new verification email.",
            },
          };
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          // ✅ STEP 5: Update user as verified
          let update = { verified: true };
          filter = { _id: user_id };

          const responseFromUpdateUser = await UserModel(tenant).modify(
            {
              filter,
              update,
            },
            next
          );

          if (responseFromUpdateUser.success === true) {
            if (responseFromUpdateUser.status === httpStatus.BAD_REQUEST) {
              return responseFromUpdateUser;
            }

            // ✅ STEP 6: Delete verification token
            filter = { token };
            const responseFromDeleteToken = await VerifyTokenModel(
              tenant
            ).remove({ filter }, next);

            if (responseFromDeleteToken.success === true) {
              // ✅ STEP 7: Send welcome email
              try {
                const responseFromSendEmail =
                  await mailer.afterEmailVerification(
                    {
                      firstName: user.firstName,
                      username: user.userName,
                      email: user.email,
                      analyticsVersion: user.analyticsVersion || 3,
                    },
                    next
                  );

                if (
                  responseFromSendEmail &&
                  responseFromSendEmail.success === true
                ) {
                  return {
                    success: true,
                    message: "Email verified successfully! Welcome to AirQo.",
                    status: httpStatus.OK,
                    data: {
                      user: {
                        _id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        verified: true,
                      },
                      verificationCompleted: true,
                      welcomeEmailSent: true,
                    },
                  };
                } else if (
                  responseFromSendEmail &&
                  responseFromSendEmail.success === false
                ) {
                  // Verification successful but welcome email failed
                  return {
                    success: true,
                    message: "Email verified successfully!",
                    status: httpStatus.OK,
                    data: {
                      user: {
                        _id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        verified: true,
                      },
                      verificationCompleted: true,
                      welcomeEmailSent: false,
                    },
                  };
                }
              } catch (emailError) {
                logger.error(
                  `Welcome email error after web verification: ${emailError.message}`,
                  {
                    email: user.email,
                    userId: user_id,
                    tenant,
                    error: emailError.message,
                  }
                );

                // Still return success since verification completed
                return {
                  success: true,
                  message: "Email verified successfully!",
                  status: httpStatus.OK,
                  data: {
                    user: {
                      _id: user._id,
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName,
                      verified: true,
                    },
                    verificationCompleted: true,
                    welcomeEmailSent: false,
                  },
                };
              }
            } else if (responseFromDeleteToken.success === false) {
              logger.error(
                "Failed to delete verification token after web verification",
                {
                  email: user.email,
                  userId: user_id,
                  tenant,
                  deleteError: responseFromDeleteToken.message,
                }
              );

              return {
                success: false,
                message: "Verification process incomplete",
                status:
                  responseFromDeleteToken.status ||
                  httpStatus.INTERNAL_SERVER_ERROR,
                errors: responseFromDeleteToken.errors || {
                  message: "Token cleanup failed",
                },
              };
            }
          } else if (responseFromUpdateUser.success === false) {
            logger.error("Failed to update user verification status", {
              email: user.email,
              userId: user_id,
              tenant,
              updateError: responseFromUpdateUser.message,
            });

            return {
              success: false,
              message: "Failed to update verification status",
              status:
                responseFromUpdateUser.status ||
                httpStatus.INTERNAL_SERVER_ERROR,
              errors: responseFromUpdateUser.errors || {
                message: "Database update failed",
              },
            };
          }
        }
      } else if (responseFromListAccessToken.success === false) {
        logger.error("Token lookup failed for web verification", {
          email: user.email,
          userId: user_id,
          tenant,
          tokenError: responseFromListAccessToken.message,
        });

        return responseFromListAccessToken;
      }
    } catch (error) {
      logger.error(`🐛🐛 Web email verification error: ${error.message}`, {
        userId: request.params?.user_id,
        tenant: request.query?.tenant,
        stack: error.stack,
      });

      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { server: "An unexpected error occurred during verification" },
      };
    }
  },
  create: async (request, next) => {
    try {
      const { tenant, firstName, email, password, category } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const dbTenant = tenant ? String(tenant).toLowerCase() : tenant;

      // ✅ STEP 1: Create registration lock to prevent race conditions
      const lockKey = `reg-${email.toLowerCase()}-${tenant}`;

      if (registrationLocks.has(lockKey)) {
        logger.warn(`Duplicate registration attempt blocked for ${email}`, {
          email,
          tenant,
          lockExists: true,
        });

        return {
          success: false,
          message: "Registration already in progress for this email",
          status: httpStatus.CONFLICT,
          errors: [
            {
              param: "email",
              message:
                "A registration for this email is already being processed. Please wait a moment and try again.",
              location: "body",
            },
          ],
        };
      }

      // Set lock with automatic cleanup
      registrationLocks.set(lockKey, Date.now());
      setTimeout(() => {
        registrationLocks.delete(lockKey);
      }, 30000); // 30 second lock

      try {
        // ✅ STEP 2: Check for existing user with enhanced logging
        const existingUser = await UserModel(dbTenant)
          .findOne({
            email: email.toLowerCase(),
          })
          .lean();

        if (!isEmpty(existingUser)) {
          // ✅ ENHANCED RESPONSE: Provide helpful information based on verification status
          if (existingUser.verified) {
            // User exists and is verified - send them to login
            return {
              success: false,
              message:
                "An account with this email already exists and is verified",
              status: httpStatus.CONFLICT,
              errors: [
                {
                  param: "email",
                  message:
                    "This email is already registered. Please use the 'Forgot Password' feature if you need to reset your password.",
                  location: "body",
                },
              ],
              data: {
                accountExists: true,
                verified: true,
                loginUrl: `${constants.ANALYTICS_BASE_URL}/user/login`,
                forgotPasswordUrl: `${constants.ANALYTICS_BASE_URL}/user/forgotPwd`,
              },
            };
          } else {
            // User exists but not verified - offer to resend verification

            // Trigger verification email resend
            try {
              await createUserModule.verificationReminder(
                {
                  tenant,
                  email: existingUser.email,
                },
                next
              );

              return {
                success: false,
                message:
                  "Account exists but is not verified. A new verification email has been sent.",
                status: httpStatus.CONFLICT,
                errors: [
                  {
                    param: "email",
                    message:
                      "This email is already registered but not verified. We've sent a new verification email.",
                    location: "body",
                  },
                ],
                data: {
                  accountExists: true,
                  verified: false,
                  verificationEmailSent: true,
                },
              };
            } catch (emailError) {
              logger.error(
                `Failed to send verification reminder: ${emailError.message}`
              );

              return {
                success: false,
                message: "Account exists but is not verified",
                status: httpStatus.CONFLICT,
                errors: [
                  {
                    param: "email",
                    message:
                      "This email is already registered but not verified. Please check your email for the verification link or contact support.",
                    location: "body",
                  },
                ],
              };
            }
          }
        }

        // ✅ STEP 3: Proceed with normal user creation
        const userBody = request.body;
        const newRequest = Object.assign(
          {
            userName: email,
            password,
            analyticsVersion: 3,
            ...(userBody.interests && { interests: userBody.interests }),
            ...(userBody.interestsDescription && {
              interestsDescription: userBody.interestsDescription,
            }),
            ...(userBody.country && { country: userBody.country }),
          },
          userBody
        );

        const responseFromCreateUser = await UserModel(dbTenant).register(
          newRequest,
          next,
          { sendDuplicateEmail: true }
        );

        if (!responseFromCreateUser) {
          return {
            success: false,
            message: "Failed to create user",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: [{ message: "User creation failed" }],
          };
        }

        if (responseFromCreateUser.success === true) {
          if (responseFromCreateUser.status === httpStatus.NO_CONTENT) {
            return responseFromCreateUser;
          }

          const createdUser = await responseFromCreateUser.data;
          const user_id = createdUser._doc._id;

          // PostHog Analytics: Track successful registration
          try {
            analyticsService.track(
              createdUser._doc._id.toString(),
              "user_registered",
              {
                method: "email_password",
                category: category,
              }
            );
          } catch (analyticsError) {
            logger.error(
              `PostHog registration track error: ${analyticsError.message}`
            );
          }

          const token = accessCodeGenerator
            .generate(
              constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
            )
            .toUpperCase();

          const tokenCreationBody = {
            token,
            name: createdUser._doc.firstName,
          };

          const responseFromCreateToken = await VerifyTokenModel(
            dbTenant
          ).register(tokenCreationBody, next);

          if (responseFromCreateToken.success === false) {
            return responseFromCreateToken;
          }

          // ✅ STEP 4: Enhanced email sending with monitoring
          const responseFromSendEmail = await mailer.verifyEmail(
            {
              user_id,
              token,
              email: createdUser._doc.email,
              firstName: createdUser._doc.firstName,
              category,
            },
            next
          );

          if (responseFromSendEmail) {
            if (responseFromSendEmail.success === true) {
              const userDetails = {
                firstName: createdUser._doc.firstName,
                lastName: createdUser._doc.lastName,
                email: createdUser._doc.email,
                verified: createdUser._doc.verified,
              };

              return {
                success: true,
                message:
                  "Registration successful! Please check your email for verification instructions.",
                data: userDetails,
                status: responseFromSendEmail.status || httpStatus.OK,
              };
            } else if (responseFromSendEmail.success === false) {
              return responseFromSendEmail;
            }
          } else {
            logger.error("mailer.verifyEmail did not return a response");
            return {
              success: false,
              message: "User created but verification email failed to send",
              status: httpStatus.PARTIAL_CONTENT,
              errors: [
                {
                  message:
                    "Please contact support to resend verification email",
                },
              ],
            };
          }
        } else if (responseFromCreateUser.success === false) {
          return responseFromCreateUser;
        }
      } finally {
        // ✅ STEP 5: Always cleanup the lock
        registrationLocks.delete(lockKey);
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in user creation: ${error.message}`,
        {
          email: request.body?.email,
          tenant: request.query?.tenant,
          stack: error.stack,
        }
      );

      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: [
          { message: "An unexpected error occurred during registration" },
        ],
      };
    }
  },

  // Enhanced register function in user.util.js
  register: async (request, next) => {
    try {
      const {
        firstName,
        lastName,
        email,
        organization,
        long_organization,
        privilege,
        network_id,
        tenant,
      } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      // ✅ STEP 1: Input validation and normalization
      if (!email || !firstName || !lastName) {
        return {
          success: false,
          message: "Missing required fields",
          status: httpStatus.BAD_REQUEST,
          errors: {
            email: !email ? "Email is required" : undefined,
            firstName: !firstName ? "First name is required" : undefined,
            lastName: !lastName ? "Last name is required" : undefined,
          },
        };
      }

      const normalizedEmail = email.toLowerCase().trim();

      // ✅ STEP 2: Create registration lock to prevent race conditions
      const lockKey = `admin-reg-${normalizedEmail}-${tenant}`;

      if (registrationLocks.has(lockKey)) {
        logger.warn(
          `Duplicate admin registration attempt blocked for ${normalizedEmail}`,
          {
            email: normalizedEmail,
            tenant,
            lockExists: true,
            requestedBy: (request.user && request.user.email) || "unknown",
          }
        );

        return {
          success: false,
          message: "Registration already in progress for this user",
          status: httpStatus.CONFLICT,
          errors: {
            email:
              "A registration for this email is currently being processed. Please wait and try again.",
          },
        };
      }

      // Set lock with automatic cleanup
      registrationLocks.set(lockKey, {
        createdAt: Date.now(),
        createdBy: (request.user && request.user.email) || "unknown",
      });

      setTimeout(() => {
        registrationLocks.delete(lockKey);
      }, 45000); // 45 second lock (longer for admin operations)

      try {
        // ✅ STEP 3: Enhanced duplicate user checking
        const existingUser = await UserModel(tenant)
          .findOne({
            email: normalizedEmail,
          })
          .lean();

        if (!isEmpty(existingUser)) {
          // ✅ Enhanced response with actionable information
          if (existingUser.verified && existingUser.isActive) {
            return {
              success: false,
              message: "User already exists and is active",
              status: httpStatus.CONFLICT,
              errors: {
                email:
                  "This email is already registered with an active, verified account.",
              },
              data: {
                accountExists: true,
                verified: true,
                isActive: true,
                userId: existingUser._id,
                createdAt: existingUser.createdAt,
              },
            };
          } else if (existingUser.verified && !existingUser.isActive) {
            // User exists but is inactive - could reactivate
            return {
              success: false,
              message: "User exists but account is inactive",
              status: httpStatus.CONFLICT,
              errors: {
                email:
                  "This email belongs to an inactive account. Consider reactivating instead of creating new account.",
              },
              data: {
                accountExists: true,
                verified: true,
                isActive: false,
                canReactivate: true,
                userId: existingUser._id,
              },
            };
          } else {
            // User exists but not verified - could resend verification
            return {
              success: false,
              message: "User exists but is not verified",
              status: httpStatus.CONFLICT,
              errors: {
                email:
                  "This email is registered but not verified. Consider resending verification email instead.",
              },
              data: {
                accountExists: true,
                verified: false,
                canResendVerification: true,
                userId: existingUser._id,
              },
            };
          }
        }

        // ✅ STEP 4: Generate secure password with enhanced logging
        const password = accessCodeGenerator.generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(10)
        );

        const requestBody = {
          firstName,
          lastName,
          email: normalizedEmail,
          organization,
          long_organization,
          privilege,
          userName: normalizedEmail,
          password,
          network_id,
          ...(request.body.interests && { interests: request.body.interests }),
          ...(request.body.interestsDescription && {
            interestsDescription: request.body.interestsDescription,
          }),
          ...(request.body.country && { country: request.body.country }),
          // Add metadata for admin-created users
          createdByAdmin: true,
          adminCreatorEmail: (request.user && request.user.email) || "unknown",
        };

        // ✅ STEP 5: Create user with enhanced error handling
        const responseFromCreateUser = await UserModel(tenant).register(
          requestBody,
          next,
          { sendDuplicateEmail: false } // Admin creation shouldn't send duplicate emails
        );

        if (responseFromCreateUser.success === true) {
          const createdUser = responseFromCreateUser.data;

          // PostHog Analytics: Track successful registration
          try {
            analyticsService.track(
              createdUser._doc._id.toString(),
              "user_registered",
              {
                method: "admin_creation",
                organization: organization,
              }
            );
          } catch (analyticsError) {
            logger.error(
              `PostHog registration track error: ${analyticsError.message}`
            );
          }

          // ✅ STEP 6: Enhanced email sending with monitoring
          try {
            const responseFromSendEmail = await mailer.user(
              {
                firstName,
                lastName,
                email: normalizedEmail,
                password,
                tenant,
                type: "user",
              },
              next
            );

            if (responseFromSendEmail) {
              if (responseFromSendEmail.success === true) {
                // ✅ Log successful email delivery

                return {
                  success: true,
                  message: "User successfully created and welcome email sent",
                  data: {
                    user: createdUser._doc,
                    emailSent: true,
                    loginUrl: `${constants.LOGIN_PAGE}`,
                    tempPassword: "Sent via email", // Don't return actual password in response
                  },
                  status: responseFromSendEmail.status || httpStatus.OK,
                };
              } else if (responseFromSendEmail.success === false) {
                // User created but email failed
                logger.error("Admin registration email failed", {
                  email: normalizedEmail,
                  userId: createdUser._doc._id,
                  tenant,
                  emailError: responseFromSendEmail.message,
                });

                return {
                  success: true, // User was created successfully
                  message: "User created but welcome email failed to send",
                  data: {
                    user: createdUser._doc,
                    emailSent: false,
                    tempPassword: password, // Return password since email failed
                    emailError: responseFromSendEmail.message,
                  },
                  status: httpStatus.PARTIAL_CONTENT,
                };
              }
            } else {
              logger.error("mailer.user did not return a response");
              return {
                success: true, // User was created
                message: "User created but email service unavailable",
                data: {
                  user: createdUser._doc,
                  emailSent: false,
                  tempPassword: password, // Return password since email failed
                },
                status: httpStatus.PARTIAL_CONTENT,
              };
            }
          } catch (emailError) {
            logger.error(
              `Admin registration email error: ${emailError.message}`,
              {
                email: normalizedEmail,
                userId: createdUser._doc._id,
                tenant,
                error: emailError.message,
              }
            );

            return {
              success: true, // User was created successfully
              message: "User created but email delivery failed",
              data: {
                user: createdUser._doc,
                emailSent: false,
                tempPassword: password, // Return password since email failed
                emailError: emailError.message,
              },
              status: httpStatus.PARTIAL_CONTENT,
            };
          }
        } else if (responseFromCreateUser.success === false) {
          logger.error("Admin user creation failed", {
            email: normalizedEmail,
            tenant,
            error: responseFromCreateUser.message,
            errors: responseFromCreateUser.errors,
          });

          return responseFromCreateUser;
        }
      } finally {
        // ✅ STEP 7: Always cleanup the lock
        registrationLocks.delete(lockKey);
      }
    } catch (error) {
      logger.error(`🐛🐛 Admin registration error: ${error.message}`, {
        email: request.body?.email,
        tenant: request.query?.tenant,
        requestedBy: (request.user && request.user.email) || "unknown",
        stack: error.stack,
      });

      return {
        success: false,
        message: "Internal Server Error during user registration",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          server:
            "An unexpected error occurred. Please try again or contact support.",
        },
      };
    }
  },
  forgotPassword: async (request, next) => {
    try {
      const { query, body } = request;
      const { version, slug } = body;
      const { tenant } = query;

      const filter = generateFilter.users(request, next);

      const userExists = await UserModel(tenant).exists(filter);

      if (!userExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Sorry, the provided email or username does not belong to a registered user. Please make sure you have entered the correct information or sign up for a new account.",
          })
        );
      }

      const responseFromGenerateResetToken =
        createUserModule.generateResetToken();

      if (responseFromGenerateResetToken.success === true) {
        const token = responseFromGenerateResetToken.data;
        const update = {
          resetPasswordToken: token,
          resetPasswordExpires: Date.now() + 3600000,
        };
        const responseFromModifyUser = await UserModel(
          tenant.toLowerCase()
        ).modify(
          {
            filter,
            update,
          },
          next
        );
        if (responseFromModifyUser.success === true) {
          /**
           * Based on the version number, return something different
           */
          const responseFromSendEmail = await mailer.forgot(
            {
              email: filter.email,
              token,
              tenant,
              version,
              slug,
            },
            next
          );

          if (responseFromSendEmail) {
            logObject("responseFromSendEmail", responseFromSendEmail);
            if (responseFromSendEmail.success === true) {
              return {
                success: true,
                message: "forgot email successfully sent",
                status: httpStatus.OK,
              };
            } else if (responseFromSendEmail.success === false) {
              return responseFromSendEmail;
            }
          } else {
            logger.error("mailer.forgot did not return a response");
            return next(
              new HttpError(
                "Internal Server Error",
                httpStatus.INTERNAL_SERVER_ERROR,
                { message: "Failed to send forgot password email" }
              )
            );
          }
        } else if (responseFromModifyUser.success === false) {
          return responseFromModifyUser;
        }
      } else if (responseFromGenerateResetToken.success === false) {
        return responseFromGenerateResetToken;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateForgottenPassword: async (request, next) => {
    try {
      const { resetPasswordToken, password } = request.body;
      const { tenant } = request.query;

      // 1. Manually validate the new password
      const validationResult = createUserModule._validatePassword(password);
      if (!validationResult.isValid) {
        return next(validationResult.error);
      }

      const timeZone = moment.tz.guess();
      const filter = {
        resetPasswordToken,
        resetPasswordExpires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const updatedUser = await UserModel(
        tenant.toLowerCase()
      ).findOneAndUpdate(
        filter,
        {
          $set: {
            password: password, // pre-hook will hash this
            resetPasswordToken: null,
            resetPasswordExpires: null,
          },
        },
        { new: true, context: "query" } // No runValidators
      );

      if (!updatedUser) {
        // This check now covers both existence and expiration
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Password reset token is invalid or has expired.",
          })
        );
      }
      // 2. Use findOneAndUpdate WITHOUT runValidators
      const { email, firstName, lastName } = updatedUser;
      // Asynchronously send email without blocking the response.
      mailer
        .updateForgottenPassword(
          {
            email,
            firstName,
            lastName,
          },
          next
        )
        .catch((error) => {
          logger.error(
            `Failed to send password reset confirmation email to ${email}: ${error.message}`
          );
        });

      return {
        success: true,
        message: "Password has been reset successfully",
        data: updatedUser.toJSON(),
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateKnownPassword: async (request, next) => {
    try {
      const { old_password, password: new_password } = request.body || {};
      const { tenant } = request.query || {};
      const userId = request.user && request.user._id;
      const dbTenant = tenant ? String(tenant).toLowerCase() : tenant;

      if (!old_password || !new_password) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "old_password and new password are required",
          })
        );
      }

      if (!userId) {
        return next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message: "Missing authenticated user",
          })
        );
      }

      // 1. Manually validate the new password
      const validationResult = createUserModule._validatePassword(new_password);
      if (!validationResult.isValid) {
        return next(validationResult.error);
      }

      const user = await UserModel(dbTenant).findById(userId);

      if (!user) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "User not found",
          })
        );
      }

      // Check if the old password is correct
      const isPasswordValid = await user.authenticateUser(old_password);
      if (!isPasswordValid) {
        return next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message: "Invalid old password",
          })
        );
      }

      if (old_password === new_password) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "New password must be different from old password",
          })
        );
      }

      // 2. Use findOneAndUpdate to avoid .save() validation issues
      const updatedUser = await UserModel(dbTenant).findByIdAndUpdate(
        userId,
        {
          $set: {
            password: new_password, // pre-hook will hash this
            resetPasswordToken: null,
            resetPasswordExpires: null,
          },
        },
        { new: true, context: "query" } // No runValidators
      );

      if (!updatedUser) {
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Failed to update password",
            }
          )
        );
      }

      return {
        success: true,
        message: "Password updated successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in updateKnownPassword: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  update: async (request, next) => {
    try {
      const { query, body, params } = request;
      const { tenant } = { ...body, ...query, ...params };
      const dbTenant = tenant ? String(tenant).toLowerCase() : tenant;

      // 1. Create a sanitized copy of the body for the database update.
      const sanitizedUpdate = { ...body };

      // Comprehensive sanitization for 'interests' field
      if ("interests" in sanitizedUpdate) {
        const interestsValue = sanitizedUpdate.interests;
        if (typeof interestsValue === "string") {
          // If it's a string, trim it. If it's not empty, put it in an array. Otherwise, empty array.
          sanitizedUpdate.interests = interestsValue.trim()
            ? [interestsValue.trim()]
            : [];
        } else if (Array.isArray(interestsValue)) {
          // If it's an array, ensure all elements are strings and filter out any empty ones.
          sanitizedUpdate.interests = interestsValue
            .map((item) => (item ? String(item).trim() : ""))
            .filter(Boolean);
        } else {
          // If it's null, undefined, or another type, remove it from the update payload.
          delete sanitizedUpdate.interests;
        }
      }

      // Drop any keys with undefined values to prevent them from being written to the DB
      Object.keys(sanitizedUpdate).forEach((key) => {
        if (sanitizedUpdate[key] === undefined) {
          delete sanitizedUpdate[key];
        }
      });

      // Fields that should never be updated via this endpoint.
      delete sanitizedUpdate.password;
      delete sanitizedUpdate._id;
      delete sanitizedUpdate.user_id;
      delete sanitizedUpdate.id;
      delete sanitizedUpdate.email;
      delete sanitizedUpdate.userName;

      if (Object.keys(sanitizedUpdate).length === 0) {
        return {
          success: false,
          message: "No updatable fields provided",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Payload contains no mutable fields" },
        };
      }

      // 2. Generate the filter to find the user.
      const filter = generateFilter.users(request, next);
      const user = await UserModel(dbTenant)
        .findOne(filter)
        .lean()
        .select("email firstName lastName");

      if (!user) {
        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "User not found" },
        };
      }

      // 3. Perform the database modification.
      const responseFromModifyUser = await UserModel(dbTenant).modify(
        {
          filter,
          update: { $set: sanitizedUpdate },
        },
        next
      );

      logObject("responseFromModifyUser", responseFromModifyUser);

      if (responseFromModifyUser.success === true) {
        // PostHog Analytics: Update user properties
        try {
          const userId = responseFromModifyUser.data._id.toString();
          const userProperties = { ...sanitizedUpdate };
          // Remove sensitive or irrelevant fields from analytics
          delete userProperties.password;
          delete userProperties.resetPasswordToken;
          delete userProperties.resetPasswordExpires;

          analyticsService.identify(userId, userProperties);
        } catch (analyticsError) {
          logger.error(
            `PostHog identify/update error: ${analyticsError.message}`
          );
        }

        // 4. Prepare the payload for the email notification.
        const emailUpdatePayload = { ...sanitizedUpdate };

        const apiResponseData = responseFromModifyUser.data.toJSON
          ? responseFromModifyUser.data.toJSON()
          : responseFromModifyUser.data;

        if (
          constants.ENVIRONMENT &&
          constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT"
        ) {
          return {
            success: true,
            message: responseFromModifyUser.message,
            data: apiResponseData,
          };
        } else {
          const { email, firstName, lastName } = user;

          const responseFromSendEmail = await mailer.update(
            {
              email,
              firstName,
              lastName,
              updatedUserDetails: emailUpdatePayload,
            },
            next
          );

          if (responseFromSendEmail && responseFromSendEmail.success === true) {
            return {
              success: true,
              message: responseFromModifyUser.message,
              data: apiResponseData,
            };
          } else if (
            responseFromSendEmail &&
            responseFromSendEmail.success === false
          ) {
            return responseFromSendEmail;
          } else {
            logger.error("mailer.update did not return a response");
            return next(
              new HttpError(
                "Internal Server Error",
                httpStatus.INTERNAL_SERVER_ERROR,
                { message: "Failed to send update email" }
              )
            );
          }
        }
      } else {
        return responseFromModifyUser;
      }
    } catch (error) {
      logObject("the util error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  initiatePasswordReset: async ({ email, token, tenant }) => {
    try {
      const update = {
        resetPasswordToken: token,
        resetPasswordExpires: Date.now() + 3600000, // 1 hour
      };

      // Use findOneAndUpdate to atomically update the document
      // This avoids running schema validators on the entire document
      const updatedUser = await UserModel(tenant)
        .findOneAndUpdate({ email }, update, { new: true })
        .lean();

      // If a user was found and updated, send the email.
      if (updatedUser) {
        await mailer.sendPasswordResetEmail({
          email: updatedUser.email,
          token,
          tenant,
        });
      } else {
        // Log that the user was not found, but do not throw an error to the client.
        logger.warn(
          `Password reset requested for non-existent email: ${email} in tenant: ${tenant}`
        );
      }

      // Always return a success message to prevent user enumeration.
      return {
        success: true,
        message:
          "If an account with that email exists, you will receive a password reset code shortly.",
      };
    } catch (error) {
      // This will catch database errors or mailer errors.
      logger.error(
        `🐛🐛 Internal Server Error in initiatePasswordReset: ${error.message}`
      );
      // Re-throw a generic error to be handled by the controller.
      throw new HttpError(
        "Unable to initiate password reset",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message:
            "An internal error occurred during the password reset process.",
        }
      );
    }
  },

  resetPassword: async ({ token, password, tenant }, next) => {
    try {
      // 1. Manually validate the new password
      const validationResult = createUserModule._validatePassword(password);
      if (!validationResult.isValid) {
        return next(validationResult.error);
      }

      const resetPasswordToken = token;
      const timeZone = moment.tz.guess();
      const filter = {
        resetPasswordToken,
        resetPasswordExpires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        filter,
        {
          $set: {
            password: password, // pre-hook will hash this
            resetPasswordToken: null,
            resetPasswordExpires: null,
          },
        },
        { new: true, context: "query" } // No runValidators
      );

      if (!updatedUser) {
        // This check now covers both existence and expiration
        return next(
          new HttpError(
            "Password reset token is invalid or has expired.",
            httpStatus.BAD_REQUEST
          )
        );
      }
      // 2. Use findOneAndUpdate WITHOUT runValidators
      const { email, firstName, lastName } = updatedUser;
      // Asynchronously send email without blocking the response.
      mailer
        .updateForgottenPassword(
          {
            email,
            firstName,
            lastName,
          },
          next
        )
        .catch((error) => {
          logger.error(
            `Failed to send password reset confirmation email to ${email}: ${error.message}`
          );
        });

      return {
        success: true,
        message: "Password reset successful",
        data: updatedUser.toJSON(),
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  generateResetToken: () => {
    try {
      const token = crypto.randomBytes(20).toString("hex");
      return {
        success: true,
        message: "token generated successfully",
        data: token,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  isPasswordTokenValid: async (
    { tenant = "airqo", filter = {} } = {},
    next
  ) => {
    try {
      const dbTenant = tenant ? String(tenant).toLowerCase() : tenant;
      const responseFromListUser = await UserModel(dbTenant).list(
        {
          filter,
        },
        next
      );
      logObject("responseFromListUser", responseFromListUser);
      if (responseFromListUser.success === true) {
        if (
          isEmpty(responseFromListUser.data) ||
          responseFromListUser.data.length > 1
        ) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "password reset link is invalid or has expired",
            })
          );
        } else if (responseFromListUser.data.length === 1) {
          return {
            success: true,
            message: "password reset link is valid",
            status: httpStatus.OK,
            data: responseFromListUser.data[0],
          };
        }
      } else if (responseFromListUser.success === false) {
        return responseFromListUser;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  subscribeToNewsLetter: async (request, next) => {
    try {
      const {
        email,
        tags,
        firstName,
        lastName,
        address,
        city,
        state,
        zipCode,
      } = request.body;

      const subscriberHash = md5(email);
      const listId = constants.MAILCHIMP_LIST_ID;

      const mergeFields = {
        ...(firstName && { FNAME: firstName }),
        ...(lastName && { LNAME: lastName }),
        ...(address && { ADDRESS: address }),
        ...(city && { CITY: city }),
        ...(state && { STATE: state }),
        ...(zipCode && { ZIP: zipCode }),
      };

      const responseFromMailChimp = await mailchimp.lists.setListMember(
        listId,
        subscriberHash,
        {
          email_address: email,
          status_if_new: "subscribed",
          merge_fields: mergeFields,
        }
      );
      const existingTags = responseFromMailChimp.tags.map((tag) => tag.name);

      const allUniqueTags = [...new Set([...existingTags, ...tags])];
      const formattedTags = allUniqueTags.map((tag) => {
        return {
          name: tag,
          status: "active",
        };
      });

      const responseFromUpdateSubscriberTags =
        await mailchimp.lists.updateListMemberTags(
          constants.MAILCHIMP_LIST_ID,
          subscriberHash,
          {
            body: {
              tags: formattedTags,
            },
          }
        );

      if (responseFromUpdateSubscriberTags === null) {
        return {
          success: true,
          status: httpStatus.OK,
          message:
            "successfully subscribed the email address to the AirQo newsletter",
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "unable to Update Subsriber Tags for the newsletter subscription",
            }
          )
        );
      }
    } catch (error) {
      logObject("error.response.body", error.response.body);
      logger.error(
        `🐛🐛 Internal Server Error ${stringify(error.response.body)}`
      );
      next(
        new HttpError("Internal Server Error", error.response.body.status, {
          message: error.message,
          ...error.response.body,
        })
      );
    }
  },
  unSubscribeFromNewsLetter: async (request, next) => {
    try {
      const { email } = request.body;

      const subscriberHash = md5(email.toLowerCase());
      const listId = constants.MAILCHIMP_LIST_ID;

      const responseFromMailChimp = await mailchimp.lists.setListMember(
        listId,
        subscriberHash,
        { email_address: email, status: "unsubscribed" }
      );

      logObject("responseFromMailChimp", responseFromMailChimp);

      if (responseFromMailChimp.status !== "unsubscribed") {
        return next(
          new HttpError(
            `Failed to unsubscribe from newsletter`,
            httpStatus.INTERNAL_SERVER_ERROR
          )
        );
      }

      return {
        success: true,
        status: httpStatus.OK,
        message: `Successfully unsubscribed ${email} from the AirQo newsletter`,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  reSubscribeToNewsLetter: async (request, next) => {
    try {
      return {
        success: false,
        status: httpStatus.NOT_IMPLEMENTED,
        message: "work in progress",
        errors: {
          message: "not yet implemented, work in progress",
        },
      };
      const { email } = request.body;

      const subscriberHash = md5(email.toLowerCase());
      const listId = constants.MAILCHIMP_LIST_ID;

      // Add member to the list
      const responseFromMailChimp = await mailchimp.lists.addListMember(
        listId,
        subscriberHash,
        {
          email_address: email,
          status: "subscribed",
        }
      );

      logObject("responseFromMailChimp", responseFromMailChimp);

      return {
        status: httpStatus.OK,
        success: true,
        message: "Successfully resubscribed to the AirQo newsletter",
      };
    } catch (error) {
      logObject("resubscribe error", error.response.body);
      logger.error(
        `🐛🐛 Internal Server Error ${stringify(error.response.body)}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message, ...error.response.body }
        )
      );
    }
  },
  unSubscribeFromNewsLetterV2: async (request, next) => {
    try {
      const { email } = request.body;

      const subscriberHash = md5(email.toLowerCase());
      const listId = constants.MAILCHIMP_LIST_ID;

      // Delete member permanently
      const responseFromMailChimp =
        await mailchimp.lists.deleteListMemberPermanent(listId, subscriberHash);
      logObject("responseFromMailChimp", responseFromMailChimp);

      if (responseFromMailChimp.status_code !== 200) {
        logObject("responseFromMailChimp", responseFromMailChimp);
        return next(
          new HttpError(
            `Failed to unsubscribe from newsletter: ${responseFromMailChimp.error}`,
            httpStatus.INTERNAL_SERVER_ERROR
          )
        );
      }

      res.status(httpStatus.NO_CONTENT).json({
        success: true,
        message: "Successfully unsubscribed from the AirQo newsletter",
      });
    } catch (error) {
      logObject("error.response.body", error.response.body);

      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", error.response.body.status, {
          message: error.message,
          ...error.response.body,
        })
      );
    }
  },
  deleteMobileUserData: async (request, next) => {
    try {
      const { userId, token } = request.params;

      const userRecord = await admin.auth().getUser(userId);

      let creationTime = userRecord.metadata.creationTime;
      creationTime = creationTime.replace(/\D/g, "");

      const tokenString = `${userId}+${creationTime}`;

      const verificationToken = crypto
        .createHash("sha256")
        .update(tokenString)
        .digest("hex");

      if (token !== verificationToken) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid token",
          })
        );
      }

      try {
        await getAuth().deleteUser(userId);
        const collectionList = [
          constants.FIREBASE_COLLECTION_KYA,
          constants.FIREBASE_COLLECTION_ANALYTICS,
          constants.FIREBASE_COLLECTION_NOTIFICATIONS,
          constants.FIREBASE_COLLECTION_FAVORITE_PLACES,
        ];
        let collectionRef = db.collection(
          `${constants.FIREBASE_COLLECTION_USERS}`
        );
        let docRef = collectionRef.doc(userId);

        docRef
          .delete()
          .then(async () => {
            for (var collection of collectionList) {
              await deleteCollection(
                db,
                `${collection}/${userId}/${userId}`,
                100
              );
              collectionRef = db.collection(`${collection}`);
              docRef = collectionRef.doc(userId);
              docRef.delete();
            }
            logText("Document successfully deleted!");
          })
          .catch((error) => {
            logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);

            next(
              new HttpError(
                "Internal Server Error",
                httpStatus.INTERNAL_SERVER_ERROR,
                {
                  message: error.message,
                }
              )
            );
          });

        return {
          success: true,
          message: "User account has been deleted.",
          status: httpStatus.OK,
        };
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  emailReport: async (request, next) => {
    try {
      const { body, files } = request;
      const { senderEmail, recepientEmails } = body;
      const pdfFile = files.pdf;
      const csvFile = files.csv;

      const normalizedRecepientEmails = Array.isArray(recepientEmails)
        ? recepientEmails
        : [recepientEmails];

      let responseFromSendEmail = {};

      responseFromSendEmail = await mailer.sendReport(
        {
          senderEmail,
          normalizedRecepientEmails,
          pdfFile,
          csvFile,
        },
        next
      );

      if (responseFromSendEmail.success === true) {
        return {
          success: true,
          message: "Successfully sent the Report File",
          status: httpStatus.OK,
        };
      } else if (responseFromSendEmail.success === false) {
        logger.error(`Failed to send Report`);
        const errorObject = responseFromSendEmail.errors
          ? responseFromSendEmail.errors
          : {};
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Failed to send Report",
              ...errorObject,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  subscribeToNotifications: async (request, next) => {
    try {
      let { email, type, tenant, user_id } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!isEmpty(user_id)) {
        const user = await UserModel(tenant)
          .findOne({ _id: user_id })
          .select("email")
          .lean();
        if (isEmpty(user)) {
          return {
            success: false,
            message: "Bad Request Error",
            status: httpStatus.BAD_REQUEST,
            errors: { message: `Provided user_id ${user_id} does not exist` },
          };
        }
        logObject("the email", user.email);
        email = user.email;
      }

      const updatedSubscription = await SubscriptionModel(
        tenant
      ).findOneAndUpdate(
        { email },
        { $set: { [`notifications.${type}`]: true } },
        { new: true, upsert: true }
      );

      if (updatedSubscription) {
        return {
          success: true,
          message: `Successfully Subscribed to ${type} notifications`,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: `Internal Server Error`,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message: `Failed to subscribe users to ${type} notifications`,
          },
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  unSubscribeFromNotifications: async (request, next) => {
    try {
      let { email, type, tenant, user_id } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      if (!isEmpty(user_id)) {
        const user = await UserModel(tenant)
          .findOne({ _id: user_id })
          .select("email")
          .lean();
        if (isEmpty(user)) {
          return {
            success: false,
            message: "Bad Request Error",
            status: httpStatus.BAD_REQUEST,
            errors: { message: `Provided user_id ${user_id} does not exist` },
          };
        }
        email = user.email;
      }

      const updatedSubscription = await SubscriptionModel(
        tenant
      ).findOneAndUpdate(
        { email },
        { $set: { [`notifications.${type}`]: false } },
        { new: true, upsert: true }
      );

      if (updatedSubscription) {
        return {
          success: true,
          message: `Successfully UnSubscribed user from ${type} notifications`,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: `Internal Server Error`,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message: `Failed to UnSubscribe the user from ${type} notifications`,
          },
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  checkNotificationStatus: async (request, next) => {
    try {
      let { email, type, tenant, user_id } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      // If user_id is provided, get the email from the user record
      if (!isEmpty(user_id)) {
        const user = await UserModel(tenant)
          .findOne({ _id: user_id })
          .select("email")
          .lean();

        if (isEmpty(user)) {
          return {
            success: false,
            message: "Bad Request Error",
            status: httpStatus.BAD_REQUEST,
            errors: { message: `Provided user_id ${user_id} does not exist` },
          };
        }

        email = user.email;
      }

      // Validate that we have an email
      if (isEmpty(email)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Email or user_id is required" },
        };
      }

      // Use the SubscriptionModel's checkNotificationStatus method
      const result = await SubscriptionModel(tenant).checkNotificationStatus(
        {
          email,
          type,
        },
        next
      );

      return result;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);

      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  getOrganizationBySlug: async (request, next) => {
    try {
      const { params, query } = request;
      const { org_slug } = params;
      const { tenant } = query;

      const group = await GroupModel(tenant).findOne({
        organization_slug: org_slug,
      });

      if (!group) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "Organization not found",
          })
        );
      }

      return {
        success: true,
        message: "Organization found successfully",
        data: {
          name: group.grp_title,
          slug: group.organization_slug,
          logo: group.grp_profile_picture,
          theme: group.theme,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  registerViaOrgSlug: async (request, next) => {
    try {
      const { body, params, query } = request;
      const { org_slug } = params;
      const { tenant } = query;

      // Find the organization
      const group = await GroupModel(tenant).findOne({
        organization_slug: org_slug,
      });

      if (!group) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "Organization not found",
          })
        );
      }

      // Create user with organization pre-populated
      const userBody = {
        ...body,
        organization: group.grp_title,
        long_organization: group.grp_title,
      };

      // Register the user
      const responseFromCreateUser = await UserModel(tenant).register(
        userBody,
        next
      );

      if (responseFromCreateUser.success === true) {
        const createdUser = responseFromCreateUser.data;
        const user_id = createdUser._doc._id;

        // Generate verification token
        const token = accessCodeGenerator
          .generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
          )
          .toUpperCase();

        // Create token record
        const tokenCreationBody = {
          token,
          name: createdUser._doc.firstName,
        };

        const responseFromCreateToken = await VerifyTokenModel(
          tenant.toLowerCase()
        ).register(tokenCreationBody, next);

        if (responseFromCreateToken.success === false) {
          return responseFromCreateToken;
        }

        // Assign user to the group
        const assignRequest = {
          params: {
            grp_id: group._id,
            user_id: user_id,
          },
          query: { tenant },
        };

        await createGroupUtil.assignOneUser(assignRequest, next);

        // Send verification email with organization context
        const responseFromSendEmail = await mailer.verifyEmail(
          {
            user_id,
            token,
            email: createdUser._doc.email,
            firstName: createdUser._doc.firstName,
            organization: group.grp_title, // Add organization context
            org_slug: org_slug, // Add organization slug for branded links
          },
          next
        );

        // Track analytics event
        logObject("New user registration via branded URL", {
          user_id: user_id,
          org_slug,
          group_id: group._id,
        });

        if (responseFromSendEmail && responseFromSendEmail.success === true) {
          return {
            success: true,
            message:
              "User registered successfully. An email has been sent for verification.",
            data: {
              firstName: createdUser._doc.firstName,
              lastName: createdUser._doc.lastName,
              email: createdUser._doc.email,
              organization: group.grp_title,
              verified: createdUser._doc.verified,
            },
            status: httpStatus.CREATED,
          };
        } else if (
          responseFromSendEmail &&
          responseFromSendEmail.success === false
        ) {
          return responseFromSendEmail;
        } else {
          logger.error("mailer.verifyEmail did not return a response");
          return next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: "Failed to send verification email" }
            )
          );
        }
      }

      return responseFromCreateUser;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  /**
   * Ensures a user has the default AirQo role.
   * This is a non-blocking operation, intended to be called in a fire-and-forget manner.
   */

  ensureDefaultAirqoRole: async (user, tenant) => {
    try {
      let needsUpdate = false;
      const updateQuery = {};

      // --- Create mutable copies of the role arrays, preserving ObjectIDs ---
      const isObjectId = (v) =>
        v &&
        (v instanceof mongoose.Types.ObjectId || v._bsontype === "ObjectID");
      const toObjectId = (v) =>
        isObjectId(v)
          ? v
          : mongoose.Types.ObjectId.isValid(v)
          ? new mongoose.Types.ObjectId(v)
          : v;

      // --- 1. Consolidate duplicate roles for all GROUPS (Safer Implementation) ---
      const groupRoleMap = new Map();
      (user.group_roles || []).forEach((assignment) => {
        if (assignment && assignment.group) {
          const groupId = assignment.group.toString();
          if (!groupRoleMap.has(groupId)) groupRoleMap.set(groupId, []);
          groupRoleMap.get(groupId).push(assignment);
        }
      });

      const consolidatedGroupRoles = [];
      for (const [groupId, assignments] of groupRoleMap.entries()) {
        if (assignments.length > 1) {
          logger.info(
            `[Role Consolidation] User ${user.email} has ${assignments.length} roles for group ${groupId}. Consolidating.`
          );
          const group = await GroupModel(tenant).findById(groupId).lean();
          if (!group) {
            // If group doesn't exist, keep the assignments to be filtered later
            consolidatedGroupRoles.push(...assignments);
            continue;
          }

          let desiredRole;
          if (group.grp_title.toLowerCase() === "airqo") {
            const possibleRoles = await RoleModel(tenant)
              .find({ group_id: groupId })
              .lean();
            const superAdminRole = possibleRoles.find(
              (r) =>
                r.role_code && r.role_code.toUpperCase() === "AIRQO_SUPER_ADMIN"
            );
            const adminRole = possibleRoles.find(
              (r) => r.role_code && r.role_code.toUpperCase() === "AIRQO_ADMIN"
            );
            const defaultUserRole = possibleRoles.find(
              (r) =>
                r.role_code &&
                r.role_code.toUpperCase() === "AIRQO_DEFAULT_USER"
            );
            const userRoleIds = new Set(
              assignments.map((a) => a.role && a.role.toString())
            );

            if (
              superAdminRole &&
              userRoleIds.has(superAdminRole._id.toString())
            ) {
              desiredRole = superAdminRole;
            } else if (adminRole && userRoleIds.has(adminRole._id.toString())) {
              desiredRole = adminRole;
            } else {
              desiredRole = defaultUserRole;
            }
          } else {
            const possibleRoles = await RoleModel(tenant)
              .find({ group_id: mongoose.Types.ObjectId(groupId) })
              .lean();
            const present = new Set(
              assignments.map((a) => a.role && a.role.toString())
            );
            const prefer = (suffix) =>
              possibleRoles.find(
                (r) =>
                  r.role_code &&
                  r.role_code.endsWith(suffix) &&
                  present.has(r._id.toString())
              );
            desiredRole =
              prefer("_SUPER_ADMIN") ||
              prefer("_ADMIN") ||
              prefer("_MANAGER") ||
              prefer("_DEFAULT_MEMBER");

            if (!desiredRole) {
              const orgName = normalizeName(group.grp_title);
              const defaultMember = possibleRoles.find(
                (r) => r.role_code === `${orgName}_DEFAULT_MEMBER`
              );
              desiredRole =
                defaultMember ||
                possibleRoles.find((r) => present.has(r._id.toString()));
            }
          }

          if (desiredRole) {
            const earliestCreatedAt = new Date(
              Math.min(
                ...assignments.map((a) =>
                  new Date(a.createdAt || Date.now()).getTime()
                )
              )
            );
            consolidatedGroupRoles.push({
              group: mongoose.Types.ObjectId(groupId),
              role: desiredRole._id,
              userType: "user",
              createdAt: earliestCreatedAt,
            });
          } else {
            // Fallback: if no desired role is found, keep the first one to prevent data loss
            consolidatedGroupRoles.push(assignments[0]);
          }
        } else {
          // Only one role for this group, keep it.
          consolidatedGroupRoles.push(assignments[0]);
        }
      }
      let finalGroupRoles = consolidatedGroupRoles;

      // --- 2. Consolidate duplicate roles for NETWORKS ---
      const networkRoleMap = new Map();
      (user.network_roles || []).forEach((assignment) => {
        if (assignment && assignment.network) {
          const networkId = assignment.network.toString();
          if (!networkRoleMap.has(networkId)) networkRoleMap.set(networkId, []);
          networkRoleMap.get(networkId).push(assignment);
        }
      });

      const consolidatedNetworkRoles = [];
      for (const [networkId, assignments] of networkRoleMap.entries()) {
        if (assignments.length > 1) {
          logger.info(
            `[Role Consolidation] User ${user.email} has ${assignments.length} roles for network ${networkId}. Consolidating.`
          );
          const network = await NetworkModel(tenant).findById(networkId).lean();
          if (!network) {
            consolidatedNetworkRoles.push(...assignments);
            continue;
          }

          const possibleRoles = await RoleModel(tenant)
            .find({ network_id: mongoose.Types.ObjectId(networkId) })
            .lean();
          const present = new Set(
            assignments.map((a) => a.role && a.role.toString())
          );
          const prefer = (suffix) =>
            possibleRoles.find(
              (r) =>
                r.role_code &&
                r.role_code.endsWith(suffix) &&
                present.has(r._id.toString())
            );
          let desiredRole =
            prefer("_SUPER_ADMIN") ||
            prefer("_ADMIN") ||
            prefer("_MANAGER") ||
            prefer("_DEFAULT_MEMBER");

          if (!desiredRole) {
            const orgName = normalizeName(network.net_name);
            const defaultMember = possibleRoles.find(
              (r) => r.role_code === `${orgName}_DEFAULT_MEMBER`
            );
            desiredRole =
              defaultMember ||
              possibleRoles.find((r) => present.has(r._id.toString()));
          }

          if (desiredRole) {
            const earliestCreatedAtNet = new Date(
              Math.min(
                ...assignments.map((a) =>
                  new Date(a.createdAt || Date.now()).getTime()
                )
              )
            );
            consolidatedNetworkRoles.push({
              network: mongoose.Types.ObjectId(networkId),
              role: desiredRole._id,
              userType: "user",
              createdAt: earliestCreatedAtNet,
            });
          } else {
            consolidatedNetworkRoles.push(assignments[0]);
          }
        } else {
          consolidatedNetworkRoles.push(assignments[0]);
        }
      }
      let finalNetworkRoles = consolidatedNetworkRoles;

      // --- 3. Remove Deprecated Roles ---
      const deprecatedRoleNames = constants.DEPRECATED_ROLE_NAMES;
      const deprecatedRoles = await RoleModel(tenant)
        .find({ role_name: { $in: deprecatedRoleNames } })
        .select("_id")
        .lean();
      const deprecatedRoleIds = new Set(
        deprecatedRoles.map((r) => r._id.toString())
      );

      if (deprecatedRoleIds.size > 0) {
        finalGroupRoles = finalGroupRoles.filter(
          (a) => a.role && !deprecatedRoleIds.has(a.role.toString())
        );
        finalNetworkRoles = finalNetworkRoles.filter(
          (a) => a.role && !deprecatedRoleIds.has(a.role.toString())
        );
      }

      // --- 4. Add default AirQo role if missing ---
      const airqoGroup = await GroupModel(tenant)
        .findOne({ grp_title: { $regex: /^airqo$/i } })
        .lean();
      if (airqoGroup) {
        const hasAirqoRole = finalGroupRoles.some(
          (a) => a.group && a.group.toString() === airqoGroup._id.toString()
        );
        if (
          !hasAirqoRole &&
          (user.organization || "").toLowerCase() === "airqo"
        ) {
          const defaultAirqoRole = await RoleModel(tenant)
            .findOne({
              role_code: "AIRQO_DEFAULT_USER",
              group_id: airqoGroup._id,
            })
            .lean();
          if (defaultAirqoRole) {
            finalGroupRoles.push({
              group: airqoGroup._id,
              role: defaultAirqoRole._id,
              userType: "user",
              createdAt: new Date(),
            });
          }
        }
      }

      // --- 5. Compare final arrays with originals to see if an update is needed ---
      const canonicalize = (arr, type) => {
        if (!Array.isArray(arr)) {
          return [];
        }
        return arr
          .map((a) => {
            if (!a) return null;
            const ctxId = type === "group" ? a.group : a.network;
            return {
              ctx: ctxId ? ctxId.toString() : null,
              role: a.role ? a.role.toString() : null,
              userType: a.userType || "user",
            };
          })
          .filter((x) => x && x.ctx && x.role)
          .sort(
            (x, y) => x.ctx.localeCompare(y.ctx) || x.role.localeCompare(y.role)
          );
      };

      const originalGroupCanon = canonicalize(user.group_roles, "group");
      const finalGroupCanon = canonicalize(finalGroupRoles, "group");
      const originalNetCanon = canonicalize(user.network_roles, "network");
      const finalNetCanon = canonicalize(finalNetworkRoles, "network");

      if (
        JSON.stringify(originalGroupCanon) !==
          JSON.stringify(finalGroupCanon) ||
        JSON.stringify(originalNetCanon) !== JSON.stringify(finalNetCanon)
      ) {
        // keep DB arrays deterministically ordered as well
        finalGroupRoles = finalGroupRoles
          .filter((r) => r && r.group && r.role)
          .sort(
            (a, b) =>
              a.group.toString().localeCompare(b.group.toString()) ||
              a.role.toString().localeCompare(b.role.toString())
          );
        finalNetworkRoles = finalNetworkRoles
          .filter((r) => r && r.network && r.role)
          .sort(
            (a, b) =>
              a.network.toString().localeCompare(b.network.toString()) ||
              a.role.toString().localeCompare(b.role.toString())
          );
        updateQuery.$set = {
          group_roles: finalGroupRoles,
          network_roles: finalNetworkRoles,
        };
        needsUpdate = true;
      }

      // --- 6. Handle other cleanups ---
      if (user.privilege) {
        updateQuery.$unset = { privilege: "" };
        needsUpdate = true;
      }

      // --- 7. Execute the update if anything changed ---
      if (needsUpdate) {
        await UserModel(tenant).findByIdAndUpdate(user._id, updateQuery);
        logger.info(
          `[Role Cleanup] Successfully consolidated and cleaned roles for user ${user.email}.`
        );
      }
    } catch (error) {
      logger.error(
        `[Role Cleanup] Error during role cleanup for ${
          user ? user.email : "unknown user"
        }: ${error.message}`
      );
    }
  },

  /**
   * Determines the effective token strategy for a user.
   * Priority: Request override > User preference > System default.
   */
  _getEffectiveTokenStrategy: (user, preferredStrategyFromRequest) => {
    // This function determines the safest and most effective token strategy for a user login.
    // It prioritizes security and stability by preventing the generation of oversized tokens
    // that can cause gateway errors (502 Bad Gateway).

    const { tokenConfig } = require("@config/tokenStrategyConfig");

    // Define strategies that are known to be large and should be avoided for login tokens.
    const DISALLOWED_STRATEGIES = new Set([
      constants.TOKEN_STRATEGIES.LEGACY,
      constants.TOKEN_STRATEGIES.STANDARD,
    ]);

    const SAFE_FALLBACK_STRATEGY =
      constants.TOKEN_STRATEGIES.NO_ROLES_AND_PERMISSIONS;

    // Determine the initial desired strategy based on priority:
    // 1. Strategy passed in the current request body.
    // 2. User's saved preference in their profile.
    // 3. System-wide default strategy.
    let desiredStrategy =
      preferredStrategyFromRequest ||
      user.preferredTokenStrategy ||
      tokenConfig.defaultStrategy;

    // If a global override is active (e.g., for emergency mitigation), it takes highest priority.
    if (constants.FORCE_SAFE_TOKEN_STRATEGY === true) {
      if (desiredStrategy !== SAFE_FALLBACK_STRATEGY) {
        logger.warn(
          `FORCE_SAFE_TOKEN_STRATEGY is active. Overriding requested strategy '${desiredStrategy}' with '${SAFE_FALLBACK_STRATEGY}' for user ${user.email}.`
        );
      }
      logger.info(
        `Using forced safe token strategy: ${SAFE_FALLBACK_STRATEGY}`
      );
      return SAFE_FALLBACK_STRATEGY;
    }

    // Validate if the desired strategy is a known, valid strategy.
    if (!Object.values(constants.TOKEN_STRATEGIES).includes(desiredStrategy)) {
      logger.warn(
        `Invalid token strategy '${desiredStrategy}' requested for user ${user.email}. Falling back to '${SAFE_FALLBACK_STRATEGY}'.`
      );
      return SAFE_FALLBACK_STRATEGY;
    }

    // Prevent the use of disallowed large strategies for login.
    if (DISALLOWED_STRATEGIES.has(desiredStrategy)) {
      logger.warn(
        `Disallowed large token strategy '${desiredStrategy}' was requested for user ${user.email}. Overriding with '${SAFE_FALLBACK_STRATEGY}' to prevent potential login issues.`
      );
      return SAFE_FALLBACK_STRATEGY;
    }

    // If the strategy is valid and allowed, use it.
    logger.info(
      `Using effective token strategy '${desiredStrategy}' for user ${user.email}.`
    );
    return desiredStrategy;
  },
  /**
   * Centralized handler for user verification status.
   * @param {object} user - The user object to check.
   * @returns {object} A status object indicating the verification state.
   */
  _handleVerification: (user) => {
    if (!user) {
      return { shouldProceed: false, message: "User not found" };
    }
    if (user.verified) {
      return { shouldProceed: true };
    }

    if (user.analyticsVersion === 3) {
      return {
        shouldProceed: false,
        requiresV3Reminder: true,
        message:
          "Account not verified, verification email has been sent to your email.",
      };
    }

    if (user.analyticsVersion === 4) {
      return {
        shouldProceed: false,
        requiresV4Reminder: true,
        message:
          "Account not verified, verification email has been sent to your email.",
      };
    }

    // For other versions (e.g., 2 or undefined), allow login to proceed,
    // but do NOT auto-verify here. Call-sites must decide explicitly.
    return { shouldProceed: true };
  },

  /**
   * Constructs the standard update payload for a user upon successful login.
   * @param {object} user - The user object.
   * @param {object} verificationResult - The result from _handleVerification.
   * @param {string} [strategy=null] - The token strategy for migration purposes.
   * @returns {object} The MongoDB update object.
   */
  _constructLoginUpdate: (
    user,
    strategy = null,
    { autoVerify = false } = {}
  ) => {
    const currentDate = new Date();
    const updatePayload = {
      $set: {
        lastLogin: currentDate,
        isActive: true,
      },
      $inc: { loginCount: 1 },
    };

    if (autoVerify && user.verified !== true) {
      updatePayload.$set.verified = true;
    }

    // Handle one-time token strategy migration (only for enhanced login)
    if (
      strategy &&
      (!user.preferredTokenStrategy ||
        user.preferredTokenStrategy === constants.TOKEN_STRATEGIES.LEGACY ||
        user.preferredTokenStrategy === constants.TOKEN_STRATEGIES.STANDARD)
    ) {
      updatePayload.$set.preferredTokenStrategy = strategy;
      updatePayload.$set.tokenStrategyMigratedAt = new Date();
    }

    return updatePayload;
  },
  /**
   * Enhanced login with comprehensive role/permission data and optimized tokens
   */
  loginWithEnhancedTokens: async (request, next) => {
    try {
      const body = request.body || {};
      const query = request.query || {};
      const { email, password, preferredStrategy, includeDebugInfo } = body;
      const { tenant } = query;

      console.log("🔐 ENHANCED LOGIN:", {
        email,
        tenant,
        preferredStrategy,
        includeDebugInfo,
      });

      // Input validation
      if (!email || !password) {
        return {
          success: false,
          message: "Email and password are required",
          status: httpStatus.BAD_REQUEST,
          errors: {
            email: !email ? "Email is required" : undefined,
            password: !password ? "Password is required" : undefined,
          },
        };
      }

      const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";

      // Find user by email
      const user = await UserModel(dbTenant).findOne({ email }).exec();

      if (!user) {
        return {
          success: false,
          message: "Invalid login credentials provided",
          status: httpStatus.UNAUTHORIZED,
          errors: {
            credentials: "The email or password you entered is incorrect.",
          },
        };
      }

      // Verify password
      const isPasswordValid = await user.authenticateUser(password);
      if (!isPasswordValid) {
        return {
          success: false,
          message: "Invalid login credentials provided",
          status: httpStatus.UNAUTHORIZED,
          errors: {
            credentials: "The email or password you entered is incorrect.",
          },
        };
      }

      // Centralized verification check
      const verificationResult = createUserModule._handleVerification(user);
      if (!verificationResult.shouldProceed) {
        try {
          if (verificationResult.requiresV3Reminder) {
            await createUserModule.verificationReminder(
              { tenant: dbTenant, email: user.email },
              next
            );
          } else if (verificationResult.requiresV4Reminder) {
            await createUserModule.mobileVerificationReminder(
              { tenant: dbTenant, email: user.email },
              next
            );
          }
        } catch (reminderErr) {
          logger.warn(`Verification reminder failed: ${reminderErr.message}`);
        }
        return {
          success: false,
          message: verificationResult.message,
          status: httpStatus.FORBIDDEN,
          errors: {
            verification: "Email not verified",
          },
        };
      }

      // PostHog Analytics: Track successful login
      try {
        analyticsService.track(user._id.toString(), "user_logged_in", {
          method: "email_password",
        });
      } catch (analyticsError) {
        logger.error(`PostHog login track error: ${analyticsError.message}`);
      }

      // Initialize RBAC service
      const rbacService = new RBACService(dbTenant);

      // Get comprehensive permission data
      console.log("🔍 Getting comprehensive permissions for user:", user._id);
      const loginPermissions = await rbacService.getUserPermissionsForLogin(
        user._id
      );

      console.log("✅ Permissions calculated:", {
        allCount: loginPermissions.allPermissions?.length || 0,
        systemCount: loginPermissions.systemPermissions?.length || 0,
        groupCount: Object.keys(loginPermissions.groupPermissions).length,
        networkCount: Object.keys(loginPermissions.networkPermissions).length,
        isSuperAdmin: loginPermissions.isSuperAdmin,
      });

      // Determine token strategy
      const strategy = createUserModule._getEffectiveTokenStrategy(
        user,
        preferredStrategy
      );

      console.log("🎯 Using token strategy:", strategy);

      // Initialize token factory
      const tokenFactory = new AbstractTokenFactory(dbTenant);

      const populatedUser = await createUserModule._populateUserDataManually(
        user,
        dbTenant
      );

      // --- START of new logic ---

      // Define a transition period cutoff date from constants, with fallbacks.
      let transitionCutoffDate = new Date(
        (constants.AUTH && constants.AUTH.TOKEN_TRANSITION_CUTOFF_DATE) ||
          process.env.TOKEN_TRANSITION_CUTOFF_DATE ||
          "2025-10-15T00:00:00Z"
      );

      // Validate the date to prevent errors from invalid configuration.
      if (Number.isNaN(transitionCutoffDate.getTime())) {
        logger.error(
          "Invalid TOKEN_TRANSITION_CUTOFF_DATE. Falling back to standard 24h expiration."
        );
        transitionCutoffDate = new Date(0); // A date in the past.
      }

      const now = new Date();
      const isWithinTransitionPeriod = now < transitionCutoffDate;
      // Set the default token expiration. This will be used after the transition period ends.
      let effectiveExpiresIn =
        (constants.AUTH && constants.AUTH.DEFAULT_TOKEN_EXPIRATION) || "24h";

      /**
       * Token Expiration Logic:
       * 1. If we are WITHIN the transition period (before the cutoff date),
       *    calculate a dynamic expiry to last until the cutoff date. This gives
       *    all clients, especially mobile apps, a grace period to update.
       * 2. If we are AFTER the transition period, use the standard default expiration (e.g., "24h").
       */
      if (isWithinTransitionPeriod) {
        const remainingMilliseconds =
          transitionCutoffDate.getTime() - now.getTime();
        const remainingDays = Math.ceil(
          remainingMilliseconds / (1000 * 60 * 60 * 24)
        );
        // The token should last for the remaining transition period, but not less than 24 hours.
        effectiveExpiresIn = `${Math.max(1, remainingDays)}d`;
      }

      logger.info(`Token generation policy for ${user.email}:`, {
        isWithinTransitionPeriod,
        expiresIn: effectiveExpiresIn,
        transitionCutoff: transitionCutoffDate.toISOString(),
      });

      // Generate enhanced token
      const token = await tokenFactory.createToken(populatedUser, strategy, {
        expiresIn: effectiveExpiresIn,
        includePermissions:
          strategy !== constants.TOKEN_STRATEGIES.NO_ROLES_AND_PERMISSIONS,
      });

      // --- END of new logic ---

      if (!token) {
        return {
          success: false,
          message: "Failed to generate authentication token",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      // Update login statistics
      (async () => {
        try {
          // Decide if auto-verification should happen.
          // This preserves the original business logic for legacy users.
          const shouldAutoVerify =
            verificationResult.shouldProceed &&
            user.verified !== true &&
            user.analyticsVersion !== 3 &&
            user.analyticsVersion !== 4;

          const updatePayload = createUserModule._constructLoginUpdate(
            user,
            strategy,
            { autoVerify: shouldAutoVerify }
          );
          const updatedUser = await UserModel(dbTenant).findOneAndUpdate(
            { _id: user._id },
            updatePayload,
            { new: true, upsert: false, runValidators: true }
          );
          if (updatedUser) {
            await createUserModule.ensureDefaultAirqoRole(
              updatedUser,
              dbTenant
            );
          }
        } catch (updateError) {
          logger.error(
            `Login stats/roles update error: ${updateError.message}`
          );
        }
      })();

      // Build comprehensive auth response
      const authResponse = {
        // Basic user info
        _id: user._id,
        userName: user.userName ?? null,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        userType: user.userType ?? null,
        verified: user.verified ?? false,
        isActive: user.isActive ?? false,

        // Legacy fields for backward compatibility
        organization: user.organization ?? null,
        long_organization: user.long_organization ?? null,
        privilege: user.privilege ?? null,
        country: user.country ?? null,
        profilePicture: user.profilePicture ?? null,
        phoneNumber: user.phoneNumber ?? null,
        interests: user.interests ?? [],
        interestsDescription: user.interestsDescription ?? null,

        // Enhanced authentication
        token: `JWT ${token}`,

        // --- REMOVED FOR SCALABILITY ---
        // The following large data fields are removed to prevent oversized login responses
        // which can cause 502 Bad Gateway errors. Clients should fetch this data
        // via dedicated endpoints (e.g., /api/v2/users/profile/enhanced) after login.
        //
        // permissions: loginPermissions.allPermissions,
        // systemPermissions: loginPermissions.systemPermissions,
        // groupPermissions: loginPermissions.groupPermissions,
        // networkPermissions: loginPermissions.networkPermissions,
        // groupMemberships: loginPermissions.groupMemberships,
        // networkMemberships: loginPermissions.networkMemberships,

        // User flags (small and useful for initial UI setup)
        isSuperAdmin: loginPermissions.isSuperAdmin,
        hasGroupAccess: loginPermissions.groupMemberships.length > 0,
        hasNetworkAccess: loginPermissions.networkMemberships.length > 0,

        // Context info
        defaultGroup:
          loginPermissions.groupMemberships.length > 0
            ? loginPermissions.groupMemberships[0].group.id
            : null,
        defaultNetwork:
          loginPermissions.networkMemberships.length > 0
            ? loginPermissions.networkMemberships[0].network.id
            : null,

        // Login metadata
        lastLogin: new Date(),
        loginCount: (user.loginCount || 0) + 1,

        // Token metadata
        tokenStrategy: strategy,
        tokenSize: Buffer.byteLength(token, "utf8"),

        // Debug info (development only)
        ...(includeDebugInfo &&
          process.env.NODE_ENV === "development" && {
            debugInfo: {
              permissionSources: {
                system: loginPermissions.systemPermissions.length,
                groups: Object.keys(loginPermissions.groupPermissions).reduce(
                  (sum, groupId) =>
                    sum + loginPermissions.groupPermissions[groupId].length,
                  0
                ),
                networks: Object.keys(
                  loginPermissions.networkPermissions
                ).reduce(
                  (sum, networkId) =>
                    sum + loginPermissions.networkPermissions[networkId].length,
                  0
                ),
              },
              tokenCompressionRatio:
                strategy !== constants.TOKEN_STRATEGIES.LEGACY
                  ? (
                      (1 - Buffer.byteLength(token, "utf8") / 2000) *
                      100
                    ).toFixed(1) + "%"
                  : "0%",
              cacheStatus: "fresh",
            },
          }),
      };

      console.log("🎉 Enhanced login successful:", {
        userId: authResponse._id,
        permissionsCount: (authResponse.permissions || []).length,
        groupMemberships: (authResponse.groupMemberships || []).length,
        networkMemberships: (authResponse.networkMemberships || []).length,
        tokenStrategy: strategy,
        tokenSize: authResponse.tokenSize,
      });

      return {
        success: true,
        message: "Login successful",
        data: authResponse,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛 Enhanced login error: ${error.message}`);
      console.error("❌ ENHANCED LOGIN ERROR:", error);

      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          server: "An unexpected error occurred during login",
        },
      };
    }
  },

  _populateUserDataManually: async (user, tenant) => {
    try {
      const userObj = user.toObject ? user.toObject() : user;

      // Initialize models
      const PermissionModel = require("@models/Permission");
      const GroupModel = require("@models/Group");
      const NetworkModel = require("@models/Network");

      // Try to get Role model, fallback if not available
      let RoleModel = null;
      try {
        RoleModel = require("@models/Role");
      } catch (roleError) {
        console.warn("⚠️ Role model not available, skipping role population");
      }

      // ✅ OPTIMIZATION 1: Collect all IDs upfront for batch queries
      const permissionIds = (userObj.permissions || []).filter(Boolean);
      const groupIds =
        (userObj.group_roles || []).map((gr) => gr.group).filter(Boolean) || [];
      const networkIds =
        (userObj.network_roles || []).map((nr) => nr.network).filter(Boolean) ||
        [];
      const groupRoleIds =
        (userObj.group_roles || []).map((gr) => gr.role).filter(Boolean) || [];
      const networkRoleIds =
        (userObj.network_roles || []).map((nr) => nr.role).filter(Boolean) ||
        [];
      const allRoleIds = [...new Set([...groupRoleIds, ...networkRoleIds])]; // Remove duplicates

      // ✅ OPTIMIZATION 2: Prepare all queries for parallel execution
      const queryPromises = [];
      const queryMap = {};

      // 1. Permissions query
      if (permissionIds.length > 0) {
        queryPromises.push(
          PermissionModel(tenant)
            .find({ _id: { $in: permissionIds } })
            .select("permission description")
            .lean()
            .catch((error) => {
              console.warn("⚠️ Failed to populate permissions:", error.message);
              return [];
            })
        );
        queryMap.permissions = queryPromises.length - 1;
      }

      // 2. Groups query
      if (groupIds.length > 0) {
        queryPromises.push(
          GroupModel(tenant)
            .find({ _id: { $in: groupIds } })
            .select("grp_title grp_status organization_slug")
            .lean()
            .catch((error) => {
              console.warn("⚠️ Failed to populate groups:", error.message);
              return [];
            })
        );
        queryMap.groups = queryPromises.length - 1;
      }

      // 3. Networks query
      if (networkIds.length > 0) {
        queryPromises.push(
          NetworkModel(tenant)
            .find({ _id: { $in: networkIds } })
            .select("net_name net_status net_acronym")
            .lean()
            .catch((error) => {
              console.warn("⚠️ Failed to populate networks:", error.message);
              return [];
            })
        );
        queryMap.networks = queryPromises.length - 1;
      }

      // 4. Roles query
      if (RoleModel && allRoleIds.length > 0) {
        queryPromises.push(
          RoleModel(tenant)
            .find({ _id: { $in: allRoleIds } })
            .select("role_name role_permissions")
            .lean()
            .catch((error) => {
              console.warn("⚠️ Failed to populate roles:", error.message);
              return [];
            })
        );
        queryMap.roles = queryPromises.length - 1;
      }

      // ✅ OPTIMIZATION 3: Execute all main queries in parallel
      const results = await Promise.all(queryPromises);

      // Extract results
      const permissions =
        queryMap.permissions !== undefined ? results[queryMap.permissions] : [];
      const groups =
        queryMap.groups !== undefined ? results[queryMap.groups] : [];
      const networks =
        queryMap.networks !== undefined ? results[queryMap.networks] : [];
      const roles = queryMap.roles !== undefined ? results[queryMap.roles] : [];

      // ✅ OPTIMIZATION 4: Batch role permissions query
      let rolePermissions = [];
      if (roles.length > 0) {
        const allRolePermissionIds = [
          ...new Set( // Remove duplicates
            roles.flatMap((role) => role.role_permissions || []).filter(Boolean)
          ),
        ];

        if (allRolePermissionIds.length > 0) {
          try {
            rolePermissions = await PermissionModel(tenant)
              .find({ _id: { $in: allRolePermissionIds } })
              .select("permission description")
              .lean();
          } catch (rolePermError) {
            console.warn(
              "⚠️ Failed to populate role permissions:",
              rolePermError.message
            );
          }
        }
      }

      // ✅ OPTIMIZATION 5: Create lookup maps for O(1) access
      const groupsMap = new Map(groups.map((g) => [g._id.toString(), g]));
      const networksMap = new Map(networks.map((n) => [n._id.toString(), n]));
      const rolesMap = new Map(roles.map((r) => [r._id.toString(), r]));
      const rolePermissionsMap = new Map(
        rolePermissions.map((rp) => [rp._id.toString(), rp])
      );

      // Apply populated data to user object
      userObj.permissions = permissions;

      // ✅ OPTIMIZATION 6: Use optional chaining and map lookups
      if (userObj.group_roles && userObj.group_roles.length > 0) {
        userObj.group_roles = userObj.group_roles.map((groupRole) => ({
          ...groupRole,
          group: groupRole.group
            ? groupsMap.get(groupRole.group.toString()) || groupRole.group
            : null,
          role:
            RoleModel && groupRole.role
              ? (() => {
                  const role = rolesMap.get(groupRole.role.toString());
                  if (role) {
                    return {
                      ...role,
                      role_permissions: role.role_permissions
                        ? rolePermissions.filter((rp) =>
                            role.role_permissions.some(
                              (rpId) =>
                                rpId && rpId.toString() === rp._id.toString()
                            )
                          )
                        : [],
                    };
                  }
                  return groupRole.role;
                })()
              : groupRole.role,
        }));
      }

      if (userObj.network_roles && userObj.network_roles.length > 0) {
        userObj.network_roles = userObj.network_roles.map((networkRole) => ({
          ...networkRole,
          network: networkRole.network
            ? networksMap.get(networkRole.network.toString()) ||
              networkRole.network
            : null,
          role:
            RoleModel && networkRole.role
              ? (() => {
                  const role = rolesMap.get(networkRole.role.toString());
                  if (role) {
                    return {
                      ...role,
                      role_permissions: role.role_permissions
                        ? rolePermissions.filter((rp) =>
                            role.role_permissions.some(
                              (rpId) =>
                                rpId && rpId.toString() === rp._id.toString()
                            )
                          )
                        : [],
                    };
                  }
                  return networkRole.role;
                })()
              : networkRole.role,
        }));
      }

      return userObj;
    } catch (error) {
      console.error("❌ Error in manual population:", error);
      // Return user with basic structure if population fails
      return {
        ...(user.toObject ? user.toObject() : user),
        permissions: user.permissions || [],
        group_roles: user.group_roles || [],
        network_roles: user.network_roles || [],
      };
    }
  },

  /**
   * Generate optimized token for existing user session
   */
  generateOptimizedToken: async (request, next) => {
    try {
      const body = request.body || {};
      const query = request.query || {};
      const { userId, strategy, options } = body;
      const { tenant } = query;

      const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
      const tokenStrategy =
        strategy || constants.TOKEN_STRATEGIES.ULTRA_COMPRESSED;

      const user = await UserModel(dbTenant).findById(userId).lean();

      if (!user) {
        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Use manual population instead of mongoose populate
      const populatedUser = await createUserModule._populateUserDataManually(
        user,
        dbTenant
      );

      const tokenFactory = new AbstractTokenFactory(dbTenant);
      const token = await tokenFactory.createToken(
        populatedUser,
        tokenStrategy,
        options
      );

      return {
        success: true,
        message: "Token generated successfully",
        data: {
          token: `JWT ${token}`,
          strategy: tokenStrategy,
          size: Buffer.byteLength(token, "utf8"),
          expiresIn: (options && options.expiresIn) || "24h",
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Token generation error: ${error.message}`);
      return {
        success: false,
        message: "Failed to generate token",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          server: error.message,
        },
      };
    }
  },

  /**
   * Refresh user permissions and regenerate token
   */
  refreshUserPermissions: async (request, next) => {
    try {
      const body = request.body || {};
      const query = request.query || {};
      const { userId, strategy } = body;
      const { tenant } = query;

      if (!userId) {
        return {
          success: false,
          message: "User ID is required",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";

      // Clear cache for this user
      const rbacService = new RBACService(dbTenant);
      rbacService.clearUserCache(userId);

      // Get fresh permissions
      const loginPermissions = await rbacService.getUserPermissionsForLogin(
        userId
      );

      // Generate new token if strategy specified
      let newToken = null;
      let tokenInfo = null;

      if (strategy) {
        // Get user without populate
        const user = await UserModel(dbTenant).findById(userId).lean();

        if (user) {
          // Use manual population instead of mongoose populate
          const populatedUser =
            await createUserModule._populateUserDataManually(user, dbTenant);

          const tokenFactory = new AbstractTokenFactory(dbTenant);
          newToken = await tokenFactory.createToken(populatedUser, strategy);
          tokenInfo = {
            token: `JWT ${newToken}`,
            strategy: strategy,
            size: Buffer.byteLength(newToken, "utf8"),
          };
        }
      }

      return {
        success: true,
        message: "Permissions refreshed successfully",
        data: {
          permissions: loginPermissions,
          ...(tokenInfo && { tokenInfo }),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Permission refresh error: ${error.message}`);
      return {
        success: false,
        message: "Failed to refresh permissions",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          server: error.message,
        },
      };
    }
  },

  /**
   * Analyze token sizes across different strategies
   */
  analyzeTokenStrategies: async (request, next) => {
    try {
      const body = request.body || {};
      const query = request.query || {};
      const { userId } = body;
      const { tenant } = query;

      if (!userId) {
        return {
          success: false,
          message: "User ID is required",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";

      const user = await UserModel(dbTenant).findById(userId).lean();

      if (!user) {
        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Use manual population instead of mongoose populate
      const populatedUser = await createUserModule._populateUserDataManually(
        user,
        dbTenant
      );

      const tokenFactory = new AbstractTokenFactory(dbTenant);
      // Fix: Use constants.TOKEN_STRATEGIES instead of TOKEN_STRATEGIES
      const strategies = Object.values(constants.TOKEN_STRATEGIES);
      const results = {};
      let baselineSize = 0;

      for (const strategy of strategies) {
        try {
          const token = await tokenFactory.createToken(populatedUser, strategy);
          const size = Buffer.byteLength(token, "utf8");

          // Fix: Use constants.TOKEN_STRATEGIES.LEGACY
          if (strategy === constants.TOKEN_STRATEGIES.LEGACY) {
            baselineSize = size;
          }

          results[strategy] = {
            size: size,
            compression:
              baselineSize > 0
                ? (((baselineSize - size) / baselineSize) * 100).toFixed(1) +
                  "%"
                : "0%",
            tokenPreview: token.substring(0, 50) + "...",
          };

          console.log(
            `📊 ${strategy}: ${size} bytes (${results[strategy].compression} compression)`
          );
        } catch (error) {
          results[strategy] = {
            error: error.message,
            size: 0,
            compression: "N/A",
          };
        }
      }

      return {
        success: true,
        message: "Token analysis completed",
        data: {
          userId,
          baseline: baselineSize,
          strategies: results,
          recommendation:
            createUserModule._getTokenStrategyRecommendation(results),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Token analysis error: ${error.message}`);
      return {
        success: false,
        message: "Failed to analyze token strategies",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          server: error.message,
        },
      };
    }
  },

  /**
   * Get user's current permissions and roles in a specific context
   */
  getUserContextPermissions: async (request, next) => {
    try {
      const body = request.body || {};
      const query = request.query || {};
      const { userId, contextId, contextType } = body;
      const { tenant } = query;

      if (!userId) {
        return {
          success: false,
          message: "User ID is required",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
      const rbacService = new RBACService(dbTenant);

      let permissions;
      if (contextId && contextType) {
        permissions = await rbacService.getUserPermissionsInContext(
          userId,
          contextId,
          contextType
        );
      } else {
        const contextData = await rbacService.getUserPermissionsByContext(
          userId
        );
        permissions = contextData;
      }

      return {
        success: true,
        message: "Context permissions retrieved successfully",
        data: {
          userId,
          contextId,
          contextType,
          permissions,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Context permissions error: ${error.message}`);
      return {
        success: false,
        message: "Failed to get context permissions",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          server: error.message,
        },
      };
    }
  },

  /**
   * Update user's preferred token strategy
   */
  updateTokenStrategy: async (request, next) => {
    try {
      const body = request.body || {};
      const query = request.query || {};
      const { userId, strategy } = body;
      const { tenant } = query;

      if (!userId || !strategy) {
        return {
          success: false,
          message: "User ID and strategy are required",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Fix: Use constants.TOKEN_STRATEGIES instead ofconstants.TOKEN_STRATEGIES from ATF service
      if (!Object.values(constants.TOKEN_STRATEGIES).includes(strategy)) {
        return {
          success: false,
          message: "Invalid token strategy",
          status: httpStatus.BAD_REQUEST,
          errors: {
            strategy: `Must be one of: ${Object.values(
              constants.TOKEN_STRATEGIES
            ).join(", ")}`,
          },
        };
      }

      const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";

      const user = await UserModel(dbTenant).findByIdAndUpdate(
        userId,
        { preferredTokenStrategy: strategy },
        { new: true }
      );

      if (!user) {
        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: "Token strategy updated successfully",
        data: {
          userId,
          preferredTokenStrategy: strategy,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Token strategy update error: ${error.message}`);
      return {
        success: false,
        message: "Failed to update token strategy",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          server: error.message,
        },
      };
    }
  },

  // Private helper methods
  _getTokenStrategyRecommendation: (results) => {
    const strategies = Object.entries(results)
      .filter(([_, result]) => !result.error && result.size > 0)
      .sort((a, b) => a[1].size - b[1].size);

    if (strategies.length === 0) {
      return "No valid strategies found";
    }

    const smallest = strategies[0];
    const recommended =
      strategies.find(
        ([strategy, _]) =>
          // Fix: Use constants.TOKEN_STRATEGIES
          strategy === constants.TOKEN_STRATEGIES.COMPRESSED ||
          strategy === constants.TOKEN_STRATEGIES.HASH_BASED
      ) || smallest;

    return {
      recommended: recommended[0],
      reason: `Best balance of compression (${recommended[1].compression}) and reliability`,
      alternatives: strategies.slice(0, 3).map(([strategy, result]) => ({
        strategy,
        size: result.size,
        compression: result.compression,
      })),
    };
  },
  cleanup: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { cleanupType, dryRun = true } = request.body;

      switch (cleanupType) {
        case "fix-missing-group-roles": {
          return await createUserModule._fixMissingGroupRoles(tenant, dryRun);
        }
        case "fix-email-casing": {
          return await createUserModule._fixEmailCasing(tenant, dryRun);
        }
        case "fix-email-casing-all-collections": {
          return await createUserModule._fixEmailCasingAllCollections(
            tenant,
            dryRun
          );
        }
        default:
          return {
            success: false,
            message: "Invalid cleanupType",
            status: httpStatus.BAD_REQUEST,
          };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in cleanup util: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  _fixMissingGroupRoles: async (tenant, dryRun) => {
    try {
      logText(
        `--- Running cleanup: fix-missing-group-roles for tenant: ${tenant} ---`
      );
      logText(
        dryRun
          ? "DRY RUN: No changes will be saved."
          : "LIVE RUN: Changes will be saved to the database."
      );

      const approvedRequests = await AccessRequestModel(tenant)
        .find({
          status: "approved",
          requestType: "group",
        })
        .lean();

      const summary = {
        totalRequestsChecked: approvedRequests.length,
        usersFixed: 0,
        usersAlreadyMember: 0,
        usersNotFound: 0,
        groupsNotFound: 0,
        rolesNotFound: 0,
        errors: [],
        fixedUserDetails: [],
      };

      for (const req of approvedRequests) {
        const { email, targetId: groupId } = req;

        if (!email || !groupId) {
          summary.errors.push({
            request_id: req._id,
            error: "Missing email or groupId",
          });
          continue;
        }

        const user = await UserModel(tenant).findOne({
          email: email.toLowerCase(),
        });

        if (!user) {
          summary.usersNotFound++;
          continue;
        }

        const isAlreadyMember = user.group_roles.some(
          (role) => role.group && role.group.toString() === groupId.toString()
        );

        if (isAlreadyMember) {
          summary.usersAlreadyMember++;
          continue;
        }

        try {
          const group = await GroupModel(tenant).findById(groupId).lean();
          if (!group) {
            summary.groupsNotFound++;
            continue;
          }

          const orgName = group.grp_title
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "_");
          const defaultRoleName = `${orgName}_DEFAULT_MEMBER`;

          const defaultRole = await RoleModel(tenant)
            .findOne({ role_name: defaultRoleName })
            .lean();

          if (!defaultRole) {
            summary.rolesNotFound++;
            summary.errors.push({
              email,
              groupId,
              error: `Default role "${defaultRoleName}" not found.`,
            });
            continue;
          }

          const newRoleAssignment = {
            group: groupId,
            role: defaultRole._id,
            userType: "user",
            createdAt: new Date(),
          };

          if (!dryRun) {
            await UserModel(tenant).findByIdAndUpdate(user._id, {
              $addToSet: { group_roles: newRoleAssignment },
            });
          }

          summary.usersFixed++;
          summary.fixedUserDetails.push({
            email,
            groupId,
            role: defaultRoleName,
          });
        } catch (error) {
          summary.errors.push({ email, groupId, error: error.message });
        }
      }

      return {
        success: true,
        message: "Cleanup process completed.",
        data: summary,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in _fixMissingGroupRoles: ${error.message}`
      );
      throw error; // Re-throw to be handled by the calling function
    }
  },
  _fixEmailCasing: async (tenant, dryRun) => {
    try {
      const usersWithUppercaseEmails = await UserModel(tenant)
        .find({
          email: { $regex: /[A-Z]/ },
        })
        .lean();

      const summary = {
        totalUsersChecked: usersWithUppercaseEmails.length,
        usersFixed: 0,
        conflictsDetected: 0,
        safeToMigrate: 0,
        errors: [],
        conflictDetails: [],
      };

      // First pass: detect all conflicts
      const conflicts = new Map();
      for (const user of usersWithUppercaseEmails) {
        const lowercaseEmail = user.email.toLowerCase();

        const existingUser = await UserModel(tenant)
          .findOne({
            email: lowercaseEmail,
            _id: { $ne: user._id },
          })
          .lean();

        if (existingUser) {
          conflicts.set(user._id.toString(), {
            originalUser: user,
            conflictingUser: existingUser,
          });
          summary.conflictsDetected++;
        } else {
          summary.safeToMigrate++;
        }
      }

      // Second pass: migrate safe users only
      for (const user of usersWithUppercaseEmails) {
        if (conflicts.has(user._id.toString())) {
          const conflict = conflicts.get(user._id.toString());
          summary.conflictDetails.push({
            userId: user._id,
            email: user.email,
            conflictsWith: conflict.conflictingUser.email,
            action: "skipped - manual review needed",
          });
          continue;
        }

        try {
          if (!dryRun) {
            await UserModel(tenant).findByIdAndUpdate(user._id, {
              email: user.email.toLowerCase(),
            });
          }

          summary.usersFixed++;
        } catch (error) {
          summary.errors.push({
            userId: user._id,
            email: user.email,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        message: "Email casing cleanup completed safely.",
        data: summary,
        status: httpStatus.OK,
      };
    } catch (error) {
      throw error;
    }
  },
  _fixEmailCasingAllCollections: async (tenant, dryRun) => {
    const collections = [
      { model: "User", field: "email" },
      { model: "Network", field: "net_email" },
      { model: "Candidate", field: "email" },
      { model: "Inquiry", field: "email" },
    ];

    const summary = {
      collectionsProcessed: 0,
      totalFixed: 0,
      details: [],
    };

    for (const collection of collections) {
      try {
        const Model = require(`@models/${collection.model}`);
        const result = await createUserModule._fixEmailCasingForCollection(
          Model(tenant),
          collection.field,
          dryRun
        );

        summary.collectionsProcessed++;
        summary.totalFixed += result.usersFixed;
        summary.details.push({
          collection: collection.model,
          field: collection.field,
          ...result,
        });
      } catch (error) {
        summary.details.push({
          collection: collection.model,
          error: error.message,
        });
      }
    }

    return summary;
  },

  _fixEmailCasingForCollection: async (Model, fieldName, dryRun) => {
    const filter = {};
    filter[fieldName] = { $regex: /[A-Z]/ };

    const docs = await Model.find(filter).lean();
    let fixed = 0;

    for (const doc of docs) {
      const originalEmail = doc[fieldName];
      const lowercaseEmail = originalEmail.toLowerCase();

      // Check for conflicts
      const conflictFilter = {};
      conflictFilter[fieldName] = lowercaseEmail;
      conflictFilter._id = { $ne: doc._id };

      const existingDoc = await Model.findOne(conflictFilter).lean();

      if (!existingDoc && !dryRun) {
        const updateFilter = {};
        updateFilter[fieldName] = lowercaseEmail;

        await Model.findByIdAndUpdate(doc._id, updateFilter);
        fixed++;
      }
    }

    return {
      totalChecked: docs.length,
      usersFixed: fixed,
      fieldName,
    };
  },
};

module.exports = {
  ...createUserModule,
  generateNumericToken,
  ensureDefaultAirqoRole: createUserModule.ensureDefaultAirqoRole,
};
