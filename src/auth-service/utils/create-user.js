const UserSchema = require("@models/User");
const LogSchema = require("@models/log");
const AccessTokenSchema = require("@models/AccessToken");
const ClientSchema = require("@models/Client");
const NetworkSchema = require("@models/Network");
const RoleSchema = require("@models/Role");
const { getModelByTenant } = require("@config/database");
const { logObject, logElement, logText, logError } = require("./log");
const mailer = require("./mailer");
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
const generateFilter = require("./generate-filter");
const moment = require("moment-timezone");
const admin = require("firebase-admin");
const { db } = require("@config/firebase-admin");
const redis = require("@config/redis");
const { generateDateFormatWithoutHrs } = require("@utils/date");

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-user-util`);

function generateNumericToken(length) {
  const charset = "0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    token += charset[randomIndex];
  }
  return token;
}

async function storeDataInRedis(token, data) {
  try {
    // Store the data as a JSON string with the token as the key
    await setAsync(token, JSON.stringify(data));

    // Optionally, you can set an expiration time for the data (e.g., 1 hour)
    // Here, we are setting the expiration time to 1 hour (3600 seconds)
    await redis.expire(token, 3600);

    // Return true to indicate successful storage
    return true;
  } catch (error) {
    // Handle any errors that occur during the storage process
    console.error("Error storing data in Redis:", error);
    return false;
  }
}

async function retrieveDataFromRedis(token) {
  try {
    // Retrieve the data stored in Redis using the token as the key
    const rawData = await getAsync(token);

    if (rawData) {
      // If data exists, parse the JSON string to obtain the actual data object
      const data = JSON.parse(rawData);
      return data;
    } else {
      // If data doesn't exist (token not found), return null or handle accordingly
      return null;
    }
  } catch (error) {
    // Handle any errors that occur during the retrieval process
    console.error("Error retrieving data from Redis:", error);
    return null;
  }
}

const UserModel = (tenant) => {
  try {
    let users = mongoose.model("users");
    return users;
  } catch (error) {
    let users = getModelByTenant(tenant, "user", UserSchema);
    return users;
  }
};

const LogModel = (tenant) => {
  try {
    const logs = mongoose.model("logs");
    return logs;
  } catch (error) {
    const logs = getModelByTenant(tenant, "log", LogSchema);
    return logs;
  }
};

const AccessTokenModel = (tenant) => {
  try {
    let tokens = mongoose.model("access_tokens");
    return tokens;
  } catch (error) {
    let tokens = getModelByTenant(tenant, "access_token", AccessTokenSchema);
    return tokens;
  }
};

const ClientModel = (tenant) => {
  try {
    let clients = mongoose.model("clients");
    return clients;
  } catch (error) {
    let clients = getModelByTenant(tenant, "client", ClientSchema);
    return clients;
  }
};

const NetworkModel = (tenant) => {
  try {
    const networks = mongoose.model("networks");
    return networks;
  } catch (error) {
    const networks = getModelByTenant(tenant, "network", NetworkSchema);
    return networks;
  }
};

const RoleModel = (tenant) => {
  try {
    let roles = mongoose.model("roles");
    return roles;
  } catch (error) {
    let roles = getModelByTenant(tenant, "role", RoleSchema);
    return roles;
  }
};

async function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy("__name__").limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, batchSize, resolve, reject);
  });
}

function deleteQueryBatch(db, query, batchSize, resolve, reject) {
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
        deleteQueryBatch(db, query, batchSize, resolve, reject);
      });
    })
    .catch(reject);
}

const createUserModule = {
  listLogs: async (request) => {
    try {
      const { tenant, limit = 1000, skip = 0 } = request.query;
      let filter = {};
      const responseFromFilter = generateFilter.logs(request);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      } else {
        filter = responseFromFilter;
      }
      logObject("filter", filter);
      const responseFromListLogs = await LogModel(tenant).list({
        filter,
        limit,
        skip,
      });
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
        return {
          success: false,
          message: responseFromListLogs.message,
          errors: responseFromListLogs.errors
            ? responseFromListLogs.errors
            : { message: "Internal Server Error" },
          status: responseFromListLogs.status
            ? responseFromListLogs.status
            : httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (e) {
      logElement("list users util", e.message);
      logger.error(`Internal Server Error ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      };
    }
  },
  listStatistics: async (tenant) => {
    try {
      const responseFromListStatistics = await UserModel(tenant).listStatistics(
        tenant
      );
      if (responseFromListStatistics.success === true) {
        return {
          success: true,
          message: responseFromListStatistics.message,
          data: responseFromListStatistics.data,
          status: responseFromListStatistics.status
            ? responseFromListStatistics.status
            : httpStatus.OK,
        };
      } else if (responseFromListStatistics.success === false) {
        return {
          success: false,
          message: responseFromListStatistics.message,
          errors: responseFromListStatistics.errors
            ? responseFromListStatistics.errors
            : { message: "Internal Server Error" },
          status: responseFromListStatistics.status
            ? responseFromListStatistics.status
            : httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (e) {
      logElement("list users util", e.message);
      logger.error(`Internal Server Error ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      };
    }
  },

  list: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);

      const responseFromFilter = generateFilter.users(request);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;
      const responseFromListUser = await UserModel(tenant).list({
        filter,
        limit,
        skip,
      });

      return responseFromListUser;
    } catch (e) {
      logElement("list users util", e.message);
      logger.error(`Internal Server Error ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      let filter = {};
      const { query, body } = request;
      let update = body;

      if (!isEmpty(update.password)) {
        delete update.password;
      }
      if (!isEmpty(update._id)) {
        delete update._id;
      }

      const { tenant } = query;

      const responseFromGenerateFilter = generateFilter.users(request);

      if (responseFromGenerateFilter.success === true) {
        filter = responseFromGenerateFilter.data;
      } else if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      }

      const user = await UserModel(tenant).find(filter).lean();
      logObject("the user details with lean(", user);
      if (isEmpty(user)) {
        logger.error(`the provided User does not exist in the System`);
        return {
          message: "Bad Request Error",
          success: false,
          errors: {
            message: "the provided User does not exist in the System",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromModifyUser = await UserModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyUser.success === true) {
        const { _id, ...updatedUserDetails } = responseFromModifyUser.data;
        logObject("updatedUserDetails", updatedUserDetails);
        if (process.env.NODE_ENV && process.env.NODE_ENV !== "production") {
          return {
            success: true,
            message: responseFromModifyUser.message,
            data: responseFromModifyUser.data,
          };
        } else {
          logObject("user Object", user);
          const responseFromSendEmail = await mailer.update(
            user[0].email,
            user[0].firstName,
            user[0].lastName,
            updatedUserDetails
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
    } catch (e) {
      logObject("e", e);
      logger.error(`Internal Server Error ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  lookUpFirebaseUser: async (request, callback) => {
    try {
      const { body } = request;
      const { email, phoneNumber, providerId, providerUid } = body;
      let userIndetificationArray = [];
      if (isEmpty(email) && !isEmpty(phoneNumber)) {
        userIndetificationArray.push({ phoneNumber });
      } else if (!isEmpty(email) && isEmpty(phoneNumber)) {
        userIndetificationArray.push({ email });
      } else {
        userIndetificationArray.push({ phoneNumber });
        userIndetificationArray.push({ email });
      }
      return getAuth()
        .getUsers(userIndetificationArray)
        .then(async (getUsersResult) => {
          logObject("getUsersResult", getUsersResult);
          getUsersResult.users.forEach((userRecord) => {
            callback({
              success: true,
              message: "Successfully fetched user data",
              status: httpStatus.OK,
              data: [],
              userRecord,
            });
          });

          getUsersResult.notFound.forEach((user_identifier) => {
            callback({
              success: false,
              message:
                "Unable to find users corresponding to these identifiers",
              status: httpStatus.NOT_FOUND,
              data: user_identifier,
            });
          });
        })
        .catch((error) => {
          let status = httpStatus.INTERNAL_SERVER_ERROR;

          if (error.code === "auth/invalid-email") {
            status = httpStatus.BAD_REQUEST;
          }
          callback({
            success: false,
            message: "internal server error",
            status,
            errors: {
              message: error,
            },
          });
        });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      callback({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      });
    }
  },

  createFirebaseUser: async (request, callback) => {
    try {
      const { body } = request;
      const { email, password, phoneNumber } = body;
      logText("createFirebaseUser util......");

      // Check if either email or phoneNumber is provided
      if (isEmpty(email) && isEmpty(phoneNumber)) {
        callback({
          success: false,
          message: "Please provide either email or phoneNumber",
          status: httpStatus.BAD_REQUEST,
        });
        return;
      }

      if (!isEmpty(email) && isEmpty(phoneNumber) && isEmpty(password)) {
        callback({
          success: false,
          message: "Bad Request",
          errors: { message: "password must be provided when using email" },
          status: httpStatus.BAD_REQUEST,
        });
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
      callback({
        success: true,
        message: "User created successfully",
        status: httpStatus.CREATED,
        data: { uid },
      });
    } catch (error) {
      logger.error(`Internal Server Error ${JSON.stringify(error)}`);
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },

  signUpWithFirebase: async (request, callback) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const { email, phoneNumber, firstName, lastName, userName, password } =
        body;

      // Step 1: Check if the user exists on Firebase using lookUpFirebaseUser function
      createUserModule.lookUpFirebaseUser(
        request,
        async (firebaseUserResponse) => {
          if (
            firebaseUserResponse.success &&
            firebaseUserResponse.data.length > 0
          ) {
            // Step 2: User exists on Firebase, update or create locally using UserModel
            const firebaseUser = firebaseUserResponse.data[0];

            // Check if user exists locally in your MongoDB using UserModel
            const userExistsLocally = await UserModel(tenant).findOne({
              $or: [
                { email: firebaseUser.email },
                { phoneNumber: firebaseUser.phoneNumber },
              ],
            });

            if (userExistsLocally) {
              // User exists locally, perform update operation
              const updatedUser = await UserModel(tenant).updateOne(
                { _id: userExistsLocally._id },
                {
                  firstName: firebaseUser.firstName,
                  lastName: firebaseUser.lastName,
                  userName: firebaseUser.userName,
                }
              );

              callback({
                success: true,
                message: "User updated successfully.",
                status: httpStatus.OK,
                data: updatedUser,
              });
            } else {
              // User does not exist locally, perform create operation
              // Create the user in your UserModel using mongoose create function
              const newUser = await UserModel(tenant).create({
                email: firebaseUser.email,
                phoneNumber: firebaseUser.phoneNumber,
                firstName,
                lastName,
                userName,
                password,
              });

              callback({
                success: true,
                message: "User created successfully.",
                status: httpStatus.CREATED,
                data: newUser,
              });
            }
          } else {
            // Step 3: User does not exist on Firebase, create user on Firebase first
            // Create the user on Firebase using createFirebaseUser function
            createUserModule.createFirebaseUser(
              { body: { email, phoneNumber, password } },
              async (firebaseCreateResponse) => {
                if (firebaseCreateResponse.success) {
                  // Step 4: Firebase user created successfully, proceed with local user creation
                  const newUser = await UserModel(tenant).create({
                    email,
                    phoneNumber,
                    firstName,
                    lastName,
                    userName: email, // Using email as userName in this case
                    password,
                  });

                  callback({
                    success: true,
                    message: "User created successfully.",
                    status: httpStatus.CREATED,
                    data: newUser,
                  });
                } else {
                  callback({
                    success: false,
                    message: "Error creating user on Firebase.",
                    status: httpStatus.INTERNAL_SERVER_ERROR,
                    errors: { message: "Error creating user on Firebase." },
                  });
                }
              }
            );
          }
        }
      );
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },
  setCache: (cacheID, callback) => {
    try {
      redis.set(
        cacheID,
        JSON.stringify({
          isCache: true,
          success: true,
          message: `successfully retrieved the measurements`,
          data,
        })
      );
      redis.expire(cacheID, 3600);
      callback({
        success: true,
        message: "response stored in cache",
        status: httpStatus.OK,
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },
  getCache: (request, callback) => {
    try {
      const cacheID = createUserModule.generateCacheID(request);
      redis.get(cacheID, async (err, result) => {
        const resultJSON = JSON.parse(result);
        if (result) {
          callback({
            success: true,
            message: "utilising cache...",
            data: resultJSON,
            status: httpStatus.OK,
          });
        } else if (err) {
          logger.error(`unable to get cache --- ${JSON.stringify(err)}`);
          callback({
            success: false,
            message: "Internal Server Error",
            errors: { message: err.message },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        } else {
          callback({
            success: false,
            message: "no cache present",
            errors: { message: "no cache present" },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      callback({
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },
  generateCacheID: (request) => {
    const { tenant, skip, limit } = request.query;
    const { context } = request;
    const currentTime = new Date().toISOString();
    if (isEmpty(context)) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "the request is missing the context" },
        status: httpStatus.BAD_REQUEST,
      };
    }
    const day = generateDateFormatWithoutHrs(currentTime);
    return `${context}_${tenant}_${skip ? skip : 0}_${limit ? limit : 0}_${
      day ? day : "noDay"
    }`;
  },
  loginWithFirebase: async (request, callback) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const { email, phoneNumber, password } = body;

      // Step 1: Check if the user exists on Firebase using lookUpFirebaseUser function
      createUserModule.lookUpFirebaseUser(
        request,
        async (firebaseUserResponse) => {
          logObject("firebaseUserResponse", firebaseUserResponse);
          if (
            firebaseUserResponse.success === true &&
            !isEmpty(firebaseUserResponse.userRecord)
          ) {
            // Step 2: User exists on Firebase, update or create locally using UserModel
            const firebaseUser = firebaseUserResponse.userRecord;
            logObject("firebaseUser", firebaseUser);
            logObject("firebaseUser.uid", firebaseUser.uid);
            const firebase_uid = firebaseUser.uid;

            // Generate the custom token
            const token = generateNumericToken(5);
            /*.
            We are now going to save this new token in our Redis DB
            After successful storage of this token, then we can be able to 
            **/
            let generateCacheRequest = Object.assign({}, request);
            generateCacheRequest.context = firebase_uid;
            const cacheID =
              createUserModule.generateCacheID(generateCacheRequest);
            if (cacheID.success && cacheID.success === false) {
              callback(cacheID);
            }
            return createUserModule.setCache(cacheID, async (result) => {
              if (result.success === true) {
                logObject("token", token);

                const responseFromSendEmail = await mailer.verifyMobileEmail({
                  token,
                  email,
                  firebase_uid,
                });

                logObject("responseFromSendEmail", responseFromSendEmail);
                if (responseFromSendEmail.success === true) {
                  callback({
                    success: true,
                    message: "An Email sent to your account, please verify",
                    data: firebaseUser,
                    status: responseFromSendEmail.status
                      ? responseFromSendEmail.status
                      : "",
                  });
                } else if (responseFromSendEmail.success === false) {
                  callback(responseFromSendEmail);
                }
              } else if (result.success === false) {
                callback(result);
              }
            });
          } else {
            callback({
              success: false,
              message: "Unable to Login using Firebase, crosscheck details.",
              status: httpStatus.BAD_REQUEST,
              errors: { message: "User does not exist on Firebase" },
            });
          }
        }
      );
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },
  verifyFirebaseCustomToken: async (request, callback) => {
    try {
      const { tenant } = request.query;
      const { token } = request.params;
      const decodedToken = await getAuth().verifyIdToken(token);
      logObject("decodedToken", decodedToken);

      if (!isEmpty(decodedToken.uid)) {
        const firebaseUser = decodedToken;

        if (!firebaseUser.email && !firebaseUser.phoneNumber) {
          return callback({
            success: false,
            message: "Invalid request.",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "Email or phoneNumber is required." },
          });
        }
        let filter = {};
        if (email) {
          filter.email = email;
        }
        if (phoneNumber) {
          filter.phoneNumber = phoneNumber;
        }
        // Check if user exists locally
        const userExistsLocally = await UserModel(tenant)
          .findOne(filter)
          .exec();
        logObject("userExistsLocally", userExistsLocally);
        if (userExistsLocally) {
          // User exists locally, perform update operation
          const updatedFields = {};
          if (firebaseUser.firstName !== null) {
            updatedFields.firstName = firebaseUser.firstName;
          }
          if (firebaseUser.lastName !== null) {
            updatedFields.lastName = firebaseUser.lastName;
          }
          if (firebaseUser.userName !== null) {
            updatedFields.userName = firebaseUser.userName;
          }

          const updatedUser = await UserModel(tenant).updateOne(
            { _id: userExistsLocally._id },
            {
              $set: updatedFields,
            }
          );

          logObject("updatedUser", updatedUser);
          /**
          I am considering doing some 2FA at this point and perhaps creating separate
          logic for verifying the user's received token for me to verify and then
          I send them the following response from that separate logic
          */
          callback({
            success: true,
            message: "Successful login!",
            status: httpStatus.OK,
            data: userExistsLocally.toAuthJSON(),
          });
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
          /**
          I am considering doing some 2FA at this point and perhaps creating separate
          logic for verifying the user's received token for me to verify and then
          I send them the following response from that separate logic
          */

          callback({
            success: true,
            message: "Successful login!",
            status: httpStatus.CREATED,
            data: newUser.toAuthJSON(),
          });
        }
      } else {
        logger.error(`Invalid Custom Token Provided`);
        callback({
          success: false,
          message: "Bad Request Error",
          errors: { message: "Invalid Token Provided" },
          status: httpStatus.BAD_REQUEST,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  generateSignInWithEmailLink: async (request, callback) => {
    try {
      const { body, query } = request;
      const { email } = body;
      const { purpose } = query;

      return getAuth()
        .generateSignInWithEmailLink(email, constants.ACTION_CODE_SETTINGS)
        .then(async (link) => {
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
              email,
              token
            );
          }
          if (purpose === "auth") {
            responseFromSendEmail = await mailer.authenticateEmail(
              email,
              token
            );
          }
          if (purpose === "login") {
            responseFromSendEmail = await mailer.signInWithEmailLink(
              email,
              token
            );
          }

          if (responseFromSendEmail.success === true) {
            callback({
              success: true,
              message: "process successful, check your email for token",
              status: httpStatus.OK,
              data: {
                link,
                token,
                email,
                emailLinkCode,
              },
            });
          } else if (responseFromSendEmail.success === false) {
            logger.error(`email sending process unsuccessful`);
            callback({
              success: false,
              message: "email sending process unsuccessful",
              errors: responseFromSendEmail.errors,
              status: httpStatus.INTERNAL_SERVER_ERROR,
            });
          }
        })
        .catch((error) => {
          logObject("the error", error);
          let status = httpStatus.INTERNAL_SERVER_ERROR;

          if (error.code === "auth/invalid-email") {
            status = httpStatus.BAD_REQUEST;
          }
          logger.error(`unable to sign in using email link`);
          callback({
            success: false,
            message: "unable to sign in using email link",
            status,
            errors: {
              message: error,
            },
          });
        });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      callback({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      });
    }
  },
  delete: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const responseFromFilter = generateFilter.users(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;

      const updatedRole = await RoleModel(tenant).updateMany(
        { role_users: filter._id },
        { $pull: { role_users: filter._id } }
      );

      if (!isEmpty(updatedRole.err)) {
        logger.error(
          `error while attempting to delete User from the corresponding Role ${JSON.stringify(
            updatedRole.err
          )}`
        );
      }

      const updatedNetwork = await NetworkModel(tenant).updateMany(
        { net_users: filter._id },
        {
          $pull: { net_users: filter._id },
          $cond: {
            if: { $eq: ["$net_manager", filter._id] },
            then: { $set: { net_manager: null } },
            else: {},
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

      const responseFromRemoveUser = await UserModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });

      return responseFromRemoveUser;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  sendFeedback: async (request) => {
    try {
      const { body } = request;
      const { email, message, subject } = body;
      const responseFromSendEmail = await mailer.feedback({
        email,
        message,
        subject,
      });

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
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  create: async (request) => {
    try {
      const { tenant, firstName, email, network_id } = request;
      let { password } = request;

      const user = await UserModel(tenant).findOne({ email });
      if (!isEmpty(user)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "User is already part of the AirQo platform" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      password = password
        ? password
        : accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(10)
          );

      const newRequest = Object.assign({ userName: email, password }, request);

      const responseFromCreateUser = await UserModel(tenant).register(
        newRequest
      );
      if (responseFromCreateUser.success === true) {
        if (responseFromCreateUser.status === httpStatus.NO_CONTENT) {
          return responseFromCreateUser;
        }
        const token = accessCodeGenerator
          .generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
          )
          .toUpperCase();

        const client_id = accessCodeGenerator
          .generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_ID_LENGTH)
          )
          .toUpperCase();

        const client_secret = accessCodeGenerator.generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(31)
        );

        const responseFromSaveClient = await ClientModel(tenant).register({
          client_id,
          client_secret,
          name: responseFromCreateUser.data.email,
        });
        if (
          responseFromSaveClient.success === false ||
          responseFromSaveClient.status === httpStatus.ACCEPTED
        ) {
          return responseFromSaveClient;
        }

        const toMilliseconds = (hrs, min, sec) =>
          (hrs * 60 * 60 + min * 60 + sec) * 1000;

        const hrs = constants.EMAIL_VERIFICATION_HOURS;
        const min = constants.EMAIL_VERIFICATION_MIN;
        const sec = constants.EMAIL_VERIFICATION_SEC;

        const responseFromSaveToken = await AccessTokenModel(tenant).register({
          token,
          network_id,
          client_id: responseFromSaveClient.data._id,
          user_id: responseFromCreateUser.data._id,
          expires: Date.now() + toMilliseconds(hrs, min, sec),
        });

        if (responseFromSaveToken.success === true) {
          let createdUser = await responseFromCreateUser.data;
          logObject("created user in util", createdUser._doc);
          const user_id = createdUser._doc._id;

          const responseFromSendEmail = await mailer.verifyEmail({
            user_id,
            token,
            email,
            firstName,
          });

          logObject("responseFromSendEmail", responseFromSendEmail);
          if (responseFromSendEmail.success === true) {
            return {
              success: true,
              message: "An Email sent to your account please verify",
              data: createdUser._doc,
              status: responseFromSendEmail.status
                ? responseFromSendEmail.status
                : "",
            };
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else if (responseFromSaveToken.success === false) {
          return responseFromSaveToken;
        }
      } else if (responseFromCreateUser.success === false) {
        return responseFromCreateUser;
      }
    } catch (e) {
      logObject("e", e);
      logger.error(`Internal Server Error ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  register: async (request) => {
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
        requestBody
      );

      if (responseFromCreateUser.success === true) {
        const createdUser = await responseFromCreateUser.data;
        logObject("created user in util", createdUser._doc);
        const responseFromSendEmail = await mailer.user(
          firstName,
          lastName,
          email,
          password,
          tenant,
          "user"
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  forgotPassword: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const responseFromFilter = generateFilter.users(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;

      const userExists = await UserModel(tenant).exists(filter);

      if (!userExists) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message:
              "Sorry, the provided email or username does not belong to a registered user. Please make sure you have entered the correct information or sign up for a new account.",
          },
          status: httpStatus.BAD_REQUEST,
        };
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
        ).modify({
          filter,
          update,
        });
        if (responseFromModifyUser.success === true) {
          const responseFromSendEmail = await mailer.forgot(
            filter.email,
            token,
            tenant
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
    } catch (e) {
      logElement("forgot password util", e.message);
      logger.error(`Internal Server Error ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateForgottenPassword: async (request) => {
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
        const responseFromModifyUser = await UserModel(tenant).modify({
          filter,
          update,
        });

        if (responseFromModifyUser.success === true) {
          const { email, firstName, lastName } = userDetails;
          const responseFromSendEmail = await mailer.updateForgottenPassword(
            email,
            firstName,
            lastName
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
      logObject("error updateForgottenPassword UTIL", error);
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "util server error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateKnownPassword: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { password, old_password } = body;

      const responseFromFilter = generateFilter.users(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;

      logObject("the found filter", filter);

      const user = await UserModel(tenant).find(filter).lean();

      logObject("the user details with lean(", user);

      if (isEmpty(user)) {
        logger.error(
          ` ${user[0].email} --- either your old password is incorrect or the provided user does not exist`
        );
        return {
          message: "Bad Request Error",
          success: false,
          errors: {
            message:
              "either your old password is incorrect or the provided user does not exist",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (isEmpty(user[0].password)) {
        logger.error(` ${user[0].email} --- unable to do password lookup`);
        return {
          success: false,
          errors: { message: "unable to do password lookup" },
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      const responseFromBcrypt = await bcrypt.compare(
        old_password,
        user[0].password
      );

      if (responseFromBcrypt === false) {
        logger.error(
          ` ${user[0].email} --- either your old password is incorrect or the provided user does not exist`
        );
        return {
          message: "Bad Request Error",
          success: false,
          errors: {
            message:
              "either your old password is incorrect or the provided user does not exist",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const update = {
        password: password,
      };
      const responseFromUpdateUser = await UserModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });

      if (responseFromUpdateUser.success === true) {
        const { email, firstName, lastName } = user[0];
        const responseFromSendEmail = await mailer.updateKnownPassword(
          email,
          firstName,
          lastName
        );

        if (responseFromSendEmail.success === true) {
          return responseFromUpdateUser;
        } else if (responseFromSendEmail.success === false) {
          return responseFromSendEmail;
        }
      } else if (responseFromUpdateUser.success === false) {
        return responseFromUpdateUser;
      }
    } catch (e) {
      logObject("the error when updating known password", e);
      logger.error(`Internal Server Error ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
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
      logElement("generate reset token util", error.message);
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "util server error",
        error: error.message,
      };
    }
  },

  isPasswordTokenValid: async ({ tenant = "airqo", filter = {} } = {}) => {
    try {
      const responseFromListUser = await UserModel(tenant.toLowerCase()).list({
        filter,
      });
      logObject("responseFromListUser", responseFromListUser);
      if (responseFromListUser.success === true) {
        if (
          isEmpty(responseFromListUser.data) ||
          responseFromListUser.data.length > 1
        ) {
          return {
            status: httpStatus.BAD_REQUEST,
            success: false,
            message: "password reset link is invalid or has expired",
            errors: {
              message: "password reset link is invalid or has expired",
            },
          };
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
      logger.error(`Internal Server Error ${error.message}`);
      return {
        status: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },

  subscribeToNewsLetter: async (request) => {
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
        return {
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "unable to subscribe user to the AirQo newsletter",
          errors: {
            message:
              "unable to Update Subsriber Tags for the newsletter subscription",
          },
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      const errorResponse = error.response ? error.response : {};
      const text = errorResponse ? errorResponse.text : "";
      const status = errorResponse
        ? errorResponse.status
        : httpStatus.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message, more: text },
        status,
      };
    }
  },

  deleteMobileUserData: async (request) => {
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
        return {
          success: false,
          message: "Invalid token",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Invalid token" },
        };
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
            logError("Error deleting document:", error);
            logger.error(`Internal Server Error -- ${error.message}`);
            return {
              success: false,
              message: "Error deleting Firestore documents",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: { message: error.message },
            };
          });

        return {
          success: true,
          message: "User account has been deleted.",
          status: httpStatus.OK,
        };
      } catch (error) {
        logError("Error deleting user:", error);
        logger.error(`Internal Server Error -- ${error.message}`);
        return {
          success: false,
          message: "Error deleting user",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: error.message },
        };
      }
    } catch (error) {
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
};

module.exports = createUserModule;
