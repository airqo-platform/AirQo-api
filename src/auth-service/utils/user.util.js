const UserModel = require("@models/User");
const SubscriptionModel = require("@models/Subscription");
const VerifyTokenModel = require("@models/VerifyToken");
const { LogModel } = require("@models/log");
const NetworkModel = require("@models/Network");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const crypto = require("crypto");
const isEmpty = require("is-empty");
const { getAuth } = require("firebase-admin/auth");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const mailchimp = require("@config/mailchimp");
const md5 = require("md5");
const accessCodeGenerator = require("generate-password");
const createGroupUtil = require("@utils/group.util.js");

const moment = require("moment-timezone");
const admin = require("firebase-admin");
const { db } = require("@config/firebase-admin");
const ioredis = require("@config/ioredis");
const redis = require("@config/redis");
const util = require("util");
const redisGetAsync = util.promisify(redis.get).bind(redis);
const redisSetAsync = util.promisify(redis.set).bind(redis);
const redisExpireAsync = util.promisify(redis.expire).bind(redis);
const log4js = require("log4js");
const GroupModel = require("@models/Group");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- user util`);
const { logObject, logText, HttpError, stringify } = require("@utils/shared");

const {
  mailer,
  generateFilter,
  generateDateFormatWithoutHrs,
} = require("@utils/common");

const EnhancedRBACService = require("@services/enhancedRBAC.service");
const {
  EnhancedTokenFactory,
  TOKEN_STRATEGIES,
} = require("@services/enhancedTokenFactory.service");

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

const cascadeUserDeletion = async ({ userId, tenant } = {}, next) => {
  try {
    const user = await UserModel(tenant.toLowerCase()).findById(userId);

    if (isEmpty(user)) {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: `User ${userId} not found in the system`,
        })
      );
    }

    const updatedGroup = await GroupModel(tenant).updateMany(
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

    const updatedNetwork = await NetworkModel(tenant).updateMany(
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
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
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
    await redisExpireAsync(cacheID, 0);
    // 10 mins is 600 seconds

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
  getUserStats: async (request, next) => {
    try {
      const { tenant, limit = 1000, skip = 0 } = request.query;
      const filter = generateFilter.logs(request, next);

      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: { email: "$meta.email", endpoint: "$meta.endpoint" },
            service: { $first: "$meta.service" },
            username: { $first: "$meta.username" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            email: "$_id.email",
            endpoint: "$_id.endpoint",
            count: 1,
            service: "$service",
            username: "$username",
          },
        },
      ];

      const getUserStatsResponse = await LogModel(tenant).aggregate(pipeline);
      return {
        success: true,
        message: "Successfully retrieved the user statistics",
        data: getUserStatsResponse,
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
      return;
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
      const { tenant } = {
        ...body,
        ...query,
        ...params,
      };
      const update = body;

      if (!isEmpty(update.password)) {
        delete update.password;
      }
      if (!isEmpty(update._id)) {
        delete update._id;
      }

      const filter = generateFilter.users(request, next);
      const user = await UserModel(tenant.toLowerCase())
        .find(filter)
        .lean()
        .select("email firstName lastName");
      const responseFromModifyUser = await UserModel(
        tenant.toLowerCase()
      ).modify(
        {
          filter,
          update,
        },
        next
      );

      logObject("responseFromModifyUser", responseFromModifyUser);

      if (responseFromModifyUser.success === true) {
        const { _id, ...updatedUserDetails } = responseFromModifyUser.data;

        if (
          constants.ENVIRONMENT &&
          constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT"
        ) {
          return {
            success: true,
            message: responseFromModifyUser.message,
            data: responseFromModifyUser.data,
          };
        } else {
          const email = user[0].email;
          const firstName = user[0].firstName;
          const lastName = user[0].lastName;

          const responseFromSendEmail = await mailer.update(
            { email, firstName, lastName, updatedUserDetails },
            next
          );
          if (responseFromSendEmail) {
            if (responseFromSendEmail.success === true) {
              return {
                success: true,
                message: responseFromModifyUser.message,
                data: responseFromModifyUser.data,
              };
            } else if (responseFromSendEmail.success === false) {
              return responseFromSendEmail;
            }
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
      } else if (responseFromModifyUser.success === false) {
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
      const result = await ioredis.set(cacheID, stringify(data), "EX", 3600);
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

      const result = await ioredis.get(cacheID);
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
      const result = await ioredis.del(cacheID);
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

  delete: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.users(request, next);
      const userId = filter._id;
      const responseFromCascadeDeletion = await cascadeUserDeletion(
        { userId, tenant },
        next
      );
      if (
        responseFromCascadeDeletion &&
        responseFromCascadeDeletion.success === true
      ) {
        const responseFromRemoveUser = await UserModel(
          tenant.toLowerCase()
        ).remove(
          {
            filter,
          },
          next
        );
        return responseFromRemoveUser;
      } else {
        return responseFromCascadeDeletion;
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
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const userData = request.body;
      const verificationToken = generateNumericToken(5);

      const newUserResponse = await UserModel(tenant).register(userData, next);

      if (newUserResponse && newUserResponse.success === true) {
        const newUser = newUserResponse.data;

        const tokenExpiry = 86400; //24hrs in seconds.

        const tokenCreationBody = {
          token: verificationToken,
          name: newUser.firstName,
          expires: new Date(Date.now() + tokenExpiry * 1000), // Set token expiry
        };

        const verifyTokenResponse = await VerifyTokenModel(
          tenant.toLowerCase()
        ).register(tokenCreationBody, next);

        if (verifyTokenResponse && verifyTokenResponse.success === false) {
          // Consider rolling back user creation
          logger.error(
            `Failed to create verification token for user ${newUser.email}: ${verifyTokenResponse.message}`
          );

          return verifyTokenResponse;
        }

        await mailer.sendVerificationEmail({
          email: userData.email,
          token: verificationToken,
        });

        return {
          success: true,
          message: "User registered successfully. Please verify your email.",
          user: newUser,
        };
      } else {
        return newUserResponse;
      }
    } catch (error) {
      logObject("error in reg", error);
      return { success: false, message: error.message };
    }
  },

  verificationReminder: async (request, next) => {
    try {
      const { tenant, email } = request;

      const user = await UserModel(tenant)
        .findOne({ email })
        .select("_id email firstName lastName verified")
        .lean();
      logObject("user", user);
      if (isEmpty(user)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not provided or does not exist",
          })
        );
      }
      const user_id = user._id;

      const token = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
        )
        .toUpperCase();

      const tokenCreationBody = {
        token,
        name: user.firstName,
      };
      const responseFromCreateToken = await VerifyTokenModel(
        tenant.toLowerCase()
      ).register(tokenCreationBody, next);

      if (!responseFromCreateToken) {
        logger.error(
          `🐛🐛 Error creating verification token: responseFromCreateToken is undefined`
        );
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "Failed to create verification token" }
          )
        );
      }

      if (responseFromCreateToken.success === false) {
        return responseFromCreateToken;
      } else {
        const responseFromSendEmail = await mailer.verifyEmail(
          {
            user_id,
            token,
            email,
          },
          next
        );

        if (responseFromSendEmail) {
          logObject("responseFromSendEmail", responseFromSendEmail);
          if (responseFromSendEmail.success === true) {
            const userDetails = {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              verified: user.verified,
            };

            return {
              success: true,
              message: "An Email sent to your account please verify",
              data: userDetails,
              status: responseFromSendEmail.status
                ? responseFromSendEmail.status
                : "",
            };
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else {
          logger.error("mailer.verifyEmail did not return a response");
          return next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: "Failed to send after email verification email" }
            )
          );
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
  mobileVerificationReminder: async (request, next) => {
    try {
      const { tenant, email } = request;

      const user = await UserModel(tenant)
        .findOne({ email })
        .select("_id email firstName lastName verified")
        .lean();

      if (isEmpty(user)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not provided or does not exist",
          })
        );
      }

      const token = generateNumericToken(5);

      const tokenCreationBody = {
        token,
        name: user.firstName,
      };
      const responseFromCreateToken = await VerifyTokenModel(
        tenant.toLowerCase()
      ).register(tokenCreationBody, next);

      if (responseFromCreateToken.success === false) {
        return responseFromCreateToken;
      } else {
        const emailResponse = await mailer.sendVerificationEmail(
          { email, token, tenant },
          next
        );
        logObject("emailResponse", emailResponse);
        if (emailResponse.success === false) {
          logger.error(
            `Failed to send mobile verification email to user (${email}) with id ${user._id}`
          );
          return emailResponse;
        }

        const userDetails = {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          verified: user.verified,
        };
        return {
          success: true,
          message: "Verification code sent to your email.",
          data: userDetails,
        };
      }
    } catch (error) {
      logObject("error in mobileVerificationReminder", error);

      logger.error(`Error sending verification reminder: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  verifyMobileEmail: async (request, next) => {
    try {
      const { email, token, tenant, skip, limit } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const timeZone = moment.tz.guess();
      let filter = {
        token,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const userDetails = await UserModel("airqo")
        .find({
          email,
        })
        .select("_id firstName lastName userName email verified")
        .lean();

      const user = userDetails[0];

      if (isEmpty(user)) {
        return {
          success: false,
          message: "Invalid Verification Token or the User does not exist",
          errors: {
            message: "Invalid Verification Token or the User does not exist",
          },
        };
      }

      const responseFromListAccessToken = await VerifyTokenModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next
      );

      logObject("responseFromListAccessToken", responseFromListAccessToken);
      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          next(
            new HttpError("Invalid link", httpStatus.BAD_REQUEST, {
              message: "incorrect user or token details provided",
            })
          );
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          let update = {
            verified: true,
          };
          filter = { email };

          const responseFromUpdateUser = await UserModel(tenant).modify(
            {
              filter,
              update,
            },
            next
          );

          if (responseFromUpdateUser.success === true) {
            /**
             * we shall also need to handle case where there was no update
             * later...cases where the user never existed in the first place
             * this will not be necessary if user deletion is cascaded.
             */
            if (responseFromUpdateUser.status === httpStatus.BAD_REQUEST) {
              return responseFromUpdateUser;
            }

            filter = { token };
            logObject("the deletion of the token filter", filter);
            const responseFromDeleteToken = await VerifyTokenModel(
              tenant
            ).remove({ filter }, next);

            logObject("responseFromDeleteToken", responseFromDeleteToken);

            if (responseFromDeleteToken.success === true) {
              logObject("user", user);
              const responseFromSendEmail = await mailer.afterEmailVerification(
                {
                  firstName: user.firstName,
                  username: user.userName,
                  email: user.email,
                  analyticsVersion: 4,
                },
                next
              );

              if (responseFromSendEmail.success === true) {
                return {
                  success: true,
                  message: "email verified sucessfully",
                  status: httpStatus.OK,
                };
              } else if (responseFromSendEmail.success === false) {
                return responseFromSendEmail;
              }
            } else if (responseFromDeleteToken.success === false) {
              next(
                new HttpError(
                  "unable to verify user",
                  responseFromDeleteToken.status
                    ? responseFromDeleteToken.status
                    : httpStatus.INTERNAL_SERVER_ERROR,
                  responseFromDeleteToken.errors
                    ? responseFromDeleteToken.errors
                    : { message: "internal server errors" }
                )
              );
            }
          } else if (responseFromUpdateUser.success === false) {
            next(
              new HttpError(
                "unable to verify user",
                responseFromUpdateUser.status
                  ? responseFromUpdateUser.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
                responseFromUpdateUser.errors
                  ? responseFromUpdateUser.errors
                  : { message: "internal server errors" }
              )
            );
          }
        }
      } else if (responseFromListAccessToken.success === false) {
        return responseFromListAccessToken;
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
  verifyEmail: async (request, next) => {
    try {
      const { tenant, limit, skip, user_id, token } = {
        ...request.query,
        ...request.params,
      };
      const timeZone = moment.tz.guess();
      let filter = {
        token,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const userDetails = await UserModel(tenant)
        .find({
          _id: ObjectId(user_id),
        })
        .lean();

      if (isEmpty(userDetails)) {
        next(
          new HttpError("Bad Reqest Error", httpStatus.BAD_REQUEST, {
            message: "User does not exist",
          })
        );
      }

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
          next(
            new HttpError("Invalid link", httpStatus.BAD_REQUEST, {
              message: "incorrect user or token details provided",
            })
          );
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          let update = {
            verified: true,
          };
          filter = { _id: user_id };

          const responseFromUpdateUser = await UserModel(tenant).modify(
            {
              filter,
              update,
            },
            next
          );

          if (responseFromUpdateUser.success === true) {
            /**
             * we shall also need to handle case where there was no update
             * later...cases where the user never existed in the first place
             * this will not be necessary if user deletion is cascaded.
             */
            if (responseFromUpdateUser.status === httpStatus.BAD_REQUEST) {
              return responseFromUpdateUser;
            }

            filter = { token };
            logObject("the deletion of the token filter", filter);
            const responseFromDeleteToken = await VerifyTokenModel(
              tenant
            ).remove({ filter }, next);

            logObject("responseFromDeleteToken", responseFromDeleteToken);

            if (responseFromDeleteToken.success === true) {
              const responseFromSendEmail = await mailer.afterEmailVerification(
                {
                  firstName: userDetails[0].firstName,
                  username: userDetails[0].userName,
                  email: userDetails[0].email,
                },
                next
              );

              if (responseFromSendEmail.success === true) {
                return {
                  success: true,
                  message: "email verified sucessfully",
                  status: httpStatus.OK,
                };
              } else if (responseFromSendEmail.success === false) {
                return responseFromSendEmail;
              }
            } else if (responseFromDeleteToken.success === false) {
              next(
                new HttpError(
                  "unable to verify user",
                  responseFromDeleteToken.status
                    ? responseFromDeleteToken.status
                    : httpStatus.INTERNAL_SERVER_ERROR,
                  responseFromDeleteToken.errors
                    ? responseFromDeleteToken.errors
                    : { message: "internal server errors" }
                )
              );
            }
          } else if (responseFromUpdateUser.success === false) {
            next(
              new HttpError(
                "unable to verify user",
                responseFromUpdateUser.status
                  ? responseFromUpdateUser.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
                responseFromUpdateUser.errors
                  ? responseFromUpdateUser.errors
                  : { message: "internal server errors" }
              )
            );
          }
        }
      } else if (responseFromListAccessToken.success === false) {
        return responseFromListAccessToken;
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
  create: async (request, next) => {
    try {
      const { tenant, firstName, email, password, category } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const user = await UserModel(tenant).findOne({ email });
      if (!isEmpty(user)) {
        return {
          success: false,
          message: "User is already part of the AirQo platform",
          status: httpStatus.BAD_REQUEST,
          errors: [
            {
              param: "email",
              message: "User is already part of the AirQo platform",
              location: "body",
            },
          ],
        };
      }

      const userBody = request.body;
      const newRequest = Object.assign(
        { userName: email, password, analyticsVersion: 3 },
        userBody
      );

      // Pass the sendDuplicateEmail option to true for this specific flow
      const responseFromCreateUser = await UserModel(tenant).register(
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
          tenant.toLowerCase()
        ).register(tokenCreationBody, next);

        if (responseFromCreateToken.success === false) {
          return responseFromCreateToken;
        } else {
          const responseFromSendEmail = await mailer.verifyEmail(
            {
              user_id,
              token,
              email,
              firstName,
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
                message: "An Email sent to your account please verify",
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
              message: "Failed to send verification email",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: [{ message: "Failed to send verification email" }],
            };
          }
        }
      } else if (responseFromCreateUser.success === false) {
        return responseFromCreateUser;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: [{ message: error.message }],
      };
    }
  },
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
      } = request.body;

      const { tenant } = request.query;

      const password = accessCodeGenerator.generate(
        constants.RANDOM_PASSWORD_CONFIGURATION(10)
      );

      let requestBody = {
        firstName,
        lastName,
        email,
        organization,
        long_organization,
        privilege,
        userName: email,
        password,
        network_id,
      };

      const responseFromCreateUser = await UserModel(tenant).register(
        requestBody,
        next
      );

      if (responseFromCreateUser.success === true) {
        const createdUser = await responseFromCreateUser.data;
        logObject("created user in util", createdUser._doc);
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

        if (responseFromSendEmail) {
          logObject("responseFromSendEmail", responseFromSendEmail);
          if (responseFromSendEmail.success === true) {
            return {
              success: true,
              message: "user successfully created",
              data: createdUser._doc,
              status: responseFromSendEmail.status
                ? responseFromSendEmail.status
                : "",
            };
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else {
          logger.error("mailer.user did not return a response");
          return next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: "Failed to send user creation email" }
            )
          );
        }
      } else if (responseFromCreateUser.success === false) {
        return responseFromCreateUser;
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
      const timeZone = moment.tz.guess();
      let filter = {
        resetPasswordToken,
        resetPasswordExpires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      logObject("isPasswordTokenValid FILTER", filter);
      const responseFromCheckTokenValidity =
        await createUserModule.isPasswordTokenValid(
          {
            tenant,
            filter,
          },
          next
        );

      logObject(
        "responseFromCheckTokenValidity",
        responseFromCheckTokenValidity
      );

      if (responseFromCheckTokenValidity.success === true) {
        const update = {
          resetPasswordToken: null,
          resetPasswordExpires: null,
          password,
        };
        const userDetails = responseFromCheckTokenValidity.data;
        logObject("userDetails", userDetails);
        filter = { _id: ObjectId(userDetails._id) };
        logObject("updateForgottenPassword FILTER", filter);
        const responseFromModifyUser = await UserModel(tenant).modify(
          {
            filter,
            update,
          },
          next
        );

        if (responseFromModifyUser.success === true) {
          const { email, firstName, lastName } = userDetails;
          const responseFromSendEmail = await mailer.updateForgottenPassword(
            {
              email,
              firstName,
              lastName,
            },
            next
          );

          if (responseFromSendEmail.success === true) {
            return responseFromModifyUser;
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else if (responseFromModifyUser.success === false) {
          return responseFromModifyUser;
        }
      } else if (responseFromCheckTokenValidity.success === false) {
        return responseFromCheckTokenValidity;
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
  updateKnownPassword: async (request, next) => {
    try {
      const { query, body } = request;
      const { password, old_password, tenant } = { ...body, ...query };
      const filter = generateFilter.users(request, next);
      const user = await UserModel(tenant).find(filter).lean();
      logObject("the user details with lean(", user);

      if (isEmpty(user)) {
        logger.error(
          ` ${user[0].email} --- either your old password is incorrect or the provided user does not exist`
        );
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "either your old password is incorrect or the provided user does not exist",
          })
        );
      }

      if (isEmpty(user[0].password)) {
        logger.error(` ${user[0].email} --- unable to do password lookup`);
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "unable to do password lookup",
            }
          )
        );
      }

      const responseFromBcrypt = await bcrypt.compare(
        old_password,
        user[0].password
      );

      if (responseFromBcrypt === false) {
        logger.error(
          ` ${user[0].email} --- either your old password is incorrect or the provided user does not exist`
        );
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "either your old password is incorrect or the provided user does not exist",
          })
        );
      }

      const update = {
        password: password,
      };
      const responseFromUpdateUser = await UserModel(
        tenant.toLowerCase()
      ).modify(
        {
          filter,
          update,
        },
        next
      );

      if (responseFromUpdateUser.success === true) {
        const { email, firstName, lastName } = user[0];
        const responseFromSendEmail = await mailer.updateKnownPassword(
          {
            email,
            firstName,
            lastName,
          },
          next
        );

        if (responseFromSendEmail) {
          if (responseFromSendEmail.success === true) {
            return responseFromUpdateUser;
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else {
          logger.error("mailer.updateKnownPassword did not return a response");
          return next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: "Failed to send update password email" }
            )
          );
        }
      } else if (responseFromUpdateUser.success === false) {
        return responseFromUpdateUser;
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
  initiatePasswordReset: async ({ email, token, tenant }, next) => {
    try {
      const update = {
        resetPasswordToken: token,
        resetPasswordExpires: Date.now() + 3600000,
      };
      const responseFromModifyUser = await UserModel(tenant)
        .findOneAndUpdate({ email }, update, { new: true })
        .select("firstName lastName email");

      if (isEmpty(responseFromModifyUser)) {
        next(
          new HttpError("Bad Request Error", httpStatus.INTERNAL_SERVER_ERROR, {
            message: "user does not exist, please crosscheck",
          })
        );
      }

      await mailer.sendPasswordResetEmail({ email, token, tenant });

      return {
        success: true,
        message: "Password reset email sent successfully",
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Unable to initiate password reset",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  resetPassword: async ({ token, password, tenant }, next) => {
    try {
      const resetPasswordToken = token;
      const timeZone = moment.tz.guess();
      const filter = {
        resetPasswordToken,
        resetPasswordExpires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const user = await UserModel(tenant).findOne(filter);
      if (!user) {
        throw new HttpError(
          "Password reset token is invalid or has expired.",
          httpStatus.BAD_REQUEST
        );
      }
      const update = {
        resetPasswordToken: null,
        resetPasswordExpires: null,
        password,
      };

      const responseFromModifyUser = await UserModel(tenant)
        .findOneAndUpdate({ _id: ObjectId(user._id) }, update, { new: true })
        .select("firstName lastName email");

      const { email, firstName, lastName } = responseFromModifyUser._doc;

      const responseFromSendEmail = await mailer.updateForgottenPassword(
        {
          email,
          firstName,
          lastName,
        },
        next
      );

      if (responseFromSendEmail) {
        logObject("responseFromSendEmail", responseFromSendEmail);

        if (responseFromSendEmail.success === true) {
          return {
            success: true,
            message: "Password reset successful",
          };
        } else if (responseFromSendEmail.success === false) {
          return responseFromSendEmail;
        }
      } else {
        logger.error(
          "mailer.updateForgottenPassword did not return a response"
        );
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "Failed to send update password email" }
          )
        );
      }
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
  generateResetToken: (next) => {
    try {
      const token = crypto.randomBytes(20).toString("hex");
      return {
        success: true,
        message: "token generated successfully",
        data: token,
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
  isPasswordTokenValid: async (
    { tenant = "airqo", filter = {} } = {},
    next
  ) => {
    try {
      const responseFromListUser = await UserModel(tenant.toLowerCase()).list(
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

      logger.info(
        `Unsubscription attempt: ${stringify(responseFromMailChimp)}`
      );

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

      logger.info(
        `Unsubscription attempt: ${stringify(responseFromMailChimp)}`
      );

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

      const subscription = await SubscriptionModel(tenant).findOne({ email });
      if (!subscription.notifications[type]) {
        return {
          success: false,
          message: `Forbidden`,
          status: httpStatus.FORBIDDEN,
          errors: {
            message: `User is not subscribed to ${type} notifications`,
          },
        };
      } else {
        return {
          success: true,
          message: `User is subscribed to ${type} notifications`,
          status: httpStatus.OK,
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
   * Enhanced login with comprehensive role/permission data and optimized tokens
   */
  loginWithEnhancedTokens: async (request, next) => {
    try {
      const { email, password, tenant, preferredStrategy, includeDebugInfo } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

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
          message: "Invalid credentials",
          status: httpStatus.UNAUTHORIZED,
          errors: {
            email: "No account found with this email address",
          },
        };
      }

      // Verify password
      const isPasswordValid = await user.authenticateUser(password);
      if (!isPasswordValid) {
        return {
          success: false,
          message: "Invalid credentials",
          status: httpStatus.UNAUTHORIZED,
          errors: {
            password: "Incorrect password",
          },
        };
      }

      // Check verification status
      if (!user.verified) {
        return {
          success: false,
          message: "Please verify your email address first",
          status: httpStatus.FORBIDDEN,
          errors: {
            verification: "Email not verified",
          },
        };
      }

      // Check account status
      if (user.analyticsVersion === 3 && user.verified === false) {
        return {
          success: false,
          message: "Account not verified, please check your email",
          status: httpStatus.FORBIDDEN,
        };
      }

      // Initialize RBAC service
      const rbacService = new EnhancedRBACService(dbTenant);

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
      const strategy =
        preferredStrategy ||
        user.preferredTokenStrategy ||
        TOKEN_STRATEGIES.STANDARD;

      console.log("🎯 Using token strategy:", strategy);

      // Initialize token factory
      const tokenFactory = new EnhancedTokenFactory(dbTenant);

      const populatedUser = await createUserModule._populateUserDataManually(
        user,
        dbTenant
      );

      // Generate enhanced token
      const token = await tokenFactory.createToken(populatedUser, strategy, {
        expiresIn: "24h",
        includePermissions: true,
      });

      if (!token) {
        return {
          success: false,
          message: "Failed to generate authentication token",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      // Update login statistics
      const currentDate = new Date();
      try {
        await UserModel(dbTenant).findOneAndUpdate(
          { _id: user._id },
          {
            $set: { lastLogin: currentDate, isActive: true },
            $inc: { loginCount: 1 },
            ...(user.analyticsVersion !== 3 && user.verified === false
              ? { $set: { verified: true } }
              : {}),
          },
          {
            new: true,
            upsert: false,
            runValidators: true,
          }
        );
      } catch (updateError) {
        logger.error(`Login stats update error: ${updateError.message}`);
      }

      // Build comprehensive auth response
      const authResponse = {
        // Basic user info
        _id: user._id,
        userName: user.userName,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        verified: user.verified,
        isActive: user.isActive,

        // Legacy fields for backward compatibility
        organization: user.organization,
        long_organization: user.long_organization,
        privilege: user.privilege,
        country: user.country,
        profilePicture: user.profilePicture,
        phoneNumber: user.phoneNumber,

        // Enhanced authentication
        token: `JWT ${token}`,

        // Comprehensive permissions
        permissions: loginPermissions.allPermissions,
        systemPermissions: loginPermissions.systemPermissions,
        groupPermissions: loginPermissions.groupPermissions,
        networkPermissions: loginPermissions.networkPermissions,

        // Enhanced memberships with detailed info
        groupMemberships: loginPermissions.groupMemberships,
        networkMemberships: loginPermissions.networkMemberships,

        // User flags
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
        lastLogin: currentDate,
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
                strategy !== TOKEN_STRATEGIES.LEGACY
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
        permissionsCount: authResponse.permissions.length,
        groupMemberships: authResponse.groupMemberships.length,
        networkMemberships: authResponse.networkMemberships.length,
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
      const permissionIds = userObj.permissions?.filter(Boolean) || [];
      const groupIds =
        userObj.group_roles?.map((gr) => gr.group).filter(Boolean) || [];
      const networkIds =
        userObj.network_roles?.map((nr) => nr.network).filter(Boolean) || [];
      const groupRoleIds =
        userObj.group_roles?.map((gr) => gr.role).filter(Boolean) || [];
      const networkRoleIds =
        userObj.network_roles?.map((nr) => nr.role).filter(Boolean) || [];
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
      if (userObj.group_roles?.length > 0) {
        userObj.group_roles = userObj.group_roles.map((groupRole) => ({
          ...groupRole,
          group: groupsMap.get(groupRole.group.toString()) || groupRole.group,
          role: RoleModel
            ? (() => {
                const role = rolesMap.get(groupRole.role.toString());
                if (role) {
                  return {
                    ...role,
                    role_permissions: rolePermissions.filter((rp) =>
                      role.role_permissions?.some(
                        (rpId) => rpId.toString() === rp._id.toString()
                      )
                    ),
                  };
                }
                return groupRole.role;
              })()
            : groupRole.role,
        }));
      }

      if (userObj.network_roles?.length > 0) {
        userObj.network_roles = userObj.network_roles.map((networkRole) => ({
          ...networkRole,
          network:
            networksMap.get(networkRole.network.toString()) ||
            networkRole.network,
          role: RoleModel
            ? (() => {
                const role = rolesMap.get(networkRole.role.toString());
                if (role) {
                  return {
                    ...role,
                    role_permissions: rolePermissions.filter((rp) =>
                      role.role_permissions?.some(
                        (rpId) => rpId.toString() === rp._id.toString()
                      )
                    ),
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
      const { userId, tenant, strategy, options } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!userId) {
        return {
          success: false,
          message: "User ID is required",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
      const tokenStrategy = strategy || TOKEN_STRATEGIES.STANDARD;

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

      const tokenFactory = new EnhancedTokenFactory(dbTenant);
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
          expiresIn: options?.expiresIn || "24h",
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
      const { userId, tenant, strategy } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!userId) {
        return {
          success: false,
          message: "User ID is required",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";

      // Clear cache for this user
      const rbacService = new EnhancedRBACService(dbTenant);
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

          const tokenFactory = new EnhancedTokenFactory(dbTenant);
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
      const { userId, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

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

      const tokenFactory = new EnhancedTokenFactory(dbTenant);
      const strategies = Object.values(TOKEN_STRATEGIES);
      const results = {};
      let baselineSize = 0;

      for (const strategy of strategies) {
        try {
          const token = await tokenFactory.createToken(populatedUser, strategy);
          const size = Buffer.byteLength(token, "utf8");

          if (strategy === TOKEN_STRATEGIES.LEGACY) {
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
      const { userId, contextId, contextType, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!userId) {
        return {
          success: false,
          message: "User ID is required",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
      const rbacService = new EnhancedRBACService(dbTenant);

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
      const { userId, strategy, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!userId || !strategy) {
        return {
          success: false,
          message: "User ID and strategy are required",
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (!Object.values(TOKEN_STRATEGIES).includes(strategy)) {
        return {
          success: false,
          message: "Invalid token strategy",
          status: httpStatus.BAD_REQUEST,
          errors: {
            strategy: `Must be one of: ${Object.values(TOKEN_STRATEGIES).join(
              ", "
            )}`,
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
          strategy === TOKEN_STRATEGIES.COMPRESSED ||
          strategy === TOKEN_STRATEGIES.HASH_BASED
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
};

module.exports = { ...createUserModule, generateNumericToken };
