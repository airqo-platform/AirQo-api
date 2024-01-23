const PermissionModel = require("@models/Permission");
const ScopeModel = require("@models/Scope");
const BlacklistedIPModel = require("@models/BlacklistedIP");
const UnknownIPModel = require("@models/UnknownIP");
const WhitelistedIPModel = require("@models/WhitelistedIP");
const BlacklistedIPRangeModel = require("@models/BlacklistedIPRange");
const ClientModel = require("@models/Client");
const AccessTokenModel = require("@models/AccessToken");
const VerifyTokenModel = require("@models/VerifyToken");
const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const DepartmentModel = require("@models/Department");
const NetworkModel = require("@models/Network");
const GroupModel = require("@models/Group");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const accessCodeGenerator = require("generate-password");
const winstonLogger = require("@utils/log-winston");
const { logObject, logElement, logText } = require("@utils/log");
const mailer = require("@utils/mailer");
const generateFilter = require("@utils/generate-filter");
const isEmpty = require("is-empty");
const stringify = require("@utils/stringify");
const constants = require("@config/constants");
const moment = require("moment-timezone");
const rangeCheck = require("ip-range-check");
const ObjectId = mongoose.Types.ObjectId;
const crypto = require("crypto");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- control-access-util`
);
const { HttpError } = require("@utils/errors");
const async = require("async");
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const getDay = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const convertToUpperCaseWithUnderscore = (inputString, next) => {
  try {
    const uppercaseString = inputString.toUpperCase();
    const transformedString = uppercaseString.replace(/ /g, "_");
    return transformedString;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
const isGroupRoleOrNetworkRole = (role) => {
  logObject("role", role);
  if (role && (role.group_id || role.network_id)) {
    if (role.group_id && !role.network_id) {
      return "group";
    } else if (!role.group_id && role.network_id) {
      return "network";
    } else {
      return "none";
    }
  }
  return "none";
};
const findAssociatedIdForRole = async ({
  role_id,
  tenant = "airqo",
  roles,
} = {}) => {
  for (const role of roles) {
    const RoleDetails = await RoleModel(tenant).findById(role_id).lean();
    logObject("RoleDetails", RoleDetails);
    if (
      role.network &&
      role.network.toString() === RoleDetails.network_id.toString()
    ) {
      return role.network;
    } else if (
      role.group &&
      role.group.toString() === RoleDetails.group_id.toString()
    ) {
      return role.group;
    }
  }
  return null;
};
const isNetwork = (net_id, grp_id) => {
  return !isEmpty(net_id) && isEmpty(grp_id);
};
const isAssignedUserSuperAdmin = async ({
  associatedId,
  roles = [],
  tenant = "airqo",
}) => {
  for (const role of roles) {
    if (
      (role.network && role.network.toString() === associatedId.toString()) ||
      (role.group && role.group.toString() === associatedId.toString())
    ) {
      const RoleDetails = await RoleModel(tenant)
        .findById(ObjectId(role.role))
        .lean();
      if (
        RoleDetails &&
        RoleDetails.role_name &&
        RoleDetails.role_name.endsWith("SUPER_ADMIN")
      ) {
        return true;
      }
    }
  }

  return false;
};
const isRoleAlreadyAssigned = (roles, role_id) => {
  if (isEmpty(roles) || !Array.isArray(roles)) {
    return false;
  } else {
    return roles.some((role) => {
      if (isEmpty(role.role)) {
        return false;
      }
      logObject("role.role.toString()", role.role.toString());
      logObject("role_id.toString()", role_id.toString());
      return role.role.toString() === role_id.toString();
    });
  }
};
const generateClientSecret = (length) => {
  if (length % 2 !== 0) {
    throw new Error("Length must be an even number");
  }
  const numBytes = length / 2;
  const clientSecret = crypto.randomBytes(numBytes).toString("hex");
  return clientSecret;
};

const createUnauthorizedResponse = () => {
  return {
    success: false,
    message: "Unauthorized",
    status: httpStatus.UNAUTHORIZED,
    errors: { message: "Unauthorized" },
  };
};
const createValidTokenResponse = () => {
  return {
    success: true,
    message: "The token is valid",
    status: httpStatus.OK,
  };
};

const trampoline = (fn) => {
  while (typeof fn === "function") {
    fn = fn();
  }
  return fn;
};

let blacklistQueue = async.queue(async (task, callback) => {
  let { ip } = task;
  logText("we are in the IP range checker.....");
  // If the IP falls within the range, publish it to the "ip-address" topic
  try {
    const kafkaProducer = kafka.producer({
      groupId: constants.UNIQUE_PRODUCER_GROUP,
    });
    await kafkaProducer.connect();
    await kafkaProducer
      .send({
        topic: "ip-address",
        messages: [{ value: stringify({ ip }) }],
      })
      .then(() => {
        logObject(`🤩🤩 Published IP ${ip} to the "ip-address" topic.`);
        // logger.info(`🤩🤩 Published IP ${ip} to the "ip-address" topic.`);
        callback();
      });
    await kafkaProducer.disconnect();
  } catch (error) {
    logObject("error", error);
    // logger.error(
    //   `🐛🐛 KAFKA Producer Internal Server Error --- IP_ADDRESS: ${ip} --- ${error.message}`
    // );
  }
}, 1); // Limit the number of concurrent tasks to 1

let unknownIPQueue = async.queue(async (task, callback) => {
  let { ip, token, name, client_id, endpoint, day } = task;
  await UnknownIPModel("airqo")
    .findOne({
      ip,
      "ipCounts.day": day,
    })
    .then(async (checkDoc) => {
      if (checkDoc) {
        const update = {
          $addToSet: {
            client_ids: client_id,
            tokens: token,
            token_names: name,
            endpoints: endpoint,
          },
          $inc: {
            "ipCounts.$[elem].count": 1,
          },
        };
        const options = {
          arrayFilters: [{ "elem.day": day }],
          upsert: true,
          new: true,
          runValidators: true,
        };

        await UnknownIPModel("airqo")
          .findOneAndUpdate({ ip }, update, options)
          .then(() => {
            logText(`stored the unknown IP ${ip} which had a day field`);
            callback();
          });
      } else {
        await UnknownIPModel("airqo")
          .create({
            ip,
            tokens: [token],
            token_names: [name],
            endpoints: [endpoint],
            client_ids: [client_id],
            ipCounts: [{ day, count: 1 }],
          })
          .then(() => {
            logText(`stored the unknown IP ${ip} which had NO day field`);
            callback();
          });
      }
    });
}, 1); // Limit the number of concurrent tasks to 1

const postProcessing = async ({
  ip,
  token,
  name,
  client_id,
  endpoint = "unknown",
  day,
}) => {
  logText("we are now postProcessing()....");
  blacklistQueue.push({ ip });
  unknownIPQueue.push({
    ip,
    token,
    name,
    client_id,
    endpoint,
    day,
  });
};

const isIPBlacklistedHelper = async (
  { request, next } = {},
  retries = 1,
  delay = 1000
) => {
  try {
    const day = getDay();
    const ip =
      request.headers["x-client-ip"] || request.headers["x-client-original-ip"];
    const endpoint = request.headers["x-original-uri"];
    let acessTokenFilter = generateFilter.tokens(request, next);
    const timeZone = moment.tz.guess();
    acessTokenFilter.expires = {
      $gt: moment().tz(timeZone).toDate(),
    };

    const [blacklistedIP, whitelistedIP, accessToken] = await Promise.all([
      BlacklistedIPModel("airqo").findOne({ ip }),
      WhitelistedIPModel("airqo").findOne({ ip }),
      AccessTokenModel("airqo")
        .findOne(acessTokenFilter)
        .select("name token client_id"),
    ]);

    const {
      token = "",
      name = "",
      client_id = "",
    } = (accessToken && accessToken._doc) || {};

    const BLOCKED_IP_PREFIXES = "65,66,52,3,43,54,18,57,23,40,13";
    const blockedIpPrefixes = BLOCKED_IP_PREFIXES.split(",");

    if (blockedIpPrefixes.some((prefix) => ip.startsWith(prefix))) {
      return true;
    } else if (!accessToken) {
      return true;
    } else if (whitelistedIP) {
      return false;
    } else if (blacklistedIP) {
      logger.info(
        `🚨🚨 An AirQo Analytics Access Token is compromised -- TOKEN: ${token} -- TOKEN_DESCRIPTION: ${name} -- CLIENT_IP: ${ip} `
      );
      try {
        const filter = { token };
        const listTokenReponse = await AccessTokenModel("airqo").list(
          { filter },
          next
        );

        if (listTokenReponse.success === false) {
          logger.error(
            `🐛🐛 Internal Server Error -- unable to find the compromised token's user details -- TOKEN: ${token} -- TOKEN_DESCRIPTION: ${name} -- CLIENT_IP: ${ip}`
          );
        } else {
          const tokenDetails = listTokenReponse.data[0];
          const tokenResponseLength = listTokenReponse.data.length;
          if (isEmpty(tokenDetails) || tokenResponseLength > 1) {
            logger.error(
              `🐛🐛 Internal Server Error -- unable to find the compromised token's user details -- TOKEN: ${token} -- TOKEN_DESCRIPTION: ${name} -- CLIENT_IP: ${ip}`
            );
          } else {
            const {
              user: { email, firstName, lastName },
            } = tokenDetails;

            const emailResponse = await mailer.compromisedToken(
              {
                email,
                firstName,
                lastName,
                ip,
              },
              next
            );

            if (emailResponse && emailResponse.success === false) {
              logger.error(
                `🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`
              );
            }
          }
        }
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      }

      return true;
    } else {
      Promise.resolve().then(() =>
        postProcessing({ ip, token, name, client_id, endpoint, day })
      );
      logText("I am now exiting the isIPBlacklistedHelper() function");
      return false;
    }
  } catch (error) {
    logObject("the error", error);
    if (
      retries > 0 &&
      [
        "NetworkError",
        "TimeoutError",
        "MongooseServerSelectionError",
        "MongoTimeoutError",
        "serverSelectionTimeoutMS",
        "SocketTimeoutError",
      ].includes(error.name)
    ) {
      logger.error(
        `🐛🐛 Transient errors or network issues when handling the DB operations during verification of this IP address: ${ip}.`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return isIPBlacklisted({ request, next }, retries - 1, delay);
    } else if (error.name === "MongoError") {
      const jsonErrorString = stringify(error);
      switch (error.code) {
        case 11000:
          logger.error(
            `🐛🐛 Duplicate key error: IP address ${ip} already exists in the database.`
          );
          break;
        default:
          logger.error(`🐛🐛 Unknown MongoDB error: ${jsonErrorString}`);
      }
    } else {
      const jsonErrorString = stringify(error);
      logger.error(`🐛🐛 Internal Server Error --- ${jsonErrorString}`);
      return true;
    }
  }
};

const isIPBlacklisted = (...args) =>
  trampoline(() => isIPBlacklistedHelper(...args));

const controlAccess = {
  sample: async (request, next) => {
    try {
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
  /******* hashing ******************************************/
  hash: (string, next) => {
    try {
      crypto.createHash("sha256").update(string).digest("base64");
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
  hash_compare: ({ first_item, second_item } = {}, next) => {
    try {
      Object.is(first_item, second_item);
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
  /******** access tokens ******************************************/
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
  updateAccessToken: async (request, next) => {
    try {
      const { query, body, params } = request;
      const { tenant, token } = { ...query, ...params };
      const tokenDetails = await AccessTokenModel(tenant)
        .find({ token })
        .lean();

      if (isEmpty(tokenDetails)) {
        next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: `Bad request -- Token ${token} does not exist`,
          })
        );
      } else {
        const tokenId = tokenDetails[0]._id;
        let update = Object.assign({}, body);
        if (update.token) {
          delete update.token;
        }
        if (update.expires) {
          delete update.expires;
        }
        if (update._id) {
          delete update._id;
        }
        const updatedToken = await AccessTokenModel(tenant)
          .findByIdAndUpdate(tokenId, update, { new: true })
          .lean();

        if (!isEmpty(updatedToken)) {
          return {
            success: true,
            message: "Successfully updated the token's metadata",
            data: updatedToken,
            status: httpStatus.OK,
          };
        } else {
          next(
            new HttpError("Internal Server Error", httpStatus.CONFLICT, {
              message: "Unable to update the token's metadata",
            })
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
  regenerateAccessToken: async (request, next) => {
    try {
      return {
        success: false,
        message: "Service temporarily unavailable",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: {
          message: "Service temporarily unavailable",
        },
      };
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.tokens(request, next);
      const token = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
        )
        .toUpperCase();

      let update = Object.assign({}, body);
      update.token = token;

      const responseFromUpdateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdateToken;
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
  deleteAccessToken: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.tokens(request, next);
      const responseFromDeleteToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      logObject("responseFromDeleteToken", responseFromDeleteToken);
      return responseFromDeleteToken;
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
      return;
    }
  },
  verifyToken: async (request, next) => {
    try {
      logText("I have just entered the verifyToken() function");
      const ip =
        request.headers["x-client-ip"] ||
        request.headers["x-client-original-ip"];
      const endpoint = request.headers["x-original-uri"];
      const { token } = {
        ...request.params,
      };

      if (isEmpty(ip)) {
        logText(`🚨🚨 Token is being accessed without an IP address`);
        logger.error(`🚨🚨 Token is being accessed without an IP address`);
        return createUnauthorizedResponse();
      }

      const isBlacklisted = await isIPBlacklisted({
        request,
        next,
      });
      logText("I have now returned back to the verifyToken() function");
      if (isBlacklisted) {
        return createUnauthorizedResponse();
      } else {
        winstonLogger.info("verify token", {
          token: token,
          service: "verify-token",
          clientIp: ip,
          clientOriginalIp: ip,
          endpoint: endpoint ? endpoint : "unknown",
        });
        return createValidTokenResponse();
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
  listAccessToken: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip, token } = { ...query, ...params };

      const filter = generateFilter.tokens(request, next);

      if (isEmpty(token)) {
        next(
          new HttpError(
            "service is temporarily disabled",
            httpStatus.NOT_IMPLEMENTED,
            { message: "service is temporarily disabled" }
          )
        );
      }

      const responseFromListToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).list({ skip, limit, filter }, next);
      return responseFromListToken;
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
  createAccessToken: async (request, next) => {
    try {
      // return {
      //   success: false,
      //   message: "Service Temporarily Disabled",
      //   errors: {
      //     message: "Service Temporarily Disabled",
      //   },
      //   status: httpStatus.SERVICE_UNAVAILABLE,
      // };
      const { tenant, client_id } = { ...request.body, ...request.query };

      const client = await ClientModel(tenant).findById(ObjectId(client_id));

      if (!client) {
        next(
          new HttpError("Client not found", httpStatus.BAD_REQUEST, {
            message: `Invalid request, Client ${client_id} not found`,
          })
        );
      }

      const token = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
        )
        .toUpperCase();

      let tokenCreationBody = Object.assign(
        { token, client_id: ObjectId(client_id) },
        request.body
      );
      tokenCreationBody.category = "api";
      const responseFromCreateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).register(tokenCreationBody, next);

      return responseFromCreateToken;
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
  generateVerificationToken: async (request, next) => {
    try {
      return {
        success: false,
        message: "Service Temporarily Disabled",
        errors: {
          message: "Service Temporarily Disabled",
        },
        status: httpStatus.SERVICE_UNAVAILABLE,
      };
      const { query, body } = request;
      const { email } = body;
      const { tenant } = query;

      const password = password
        ? password
        : accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(10)
          );

      const newRequest = Object.assign({ userName: email, password }, request);

      const responseFromCreateUser = await UserModel(tenant).register(
        newRequest,
        next
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

        const toMilliseconds = (hrs, min, sec) =>
          (hrs * 60 * 60 + min * 60 + sec) * 1000;

        const emailVerificationHours = parseInt(
          constants.EMAIL_VERIFICATION_HOURS
        );
        const emailVerificationMins = parseInt(
          constants.EMAIL_VERIFICATION_MIN
        );
        const emailVerificationSeconds = parseInt(
          constants.EMAIL_VERIFICATION_SEC
        );

        /***
         * We need to find a client ID associated with this user?
         */

        const responseFromSaveToken = await AccessTokenModel(tenant).register(
          {
            token,
            client: {},
            user_id: responseFromCreateUser.data._id,
            expires:
              Date.now() +
              toMilliseconds(
                emailVerificationHours,
                emailVerificationMins,
                emailVerificationSeconds
              ),
          },
          next
        );

        if (responseFromSaveToken.success === true) {
          let createdUser = await responseFromCreateUser.data;
          logObject("created user in util", createdUser._doc);
          const user_id = createdUser._doc._id;

          const responseFromSendEmail = await mailer.verifyEmail(
            {
              user_id,
              token,
              email,
              firstName,
            },
            next
          );

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
  verifyVerificationToken: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip, user_id, token } = { ...query, ...params };
      const timeZone = moment.tz.guess();

      let filter = {
        token,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const responseFromListAccessToken = await AccessTokenModel(tenant).list(
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
          const password = accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(10)
          );
          let update = {
            verified: true,
            password,
            $pull: { tokens: { $in: [token] } },
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
            if (responseFromUpdateUser.status === httpStatus.BAD_REQUEST) {
              return responseFromUpdateUser;
            }
            let user = responseFromUpdateUser.data;
            filter = { token };
            logObject("the deletion of the token filter", filter);
            const responseFromDeleteToken = await AccessTokenModel(
              tenant
            ).remove({ filter }, next);

            if (responseFromDeleteToken.success === true) {
              const responseFromSendEmail = await mailer.afterEmailVerification(
                {
                  firstName: user.firstName,
                  username: user.userName,
                  password,
                  email: user.email,
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

  /******** create clients ******************************************/
  updateClient: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.clients(request, next);
      let update = Object.assign({}, body);
      if (update.client_secret) {
        delete update.client_secret;
      }
      const responseFromUpdateClient = await ClientModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdateClient;
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
  deleteClient: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.clients(request, next);
      const responseFromDeleteClient = await ClientModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      return responseFromDeleteClient;
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
  listClient: async (request, next) => {
    try {
      const { tenant, limit, skip } = { ...request.query };
      const filter = generateFilter.clients(request, next);
      const responseFromListClient = await ClientModel(
        tenant.toLowerCase()
      ).list({ skip, limit, filter }, next);
      return responseFromListClient;
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
  createClient: async (request, next) => {
    try {
      // next(
      //   new HttpError(
      //     "Service Temporarily Disabled",
      //     httpStatus.SERVICE_UNAVAILABLE,
      //     {
      //       message: "Service Temporarily Disabled",
      //     }
      //   )
      // );
      const { body, query } = request;
      const { tenant, user_id } = { ...body, ...query };
      const client_secret = generateClientSecret(100);
      const userExists = await UserModel(tenant).exists({ _id: user_id });

      if (!userExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} does not exist`,
          })
        );
      }
      let modifiedBody = Object.assign({}, body);
      modifiedBody.client_secret = client_secret;

      const responseFromCreateClient = await ClientModel(
        tenant.toLowerCase()
      ).register(modifiedBody, next);

      if (responseFromCreateClient.success === true) {
        const ip = modifiedBody.ip_address || "";
        if (!isEmpty(ip)) {
          const newWhitelistResponse = await WhitelistedIPModel(
            tenant
          ).register({ ip }, next);
          if (newWhitelistResponse.success === false) {
            return newWhitelistResponse;
          } else {
            return responseFromCreateClient;
          }
        } else {
          return responseFromCreateClient;
        }
      } else if (responseFromCreateClient.success === false) {
        return responseFromCreateClient;
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
  updateClientSecret: async (request, next) => {
    try {
      const { tenant, client_id } = { ...request.query, ...request.params };
      const clientExists = await ClientModel(tenant).exists({ _id: client_id });
      if (!clientExists) {
        logger.error(`Client with ID ${client_id} not found`);
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Client with ID ${client_id} not found`,
          })
        );
      }

      const client_secret = generateClientSecret(100);
      const updatedClient = await ClientModel(tenant)
        .findByIdAndUpdate(client_id, { client_secret }, { new: true })
        .exec();

      if (isEmpty(updatedClient)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "unable to complete operation" }
          )
        );
      } else {
        return {
          success: true,
          message: "Successful Operation",
          status: httpStatus.OK,
          data: updatedClient.client_secret,
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
    }
  },

  /******** create scopes ******************************************/
  updateScope: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.scopes(request, next);
      const update = Object.assign({}, body);
      const responseFromUpdateToken = await ScopeModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdateToken;
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
  deleteScope: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.scopes(request, next);
      const responseFromDeleteToken = await ScopeModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      return responseFromDeleteToken;
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
  listScope: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.scopes(request, next);
      const responseFromListToken = await ScopeModel(tenant.toLowerCase()).list(
        { skip, limit, filter },
        next
      );
      return responseFromListToken;
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
  createScope: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const responseFromCreateToken = await ScopeModel(
        tenant.toLowerCase()
      ).register(body, next);
      return responseFromCreateToken;
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

  /******* roles *******************************************/
  listRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request, next);
      const responseFromListRole = await RoleModel(tenant.toLowerCase()).list(
        {
          filter,
        },
        next
      );
      return responseFromListRole;
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
  listRolesForNetwork: async (request, next) => {
    try {
      const { query, params } = request;
      const { net_id, tenant } = { ...query, ...params };

      const network = await NetworkModel(tenant).findById(net_id);
      if (!network) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Network ${net_id.toString()} Not Found`,
          })
        );
      }

      const roleResponse = await RoleModel(tenant).aggregate([
        {
          $match: {
            network_id: ObjectId(net_id),
          },
        },
        {
          $lookup: {
            from: "permissions",
            localField: "role_permissions",
            foreignField: "_id",
            as: "role_permissions",
          },
        },
        {
          $project: {
            _id: 1,
            role_name: 1,
            role_permissions: {
              $map: {
                input: "$role_permissions",
                as: "role_permission",
                in: {
                  _id: "$$role_permission._id",
                  permission: "$$role_permission.permission",
                },
              },
            },
          },
        },
      ]);

      if (!isEmpty(roleResponse)) {
        return {
          success: true,
          message: "Successful Operation",
          status: httpStatus.OK,
          data: roleResponse,
        };
      } else if (isEmpty(roleResponse)) {
        return {
          success: true,
          message: "No roles for this Network",
          status: httpStatus.OK,
          data: [],
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
    }
  },
  listRolesForGroup: async (request, next) => {
    try {
      const { query, params } = request;
      const { grp_id, tenant } = { ...query, ...params };

      const group = await GroupModel(tenant).findById(grp_id);
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id.toString()} Not Found`,
          })
        );
      }

      const roleResponse = await RoleModel(tenant).aggregate([
        {
          $match: {
            group_id: ObjectId(grp_id),
          },
        },
        {
          $lookup: {
            from: "permissions",
            localField: "role_permissions",
            foreignField: "_id",
            as: "role_permissions",
          },
        },
        {
          $project: {
            _id: 1,
            role_name: 1,
            role_permissions: {
              $map: {
                input: "$role_permissions",
                as: "role_permission",
                in: {
                  _id: "$$role_permission._id",
                  permission: "$$role_permission.permission",
                },
              },
            },
          },
        },
      ]);

      if (!isEmpty(roleResponse)) {
        return {
          success: true,
          message: "Successful Operation",
          status: httpStatus.OK,
          data: roleResponse,
        };
      } else if (isEmpty(roleResponse)) {
        return {
          success: true,
          message: "No roles for this Group",
          status: httpStatus.OK,
          data: [],
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
    }
  },
  deleteRole: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request, next);

      if (isEmpty(filter._id)) {
        next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message:
              "the role ID is missing -- required when updating corresponding users",
          })
        );
      }

      const result = await UserModel(tenant).updateMany(
        {
          $or: [
            { "network_roles.role": filter._id },
            { "group_roles.role": filter._id },
          ],
        },
        { $set: { "network_roles.$.role": null, "group_roles.$.role": null } }
      );

      if (result.nModified > 0) {
        logger.info(
          `Removed role ${filter._id} from ${result.nModified} users.`
        );
      }

      if (result.n === 0) {
        logger.info(
          `Role ${filter._id} was not found in any users' network_roles or group_roles.`
        );
      }
      const responseFromDeleteRole = await RoleModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      logObject("responseFromDeleteRole", responseFromDeleteRole);
      return responseFromDeleteRole;
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
  updateRole: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request, next);
      const update = Object.assign({}, body);

      const responseFromUpdateRole = await RoleModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdateRole;
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
  createRole: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      let newBody = Object.assign({}, body);
      let organizationName;

      if (body.network_id) {
        const network = await NetworkModel(tenant).findById(body.network_id);
        if (isEmpty(network)) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided organization ${body.network_id} is invalid, please crosscheck`,
            })
          );
        }
        organizationName = network.net_name.toUpperCase();
      } else if (body.group_id) {
        const group = await GroupModel(tenant).findById(body.group_id);
        if (isEmpty(group)) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided group ${body.group_id} is invalid, please crosscheck`,
            })
          );
        }
        organizationName = group.grp_title.toUpperCase();
      } else {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Either network_id or group_id must be provided",
          })
        );
      }

      const transformedRoleName = convertToUpperCaseWithUnderscore(
        body.role_name
      );
      const availableRoleCode = body.role_code
        ? body.role_code
        : body.role_name;
      const transformedRoleCode =
        convertToUpperCaseWithUnderscore(availableRoleCode);

      newBody.role_name = `${organizationName}_${transformedRoleName}`;
      newBody.role_code = `${organizationName}_${transformedRoleCode}`;

      const responseFromCreateRole = await RoleModel(
        tenant.toLowerCase()
      ).register(newBody, next);

      return responseFromCreateRole;
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
  listAvailableUsersForRole: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { role_id } = request.params;

      const role = await RoleModel(tenant).findById(role_id);

      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid role ID ${role_id}, please crosscheck`,
          })
        );
      }

      const roleType = role.network_id ? "Network" : "Group";
      const query = roleType === "Network" ? "network_roles" : "group_roles";

      const responseFromListAvailableUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              [query]: {
                $not: {
                  $elemMatch: {
                    role: role_id,
                  },
                },
              },
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
        .exec();

      return {
        success: true,
        message: `Retrieved all available users for the ${roleType} role ${role_id}`,
        data: responseFromListAvailableUsers,
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
  assignUserToRole: async (request, next) => {
    try {
      const { role_id, user_id } = request.params;
      const { tenant, user } = { ...request.body, ...request.query };
      const userIdFromBody = user;
      const userIdFromQuery = user_id;

      if (!isEmpty(userIdFromBody) && !isEmpty(userIdFromQuery)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide the user ID using query params and query body; choose one approach",
          })
        );
      }

      const userId = userIdFromQuery || userIdFromBody;
      logObject("userId", userId);

      const role = await RoleModel(tenant).findById(role_id).lean();

      const userExists = await UserModel(tenant).exists({ _id: userId });
      const roleExists = await RoleModel(tenant).exists({ _id: role_id });

      if (!userExists || !roleExists) {
        next(
          new HttpError("User or Role not found", httpStatus.BAD_REQUEST, {
            message: `User ${userId} or Role ${role_id} not found`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(role);

      if (roleType === "none") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const isNetworkRole = roleType === "network";

      const userObject = await UserModel(tenant)
        .findById(userId)
        .populate(isNetworkRole ? "network_roles" : "group_roles")
        .lean();

      const userRoles = isNetworkRole
        ? userObject.network_roles
        : userObject.group_roles;
      logObject("userRoles", userRoles);
      const roles = userRoles || [];
      const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

      logObject("isRoleAssigned", isRoleAssigned);

      if (isRoleAssigned) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${userObject._id.toString()} is already assigned to the role ${role_id.toString()}`,
          })
        );
      }

      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The ROLE ${role_id} is not associated with any of the ${
              isNetworkRole ? "networks" : "groups"
            } already assigned to USER ${userObject._id}`,
          })
        );
      }

      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles: userRoles,
        tenant,
      });

      if (isSuperAdmin) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `SUPER ADMIN user ${userObject._id} cannot be reassigned to a different role`,
          })
        );
      }

      const updateQuery = {
        $set: {
          [isNetworkRole ? "network_roles" : "group_roles"]: {
            [isNetworkRole ? "network" : "group"]: associatedId,
            role: role_id,
          },
        },
      };

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        { _id: userObject._id },
        updateQuery,
        { new: true }
      );

      if (updatedUser) {
        return {
          success: true,
          message: "User assigned to the Role",
          data: updatedUser,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "Failed to assign user" }
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
  assignManyUsersToRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, user_ids } = { ...body, ...query, ...params };
      const roleObject = await RoleModel(tenant).findById(role_id).lean();

      if (isEmpty(roleObject)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} does not exist`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(roleObject);

      if (roleType === "none") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const assignUserPromises = [];
      const isNetworkRole = roleType === "network";

      const users = await UserModel(tenant)
        .find({ _id: { $in: user_ids } })
        .populate(isNetworkRole ? "network_roles" : "group_roles")
        .lean();

      for (const user of users) {
        if (isEmpty(user)) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: { message: `One of the Users does not exist` },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const userRoles = isNetworkRole ? user.network_roles : user.group_roles;

        const roles = userRoles || [];
        logObject("roles", roles);

        const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

        if (isRoleAssigned) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user._id.toString()} is already assigned to the role ${role_id.toString()}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const associatedId = await findAssociatedIdForRole({
          role_id,
          roles,
          tenant,
        });

        if (isEmpty(associatedId)) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `The ROLE ${role_id} is not associated with any of the ${
                isNetworkRole ? "networks" : "groups"
              } already assigned to USER ${user._id}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const isSuperAdmin = await isAssignedUserSuperAdmin({
          associatedId,
          roles: userRoles,
          tenant,
        });

        if (isSuperAdmin) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `SUPER ADMIN user ${user._id} can not be reassigned to a different role`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const updateQuery = {
          $set: {
            [isNetworkRole ? "network_roles" : "group_roles"]: {
              [isNetworkRole ? "network" : "group"]: associatedId,
              role: role_id,
            },
          },
        };

        await UserModel(tenant).updateOne({ _id: user._id }, updateQuery);

        assignUserPromises.push(null);
      }

      const assignUserResults = await Promise.all(assignUserPromises);
      const successfulAssignments = assignUserResults.filter(
        (result) => result === null
      );
      const unsuccessfulAssignments = assignUserResults.filter(
        (result) => result !== null
      );

      if (
        successfulAssignments.length > 0 &&
        unsuccessfulAssignments.length > 0
      ) {
        return {
          success: true,
          message: "Some users were successfully assigned to the role.",
          data: { unsuccessfulAssignments },
          status: httpStatus.OK,
        };
      } else if (
        unsuccessfulAssignments.length > 0 &&
        successfulAssignments.length === 0
      ) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "None of the provided users could be assigned to the role.",
            unsuccessfulAssignments,
          })
        );
      } else {
        return {
          success: true,
          message: "All provided users were successfully assigned to the role.",
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
    }
  },
  listUsersWithRole: async (request, next) => {
    try {
      logText("listUsersWithRole...");
      const { query, params } = request;
      const { role_id, tenant } = { ...query, ...params };

      const role = await RoleModel(tenant).findById(role_id);

      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid role ID ${role_id.toString()}, please crosscheck`,
          })
        );
      }

      const networkRoleFilter = { "network_roles.role": ObjectId(role_id) };
      const groupRoleFilter = { "group_roles.role": ObjectId(role_id) };

      const responseFromListAssignedUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              $or: [networkRoleFilter, groupRoleFilter],
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
        .exec();

      logObject("responseFromListAssignedUsers", responseFromListAssignedUsers);

      return {
        success: true,
        message: `retrieved all assigned users for role ${role_id}`,
        data: responseFromListAssignedUsers,
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
  unAssignUserFromRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { role_id, user_id, tenant } = { ...query, ...params };

      const [userObject, role, userExists, roleExists] = await Promise.all([
        UserModel(tenant)
          .findById(user_id)
          .populate("network_roles group_roles")
          .lean(),
        RoleModel(tenant).findById(role_id).lean(),
        UserModel(tenant).exists({ _id: user_id }),
        RoleModel(tenant).exists({ _id: role_id }),
      ]);

      if (!userExists || !roleExists) {
        next(
          new HttpError("User or Role not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} or Role ${role_id} not found`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(role);

      if (roleType === "none") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const { network_roles, group_roles } = userObject;
      const roles = roleType === "network" ? network_roles : group_roles;

      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The ROLE ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to USER ${user_id}`,
          })
        );
      }

      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles,
        tenant,
      });

      if (isSuperAdmin) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
          })
        );
      }

      const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

      if (!isRoleAssigned) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${user_id.toString()} is not assigned to the role ${role_id.toString()}`,
          })
        );
      }

      const filter = {
        _id: user_id,
        [`${roleType}_roles.${roleType}`]: associatedId,
      };
      const update = {
        $set: { [`${roleType}_roles.$[elem].role`]: null },
      };

      const arrayFilters = [{ "elem.role": role_id }];

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        filter,
        update,
        { new: true, arrayFilters }
      );

      if (isEmpty(updatedUser)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "User not found or not assigned to the specified Role in the Network or Group provided",
          })
        );
      }

      return {
        success: true,
        message: "User unassigned from the role",
        data: updatedUser,
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
  unAssignManyUsersFromRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, user_ids } = { ...body, ...query, ...params };
      const roleObject = await RoleModel(tenant).findById(role_id).lean();
      if (isEmpty(roleObject)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      // Check if all provided users actually exist
      const existingUsers = await UserModel(tenant).find(
        { _id: { $in: user_ids } },
        "_id"
      );

      const nonExistentUsers = user_ids.filter(
        (user_id) => !existingUsers.some((user) => user._id.equals(user_id))
      );

      if (nonExistentUsers.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The following users do not exist: ${nonExistentUsers.join(
              ", "
            )}`,
          })
        );
      }

      const unAssignUserPromises = [];

      for (const user_id of user_ids) {
        const userObject = await UserModel(tenant)
          .findById(user_id)
          .populate("network_roles group_roles")
          .lean();

        const { network_roles, group_roles } = userObject;
        logObject("roleObject", roleObject);
        const roleType = isGroupRoleOrNetworkRole(roleObject);
        logObject("roleType", roleType);

        if (roleType === "none") {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Role ${role_id.toString()} is not associated with any network or group`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const roles = roleType === "network" ? network_roles : group_roles;
        const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

        if (!isRoleAssigned) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user_id.toString()} is not assigned to the role ${role_id.toString()}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const associatedId = await findAssociatedIdForRole({
          role_id,
          roles,
          tenant,
        });

        if (!associatedId) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `The ROLE ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to USER ${user_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const isSuperAdmin = await isAssignedUserSuperAdmin({
          associatedId,
          roles,
          tenant,
        });

        if (isSuperAdmin) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const updateQuery = {
          $set: { [`${roleType}_roles.$[elem].role`]: null },
        };

        const updateResult = await UserModel(tenant).updateOne(
          { _id: user_id },
          updateQuery,
          { arrayFilters: [{ "elem.role": role_id }] }
        );

        if (updateResult.nModified !== 1) {
          unAssignUserPromises.push({
            success: false,
            message: "Could not unassign all users from the role.",
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
          continue;
        }

        unAssignUserPromises.push(null);
      }

      const assignUserResults = await Promise.all(unAssignUserPromises);

      const successfulUnassignments = assignUserResults.filter(
        (result) => result === null
      );
      const unsuccessfulUnAssignments = assignUserResults.filter(
        (result) => result !== null
      );

      let success, message, status;

      if (
        successfulUnassignments.length > 0 &&
        unsuccessfulUnAssignments.length > 0
      ) {
        success = true;
        message = "Some users were successfully unassigned from the role";
        status = httpStatus.OK;
      } else if (
        unsuccessfulUnAssignments.length > 0 &&
        successfulUnassignments.length === 0
      ) {
        success = false;
        message = "Bad Request Error";
        status = httpStatus.BAD_REQUEST;
      } else {
        success = true;
        message =
          "All provided users were successfully unassigned from the role.";
        status = httpStatus.OK;
      }

      const response = {
        success,
        message,
        status,
      };

      if (success) {
        response.data = { unsuccessfulUnAssignments };
      } else {
        response.errors = {
          message:
            "None of the provided users could be unassigned from the role.",
          unsuccessfulUnAssignments,
        };
      }
      return response;
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

  /******************** User Types *******************/
  assignUserType: async (request, next) => {
    try {
      const { user_id, net_id, grp_id, user, user_type, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!isEmpty(grp_id) && !isEmpty(net_id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide both a network ID and a group ID, choose one organization type",
          })
        );
      }

      if (!isEmpty(user) && !isEmpty(user_id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide the user ID using query params and query body; choose one approach",
          })
        );
      }

      const userId = user || user_id;
      const organisationId = net_id || grp_id;

      const userExists = await UserModel(tenant).exists({ _id: userId });

      if (!userExists) {
        next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${userId} not found`,
          })
        );
      }

      const isNetworkType = isNetwork(net_id, grp_id);
      const roleType = isNetworkType ? "network_roles" : "group_roles";

      const isAlreadyAssigned = await UserModel(tenant).exists({
        _id: userId,
        [`${roleType}.${isNetworkType ? "network" : "group"}`]: organisationId,
      });

      if (!isAlreadyAssigned) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${userId} is NOT assigned to the provided ${
              isNetworkType ? "Network" : "Group"
            } ${organisationId}`,
          })
        );
      }

      const updateQuery = {
        $set: {
          [roleType]: {
            [isNetworkType ? "network" : "group"]: organisationId,
            userType: user_type,
          },
        },
      };

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        { _id: userId },
        updateQuery,
        { new: true, select: `${roleType}` }
      );

      if (updatedUser) {
        return {
          success: true,
          message: `User assigned to the ${user_type} User Type`,
          data: updatedUser,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "Failed to assign user" }
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
  assignManyUsersToUserType: async (request, next) => {
    try {
      const { user_ids, user_type, net_id, grp_id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const userPromises = [];
      const isNetwork = !isEmpty(net_id);
      const isGroup = !isEmpty(grp_id);
      let updateQuery = {};

      if (isNetwork && isGroup) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide both a network ID and a group ID. Choose one organization type.",
          })
        );
      }

      for (const user_id of user_ids) {
        const user = await UserModel(tenant).findById(user_id);

        if (!user) {
          userPromises.push({
            success: false,
            message: `User ${user_id} does not exist`,
          });
          continue;
        }

        if (isNetwork) {
          const isAlreadyAssigned = user.network_roles.some(
            (role) => role.network.toString() === net_id
          );

          if (!isAlreadyAssigned) {
            userPromises.push({
              success: false,
              message: `User ${user_id} is NOT assigned to the provided Network ${net_id}`,
            });
            continue;
          }
          updateQuery.$set = updateQuery.$set || {};
          updateQuery.$set.network_roles = {
            network: net_id,
            userType: user_type,
          };
        } else if (isGroup) {
          const isAlreadyAssigned = user.group_roles.some(
            (role) => role.group.toString() === grp_id
          );

          if (!isAlreadyAssigned) {
            userPromises.push({
              success: false,
              message: `User ${user_id} is NOT assigned to provided Group ${grp_id}`,
            });
            continue;
          }
          updateQuery.$set = updateQuery.$set || {};
          updateQuery.$set.group_roles = { group: grp_id, userType: user_type };
        }

        await UserModel(tenant).updateOne({ _id: user_id }, updateQuery);

        userPromises.push({
          success: true,
          message: `User ${user_id} successfully assigned`,
        });
      }

      const results = await Promise.all(userPromises);
      const successful = results.filter(
        (result) => result !== null && result.success === true
      );
      const unsuccessful = results.filter(
        (result) => result !== null && result.success === false
      );

      if (unsuccessful.length > 0 && unsuccessful.length === user_ids.length) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `All users could not be assigned the ${user_type} user type.`,
            unsuccessful,
          })
        );
      } else if (
        unsuccessful.length > 0 &&
        unsuccessful.length !== user_ids.length
      ) {
        return {
          success: true,
          message: "Operation Partially successfull",
          data: { unsuccessful, successful },
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: `ALL provided users were successfully assigned the ${user_type} user type.`,
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
    }
  },
  listUsersWithUserType: async (request, next) => {
    try {
      logText("listUsersWithUserType...");
      const { user_type, net_id, grp_id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (net_id && grp_id) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide both a network ID and a group ID; choose one organization type",
          })
        );
      }

      let userTypeFilter = {};

      if (net_id) {
        const network = await NetworkModel(tenant)
          .findById(net_id)
          .select("_id")
          .lean();

        if (isEmpty(network)) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided Network ${net_id.toString()} does not exist`,
            })
          );
        }

        userTypeFilter = {
          "network_roles.userType": user_type,
          "network_roles.network": net_id,
        };
      } else if (grp_id) {
        const group = await GroupModel(tenant)
          .findById(grp_id)
          .select("_id")
          .lean();
        logObject("group", group);
        if (isEmpty(group)) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided Group ${grp_id.toString()} does not exist`,
            })
          );
        }
        userTypeFilter = {
          "group_roles.userType": user_type,
          "group_roles.group": grp_id,
        };
      }

      const responseFromListUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: userTypeFilter,
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
        .exec();

      logObject("responseFromListUsers", responseFromListUsers);
      let message = `Retrieved all ${user_type} users for this Organisation`;
      if (isEmpty(responseFromListUsers)) {
        message = `No ${user_type} users exist for provided Organisation`;
      }

      return {
        success: true,
        message,
        data: responseFromListUsers,
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
  listAvailableUsersForUserType: async (request, next) => {
    try {
      logText("listAvailableUsersForUserType...");
      const { user_type, net_id, grp_id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (net_id && grp_id) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide both a network ID and a group ID; choose one organization type",
          })
        );
      }

      let userTypeFilter = {};

      if (net_id) {
        const network = await NetworkModel(tenant)
          .findById(net_id)
          .select("_id")
          .lean();

        if (isEmpty(network)) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided Network ${net_id.toString()} does not exist`,
            })
          );
        }
        userTypeFilter = {
          "network_roles.userType": user_type,
          "network_roles.network": net_id,
        };
      } else if (grp_id) {
        const group = await GroupModel(tenant)
          .findById(grp_id)
          .select("_id")
          .lean();
        logObject("group", group);
        if (isEmpty(group)) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided Group ${grp_id.toString()} does not exist`,
            })
          );
        }
        userTypeFilter = {
          "group_roles.userType": user_type,
          "group_roles.group": grp_id,
        };
      }

      const assignedUsers = await UserModel(tenant)
        .distinct("email", userTypeFilter)
        .exec();

      const allUsers = await UserModel(tenant).distinct("email").exec();

      const availableUsers = allUsers.filter(
        (user) => !assignedUsers.includes(user)
      );

      const responseFromListAvailableUsers = await UserModel(tenant)
        .find({ email: { $in: availableUsers } })
        .select({
          _id: 1,
          email: 1,
          firstName: 1,
          lastName: 1,
          createdAt: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$_id",
            },
          },
          userName: 1,
        })
        .exec();

      logObject(
        "responseFromListAvailableUsers",
        responseFromListAvailableUsers
      );

      let message = `Retrieved all eligible ${user_type} Users for the provided Organisation`;
      if (isEmpty(responseFromListAvailableUsers)) {
        message = `No users are available to be ${user_type} for the provided Organisation `;
      }
      return {
        success: true,
        message,
        data: responseFromListAvailableUsers,
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

  /*********************roles and permissions....*/
  listPermissionsForRole: async (request, next) => {
    try {
      logText("listPermissionsForRole...");
      const { query, params } = request;
      const { role_id, tenant, limit, skip } = { ...query, ...params };
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;
      const filter = generateFilter.roles(newRequest, next);
      const listRoleResponse = await RoleModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next
      );

      if (listRoleResponse.success === true) {
        if (
          listRoleResponse.message === "roles not found for this operation" ||
          isEmpty(listRoleResponse.data)
        ) {
          return listRoleResponse;
        }

        const permissions = listRoleResponse.data[0].role_permissions;
        const permissionsArray = permissions.map((obj) => obj.permission);
        filter = { permission: { $in: permissionsArray } };
        let responseFromListPermissions = await PermissionModel(tenant).list(
          {
            skip,
            limit,
            filter,
          },
          next
        );
        return responseFromListPermissions;
      } else if (listRoleResponse.success === false) {
        return listRoleResponse;
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
  listAvailablePermissionsForRole: async (request, next) => {
    try {
      logText("listAvailablePermissionsForRole...");
      const { query, params } = request;
      const { role_id, tenant, limit, skip } = { ...query, ...params };
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;
      const filter = generateFilter.roles(newRequest, next);
      const listRoleResponse = await RoleModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next
      );

      if (listRoleResponse.success === true) {
        if (
          listRoleResponse.message === "roles not found for this operation" ||
          isEmpty(listRoleResponse.data)
        ) {
          return listRoleResponse;
        }

        const permissions = listRoleResponse.data[0].role_permissions;
        const permissionsArray = permissions.map((obj) => obj.permission);
        filter = { permission: { $nin: permissionsArray } };
        let responseFromListPermissions = await PermissionModel(tenant).list(
          {
            skip,
            limit,
            filter,
          },
          next
        );
        return responseFromListPermissions;
      } else if (listRoleResponse.success === false) {
        return listRoleResponse;
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
  assignPermissionsToRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, permissions } = { ...body, ...query, ...params };

      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} Not Found`,
          })
        );
      }

      const permissionsResponse = await PermissionModel(tenant).find({
        _id: { $in: permissions.map((id) => ObjectId(id)) },
      });

      if (permissionsResponse.length !== permissions.length) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "not all provided permissions exist, please crosscheck",
          })
        );
      }

      const assignedPermissions = role.role_permissions.map((permission) =>
        permission.toString()
      );

      logObject("assignedPermissions", assignedPermissions);

      const alreadyAssigned = permissions.filter((permission) =>
        assignedPermissions.includes(permission)
      );

      logObject("alreadyAssigned", alreadyAssigned);

      if (alreadyAssigned.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Some permissions already assigned to the Role ${role_id.toString()}, they include: ${alreadyAssigned.join(
              ","
            )}`,
          })
        );
      }
      const updatedRole = await RoleModel(tenant).findOneAndUpdate(
        { _id: role_id },
        { $addToSet: { role_permissions: { $each: permissions } } },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions added successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "unable to update Role",
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
  unAssignPermissionFromRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { role_id, permission_id, tenant } = { ...query, ...params };

      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} Not Found`,
          })
        );
      }

      const filter = { _id: role_id };
      const update = { $pull: { role_permissions: permission_id } };

      const permission = await PermissionModel(tenant).findById(permission_id);
      if (!permission) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permission ${permission_id.toString()} Not Found`,
          })
        );
      }

      const roleResponse = await RoleModel(tenant).findOne({
        _id: role_id,
        role_permissions: permission_id,
      });

      if (!roleResponse) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permission ${permission_id.toString()} is not assigned to the Role ${role_id.toString()}`,
          })
        );
      }

      const responseFromUnAssignPermissionFromRole = await RoleModel(
        tenant
      ).modify(
        {
          filter,
          update,
        },
        next
      );

      if (responseFromUnAssignPermissionFromRole.success === true) {
        let modifiedResponse = Object.assign(
          {},
          responseFromUnAssignPermissionFromRole
        );
        if (
          responseFromUnAssignPermissionFromRole.message ===
          "successfully modified the Permission"
        ) {
          modifiedResponse.message = "permission has been unassigned from role";
        }
        return modifiedResponse;
      } else if (responseFromUnAssignPermissionFromRole.success === false) {
        return responseFromUnAssignPermissionFromRole;
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
  unAssignManyPermissionsFromRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, permission_ids } = {
        ...body,
        ...query,
        ...params,
      };

      // Check if role exists
      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      // Check if any of the provided permission IDs don't exist
      const permissions = await PermissionModel(tenant).find({
        _id: { $in: permission_ids },
      });
      const missingPermissions = permission_ids.filter((permission_id) => {
        return !permissions.some((permission) =>
          permission._id.equals(permission_id)
        );
      });
      if (missingPermissions.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permissions not found: ${missingPermissions.join(", ")}`,
          })
        );
      }

      const assignedPermissions = role.role_permissions.map((permission) =>
        permission.toString()
      );

      const notAssigned = permission_ids.filter(
        (permission) => !assignedPermissions.includes(permission)
      );

      if (notAssigned.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Some of the provided permissions are not assigned to the Role ${role_id.toString()}, they include: ${notAssigned.join(
              ", "
            )}`,
          })
        );
      }

      const updatedRole = await RoleModel(tenant).findByIdAndUpdate(
        role_id,
        { $pull: { role_permissions: { $in: permission_ids } } },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions removed successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "unable to remove the permissions",
          })
        );
      }

      return {
        success: true,
        message: `permissions successfully unassigned from the role.`,
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
  updateRolePermissions: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, permission_ids } = {
        ...body,
        ...query,
        ...params,
      };

      // Check if role exists
      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      // Check if any of the provided permission IDs don't exist
      const permissions = await PermissionModel(tenant).find({
        _id: { $in: permission_ids },
      });
      const missingPermissions = permission_ids.filter((permission_id) => {
        return !permissions.some((permission) =>
          permission._id.equals(permission_id)
        );
      });
      if (missingPermissions.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permissions not found: ${missingPermissions.join(", ")}`,
          })
        );
      }

      const uniquePermissions = [...new Set(permission_ids)];

      const updatedRole = await RoleModel(tenant).findByIdAndUpdate(
        role_id,
        { role_permissions: uniquePermissions },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions updated successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "unable to update the permissions",
          })
        );
      }

      return {
        success: true,
        message: `permissions successfully updated.`,
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

  /******* permissions *******************************************/
  listPermission: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.permissions(request, next);
      const responseFromListPermissions = await PermissionModel(
        tenant.toLowerCase()
      ).list(
        {
          filter,
        },
        next
      );
      return responseFromListPermissions;
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
  deletePermission: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.permissions(request, next);
      const responseFromDeletePermission = await PermissionModel(
        tenant.toLowerCase()
      ).remove(
        {
          filter,
        },
        next
      );
      return responseFromDeletePermission;
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
  updatePermission: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const update = body;
      const filter = generateFilter.permissions(request, next);
      const responseFromUpdatePermission = await PermissionModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdatePermission;
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
  createPermission: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const responseFromCreatePermission = await PermissionModel(
        tenant.toLowerCase()
      ).register(body, next);
      return responseFromCreatePermission;
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

  /********* departments  ******************************************/
  createDepartment: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      let modifiedBody = Object.assign({}, body);
      const responseFromRegisterDepartment = await DepartmentModel(
        tenant.toLowerCase()
      ).register(modifiedBody, next);
      return responseFromRegisterDepartment;
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
  updateDepartment: async (request, next) => {
    try {
      const { body, query, params } = request;
      const { tenant } = {
        ...query,
        ...params,
      };
      const update = Object.assign({}, body);
      const filter = generateFilter.departments(request, next);
      const responseFromModifyDepartment = await DepartmentModel(
        tenant.toLowerCase()
      ).modify({ update, filter }, next);
      return responseFromModifyDepartment;
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
  deleteDepartment: async (request, next) => {
    try {
      logText("the delete operation.....");
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.departments(request, next);
      const responseFromRemoveNetwork = await DepartmentModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      return responseFromRemoveNetwork;
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
  listDepartment: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.departments(request, next);
      const responseFromListDepartments = await DepartmentModel(
        tenant.toLowerCase()
      ).list({ filter, limit, skip }, next);
      return responseFromListDepartments;
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

  /****************** Blacklisting IPs ******************************/
  blackListIp: async (request, next) => {
    try {
      const { ip, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const responseFromBlacklistIp = await BlacklistedIPModel(tenant).register(
        {
          ip,
        },
        next
      );
      return responseFromBlacklistIp;
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
  blackListIps: async (request, next) => {
    try {
      const { ips, tenant } = {
        ...request.body,
        ...request.query,
      };

      if (!ips || !Array.isArray(ips) || ips.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid input. Please provide an array of IP addresses.",
          })
        );
      }

      const responses = await Promise.all(
        ips.map(async (ip) => {
          const result = await BlacklistedIPModel(tenant).register(
            { ip },
            next
          );
          return { ip, success: result.success };
        })
      );

      const successful_responses = responses
        .filter((response) => response.success)
        .map((response) => response.ip);

      const unsuccessful_responses = responses
        .filter((response) => !response.success)
        .map((response) => response.ip);

      let finalMessage = "";
      let finalStatus = httpStatus.OK;

      if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "Some IPs have been blacklisted.";
      } else if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length === 0
      ) {
        finalMessage = "All responses were successful.";
      } else if (
        successful_responses.length === 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "None of the IPs provided were blacklisted.";
        finalStatus = httpStatus.BAD_REQUEST;
      }

      return {
        success: true,
        data: { successful_responses, unsuccessful_responses },
        status: finalStatus,
        message: finalMessage,
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
  removeBlacklistedIp: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const responseFromRemoveBlacklistedIp = await BlacklistedIPModel(
        tenant
      ).remove({ filter }, next);
      return responseFromRemoveBlacklistedIp;
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
  blackListIpRange: async (request, next) => {
    try {
      const { range, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const responseFromBlacklistIpRange = await BlacklistedIPRangeModel(
        tenant
      ).register(
        {
          range,
        },
        next
      );
      return responseFromBlacklistIpRange;
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
  bulkInsertBlacklistIpRanges: async (request, next) => {
    try {
      const { ranges, tenant } = {
        ...request.body,
        ...request.query,
      };

      if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Invalid input. Please provide an array of IP address ranges.",
          })
        );
        return;
      }

      const responses = await Promise.all(
        ranges.map(async (range) => {
          const result = await BlacklistedIPRangeModel(tenant).register(
            { range },
            next
          );
          return { range, success: result.success };
        })
      );

      const successful_responses = responses
        .filter((response) => response.success)
        .map((response) => response.range);

      const unsuccessful_responses = responses
        .filter((response) => !response.success)
        .map((response) => response.range);

      let finalMessage = "";
      let finalStatus = httpStatus.OK;

      if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "Some IP ranges have been blacklisted.";
      } else if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length === 0
      ) {
        finalMessage = "All responses were successful.";
      } else if (
        successful_responses.length === 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "None of the IP ranges provided were blacklisted.";
        finalStatus = httpStatus.BAD_REQUEST;
      }

      return {
        success: true,
        data: { successful_responses, unsuccessful_responses },
        status: finalStatus,
        message: finalMessage,
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
  removeBlacklistedIpRange: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const responseFromRemoveBlacklistedIpRange =
        await BlacklistedIPRangeModel(tenant).remove({ filter }, next);
      return responseFromRemoveBlacklistedIpRange;
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
  listBlacklistedIpRange: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const responseFromListBlacklistedIpRange = await BlacklistedIPRangeModel(
        tenant
      ).list(
        {
          filter,
        },
        next
      );
      return responseFromListBlacklistedIpRange;
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

  /****************** Whitelisting IPs ******************************/
  whiteListIp: async (request, next) => {
    try {
      const { ip, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const responseFromWhitelistIp = await WhitelistedIPModel(tenant).register(
        {
          ip,
        },
        next
      );
      return responseFromWhitelistIp;
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
  removeWhitelistedIp: async (request, next) => {
    try {
      const { ip, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const responseFromRemoveWhitelistedIp = await WhitelistedIPModel(
        tenant
      ).remove({ filter }, next);
      return responseFromRemoveWhitelistedIp;
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

  /****************** Unknown IPs ******************************/
  listUnknownIPs: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const responseFromListUnkownIP = await UnknownIPModel(tenant).list(
        {
          filter,
        },
        next
      );
      return responseFromListUnkownIP;
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
};

module.exports = controlAccess;
