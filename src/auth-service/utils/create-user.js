const UserModel = require("@models/User");
const SubscriptionModel = require("@models/Subscription");
const VerifyTokenModel = require("@models/VerifyToken");
const { LogModel } = require("@models/log");
const NetworkModel = require("@models/Network");
const { logObject, logText } = require("@utils/log");
const mailer = require("@utils/mailer");
const { generateDateFormatWithoutHrs } = require("@utils/date");
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
const generateFilter = require("@utils/generate-filter");
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
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-user-util`);
const { HttpError } = require("@utils/errors");

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
      throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
        message: `User ${userId} not found in the system`,
      });
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
        `error while attempting to delete User from the corresponding Group ${JSON.stringify(
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
        `error while attempting to delete User from the corresponding Network ${JSON.stringify(
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
    logger.error(`🐛🐛 Internal Server Error --- ${JSON.stringify(error)}`);
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
      JSON.stringify({
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
        logger.error(`🐛🐛 Internal Server Errors -- ${JSON.stringify(error)}`);
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
            logger.error(
              `🐛🐛 Internal Server Error -- ${JSON.stringify(errors)}`
            );
          }
        } catch (error) {
          logger.error(
            `🐛🐛 Internal Server Errors -- ${JSON.stringify(error)}`
          );
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
          `Unable to retrieve events --- ${JSON.stringify(
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

          if (responseFromSendEmail.success === true) {
            return {
              success: true,
              message: responseFromModifyUser.message,
              data: responseFromModifyUser.data,
            };
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
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
        throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "password must be provided when using email",
        });
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
        throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: error.message,
        });
        // return [
        //   {
        //     success: false,
        //     message: "Bad Request Error",
        //     errors: { message: error.message },
        //     status: httpStatus.BAD_REQUEST,
        //   },
        // ];
      }

      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: error.message,
        }
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
        newAnalyticsUserDetails.userName = firstName || email;
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

      throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
        message: "the request is either missing the context or tenant",
      });
    }
    return `${context}_${tenant}`;
  },
  setMobileUserCache: async ({ data, cacheID } = {}, next) => {
    try {
      logObject("cacheID supplied to setMobileUserCache", cacheID);
      const result = await ioredis.set(
        cacheID,
        JSON.stringify(data),
        "EX",
        3600
      );
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

      const cachedData = await createUserModule.getMobileUserCache(cacheID);
      logObject("cachedData", cachedData);

      if (cachedData.success === false) {
        return cachedData;
      } else {
        logObject("the cachedData", cachedData);

        if (!isEmpty(cachedData.token) && cachedData.token !== token) {
          throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Either Token or Email are Incorrect",
          });
        }

        const firebaseUser = cachedData;

        if (!firebaseUser.email && !firebaseUser.phoneNumber) {
          throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Email or phoneNumber is required.",
          });
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
            await createUserModule.deleteCachedItem(cacheID);
          logObject(
            "responseFromDeleteCachedItem after updating existing user",
            responseFromDeleteCachedItem
          );
          if (
            responseFromDeleteCachedItem.success &&
            responseFromDeleteCachedItem.success === true
          ) {
            return {
              success: true,
              message: "Successful login!",
              status: httpStatus.CREATED,
              data: userExistsLocally.toAuthJSON(),
            };
          } else {
            next(
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
            await createUserModule.deleteCachedItem(cacheID);
          logObject(
            "responseFromDeleteCachedItem after creating new user",
            responseFromDeleteCachedItem
          );
          if (
            responseFromDeleteCachedItem.success &&
            responseFromDeleteCachedItem.success === true
          ) {
            return {
              success: true,
              message: "Successful login!",
              status: httpStatus.CREATED,
              data: newUser.toAuthJSON(),
            };
          } else {
            next(
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
      next(
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

      if (responseFromSendEmail.success === true) {
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
      } else if (responseFromSendEmail.success === false) {
        logger.error(`email sending process unsuccessful`);
        const errorObject = responseFromSendEmail.errors
          ? responseFromSendEmail.errors
          : {};
        next(
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
      next(
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
        userId,
        tenant
      );

      if (responseFromCascadeDeletion.success === true) {
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
      next(
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

      if (responseFromSendEmail.success === true) {
        return {
          success: true,
          message: "email successfully sent",
          status: httpStatus.OK,
        };
      } else if (responseFromSendEmail.success === false) {
        return responseFromSendEmail;
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
  verificationReminder: async (request, next) => {
    try {
      const { tenant, email } = request;

      const user = await UserModel(tenant)
        .findOne({ email })
        .select("_id email firstName lastName verified")
        .lean();
      logObject("user", user);
      if (isEmpty(user)) {
        throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "User not provided or does not exist",
        });
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
        throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "User is already part of the AirQo platform",
        });
      }

      const newRequest = Object.assign(
        { userName: email, password, analyticsVersion: 3 },
        request
      );

      const responseFromCreateUser = await UserModel(tenant).register(
        newRequest,
        next
      );

      if (responseFromCreateUser.success === true) {
        if (responseFromCreateUser.status === httpStatus.NO_CONTENT) {
          return responseFromCreateUser;
        }

        const createdUser = await responseFromCreateUser.data;
        logObject("created user in util", createdUser._doc);
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
          logObject("responseFromSendEmail", responseFromSendEmail);
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
              status: responseFromSendEmail.status
                ? responseFromSendEmail.status
                : "",
            };
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
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
      const { query } = request;
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
      logObject(
        "responseFromGenerateResetToken",
        responseFromGenerateResetToken
      );
      logObject("filter", filter);
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
          const responseFromSendEmail = await mailer.forgot(
            {
              email: filter.email,
              token,
              tenant,
            },
            next
          );
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
        await createUserModule.isPasswordTokenValid({
          tenant,
          filter,
        });

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

        if (responseFromSendEmail.success === true) {
          return responseFromUpdateUser;
        } else if (responseFromSendEmail.success === false) {
          return responseFromSendEmail;
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
          throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "password reset link is invalid or has expired",
          });
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
      const { email, tags } = request.body;

      const subscriberHash = md5(email);
      const listId = constants.MAILCHIMP_LIST_ID;

      const responseFromMailChimp = await mailchimp.lists.setListMember(
        listId,
        subscriberHash,
        { email_address: email, status_if_new: "subscribed" }
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
};

module.exports = createUserModule;
