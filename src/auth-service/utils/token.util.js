const BlacklistedIPModel = require("@models/BlacklistedIP");
const BlacklistedIPPrefixModel = require("@models/BlacklistedIPPrefix");
const IPPrefixModel = require("@models/IPPrefix");
const UnknownIPModel = require("@models/UnknownIP");
const WhitelistedIPModel = require("@models/WhitelistedIP");
const IPRequestLogModel = require("@models/IPRequestLog");
const BlacklistedIPRangeModel = require("@models/BlacklistedIPRange");
const ClientModel = require("@models/Client");
const AccessTokenModel = require("@models/AccessToken");
const VerifyTokenModel = require("@models/VerifyToken");
const UserModel = require("@models/User");
const EmailLogModel = require("@models/EmailLog");
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const accessCodeGenerator = require("generate-password");
const { logObject, logText, HttpError } = require("@utils/shared");
const {
  mailer,
  stringify,
  generateFilter,
  winstonLogger,
} = require("@utils/common");

const isEmpty = require("is-empty");
const constants = require("@config/constants");
const moment = require("moment-timezone");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- token-util`);
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
      })
      .catch((error) => {
        logObject("kafka producer send error", error);
        callback();
      });
    await kafkaProducer.disconnect().catch((error) => {
      logObject("kafka producer disconnect error", error);
    });
    // callback();
  } catch (error) {
    logObject("error", error);
    // logger.error(
    //   `🐛🐛 KAFKA Producer Internal Server Error --- IP_ADDRESS: ${ip} --- ${error.message}`
    // );
    callback();
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

let ipPrefixQueue = async.queue(async (task, callback) => {
  let { prefix, day } = task;
  await IPPrefixModel("airqo")
    .findOne({ prefix, "prefixCounts.day": day })
    .then(async (checkDoc) => {
      if (checkDoc) {
        const update = {
          $inc: {
            "prefixCounts.$[elem].count": 1,
          },
        };
        const options = {
          arrayFilters: [{ "elem.day": day }],
          upsert: true,
          new: true,
          runValidators: true,
        };

        await IPPrefixModel("airqo")
          .findOneAndUpdate({ prefix }, update, options)
          .then(() => {
            logText(`incremented the count of IP prefix ${prefix}`);
            callback();
          });
      } else {
        await IPPrefixModel("airqo")
          .create({
            prefix,
            prefixCounts: [{ day, count: 1 }],
          })
          .then(() => {
            logText(`stored the new IP prefix ${prefix}`);
            callback();
          });
      }
    });
}, 1); // Limit the number of concurrent tasks to 1

function generatePrefix(ipAddress) {
  return ipAddress.split(".")[0];
}

const postProcessing = async ({
  ip,
  token,
  name,
  client_id,
  endpoint = "unknown",
  day,
}) => {
  const prefix = generatePrefix(ip);
  blacklistQueue.push({ ip });
  unknownIPQueue.push({
    ip,
    token,
    name,
    client_id,
    endpoint,
    day,
  });
  ipPrefixQueue.push({ prefix, day });
};

const isIPBlacklistedHelper = async (
  { request, next } = {},
  retries = 1,
  delay = 1000,
) => {
  try {
    const day = getDay();
    const ip =
      request.headers["x-client-ip"] || request.headers["x-client-original-ip"];
    const endpoint = request.headers["x-original-uri"];
    let accessTokenFilter = generateFilter.tokens(request, next);
    const timeZone = moment.tz.guess();
    accessTokenFilter.expires = {
      $gt: moment().tz(timeZone).toDate(),
    };
    const { expires, ...filteredAccessToken } = accessTokenFilter;

    const [
      blacklistedIP,
      whitelistedIP,
      accessToken,
      blacklistedIpPrefixesData,
    ] = await Promise.all([
      BlacklistedIPModel("airqo").findOne({ ip }),
      WhitelistedIPModel("airqo").findOne({ ip }),
      AccessTokenModel("airqo")
        .findOne(accessTokenFilter)
        .select("name token client_id expiredEmailSent"),
      BlacklistedIPPrefixModel("airqo").find().select("prefix").lean(),
    ]);

    const {
      token = "",
      name = "",
      client_id = "",
    } = (accessToken && accessToken._doc) || {};

    const BLOCKED_IP_PREFIXES =
      "65,66,52,3,43,54,18,57,23,40,13,46,51,17,146,142";
    const blockedIpPrefixes = BLOCKED_IP_PREFIXES.split(",");
    const ipPrefix = ip.split(".")[0];
    const blacklistedIpPrefixes = blacklistedIpPrefixesData.map(
      (item) => item.prefix,
    );

    if (!accessToken) {
      try {
        const filter = filteredAccessToken;
        const listTokenReponse = await AccessTokenModel("airqo").list(
          { filter },
          next,
        );

        if (listTokenReponse.success === false) {
          logger.error(
            `🐛🐛 Internal Server Error -- unable to retrieve the expired token's details -- ${stringify(
              listTokenReponse,
            )}`,
          );
        } else {
          const tokenDetails = listTokenReponse.data[0];
          const tokenResponseLength = listTokenReponse.data.length;
          if (isEmpty(tokenDetails) || tokenResponseLength > 1) {
            logger.error(
              `🐛🐛 Internal Server Error -- unable to find the expired token's user details -- TOKEN_DETAILS: ${stringify(
                tokenDetails,
              )} -- CLIENT_IP: ${ip}`,
            );
          } else {
            const {
              user: { email, firstName, lastName },
              token,
              name,
              expiredEmailSent,
            } = tokenDetails;

            if (!expiredEmailSent) {
              logger.info(
                `🚨🚨 An AirQo API Access Token is expired -- TOKEN: ${token} -- TOKEN_DESCRIPTION: ${name} -- EMAIL: ${email} -- FIRST_NAME: ${firstName} -- LAST_NAME: ${lastName}`,
              );
              const emailResponse = await mailer.expiredToken(
                {
                  email,
                  firstName,
                  lastName,
                  token,
                },
                next,
              );

              if (emailResponse && emailResponse.success === false) {
                logger.error(
                  `🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`,
                );
              } else {
                // Update the expiredEmailSent field to true after sending the email
                await AccessTokenModel("airqo").updateOne(
                  { token },
                  { $set: { expiredEmailSent: true } },
                );
              }
            }
          }
        }
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      }
      return true;
    } else if (whitelistedIP) {
      return false;
    } else if (blockedIpPrefixes.includes(ipPrefix)) {
      return true;
    } else if (blacklistedIpPrefixes.includes(ipPrefix)) {
      return true;
    } else if (blacklistedIP) {
      logger.info(
        `🚨🚨 An AirQo API Access Token is compromised -- TOKEN: ${token} -- TOKEN_DESCRIPTION: ${name} -- CLIENT_IP: ${ip} `,
      );

      try {
        const filter = { token };
        const listTokenResponse = await AccessTokenModel("airqo").list(
          { filter },
          next,
        );

        if (listTokenResponse.success && listTokenResponse.data.length === 1) {
          const {
            user: { email, firstName, lastName },
          } = listTokenResponse.data[0];

          const canSend = await EmailLogModel("airqo").canSendEmail({
            email,
            emailType: "compromisedToken",
            ip: ip,
          });

          if (canSend.canSend) {
            logger.info(
              `Sending compromised token alert to ${email} for IP ${ip}.`,
            );
            await mailer.compromisedToken(
              { email, firstName, lastName, ip },
              next,
            );
            await EmailLogModel("airqo").logEmailSent({
              email,
              emailType: "compromisedToken",
              ip: ip,
            });
          } else {
            logger.info(
              `Skipping compromised token alert for ${email} from IP ${ip} due to daily limit.`,
            );
          }
        }
      } catch (error) {
        logger.error(
          `🐛🐛 Internal Server Error while processing compromised token alert for token ${token} and IP ${ip}: ${error.message}`,
        );
      }

      return true;
    } else {
      Promise.resolve().then(() =>
        postProcessing({ ip, token, name, client_id, endpoint, day }),
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
        `🐛🐛 Transient errors or network issues when handling the DB operations during verification of this IP address: ${ip}.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return isIPBlacklisted({ request, next }, retries - 1, delay);
    } else if (error.name === "MongoError") {
      const jsonErrorString = stringify(error);
      switch (error.code) {
        case 11000:
          logger.error(
            `🐛🐛 Duplicate key error: IP address ${ip} already exists in the database.`,
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

const token = {
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
          }),
        );
      }

      const responseFromListAccessToken = await VerifyTokenModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next,
      );

      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          next(
            new HttpError("Invalid link", httpStatus.BAD_REQUEST, {
              message: "incorrect user or token details provided",
            }),
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
            next,
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
              tenant,
            ).remove({ filter }, next);

            logObject("responseFromDeleteToken", responseFromDeleteToken);

            if (responseFromDeleteToken.success === true) {
              const responseFromSendEmail = await mailer.afterEmailVerification(
                {
                  firstName: userDetails[0].firstName,
                  username: userDetails[0].userName,
                  email: userDetails[0].email,
                },
                next,
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
                    : { message: "internal server errors" },
                ),
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
                  : { message: "internal server errors" },
              ),
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
          { message: error.message },
        ),
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
          }),
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
            }),
          );
        }
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH),
        )
        .toUpperCase();

      let update = Object.assign({}, body);
      update.token = token;

      const responseFromUpdateToken = await AccessTokenModel(
        tenant.toLowerCase(),
      ).modify({ filter, update }, next);
      return responseFromUpdateToken;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  deleteAccessToken: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.tokens(request, next);
      const responseFromDeleteToken = await AccessTokenModel(
        tenant.toLowerCase(),
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
          { message: error.message },
        ),
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
      const accessToken = await AccessTokenModel("airqo")
        .findOne({ token })
        .select("client_id token");

      if (isEmpty(accessToken)) {
        return createUnauthorizedResponse();
      } else if (isEmpty(ip)) {
        logText(`🚨🚨 Token is being accessed without an IP address`);
        logger.error(`🚨🚨 Token is being accessed without an IP address`);
        return createUnauthorizedResponse();
      } else {
        const client = await ClientModel("airqo")
          .findById(accessToken.client_id)
          .select("isActive");

        if (isEmpty(client) || (client && !client.isActive)) {
          logger.error(
            `🚨🚨 Client ${accessToken.client_id} associated with Token ${accessToken.token} is INACTIVE or does not exist`,
          );
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
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
            { message: "service is temporarily disabled" },
          ),
        );
      }

      const responseFromListToken = await AccessTokenModel(
        tenant.toLowerCase(),
      ).list({ skip, limit, filter }, next);
      return responseFromListToken;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listExpiringTokens: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip } = { ...query, ...params };
      const filter = generateFilter.tokens(request, next);
      const responseFromListExpiringTokens = await AccessTokenModel(
        tenant.toLowerCase(),
      ).getExpiringTokens({ skip, limit, filter }, next);
      return responseFromListExpiringTokens;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listExpiredTokens: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip } = { ...query, ...params };
      const filter = generateFilter.tokens(request, next);
      const responseFromListExpiredTokens = await AccessTokenModel(
        tenant.toLowerCase(),
      ).getExpiredTokens({ skip, limit, filter }, next);
      return responseFromListExpiredTokens;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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

      const client = await ClientModel(tenant)
        .findById(ObjectId(client_id))
        .lean();

      if (!client) {
        next(
          new HttpError("Client not found", httpStatus.BAD_REQUEST, {
            message: `Invalid request, Client ${client_id} not found`,
          }),
        );
        return;
      }

      if (isEmpty(client.isActive) || client.isActive === false) {
        next(
          new HttpError(
            "Client not yet activated, reach out to Support",
            httpStatus.BAD_REQUEST,
            {
              message: `Invalid request, Client ${client_id} not yet activated, reach out to Support`,
            },
          ),
        );
        return;
      }
      const token = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH),
        )
        .toUpperCase();

      let tokenCreationBody = Object.assign(
        { token, client_id: ObjectId(client_id) },
        request.body,
      );
      tokenCreationBody.category = "api";
      const responseFromCreateToken = await AccessTokenModel(
        tenant.toLowerCase(),
      ).register(tokenCreationBody, next);

      return responseFromCreateToken;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
            constants.RANDOM_PASSWORD_CONFIGURATION(10),
          );

      const newRequest = Object.assign({ userName: email, password }, request);

      const responseFromCreateUser = await UserModel(tenant).register(
        newRequest,
        next,
      );
      if (responseFromCreateUser.success === true) {
        if (responseFromCreateUser.status === httpStatus.NO_CONTENT) {
          return responseFromCreateUser;
        }
        const token = accessCodeGenerator
          .generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH),
          )
          .toUpperCase();

        const toMilliseconds = (hrs, min, sec) =>
          (hrs * 60 * 60 + min * 60 + sec) * 1000;

        const emailVerificationHours = parseInt(
          constants.EMAIL_VERIFICATION_HOURS,
        );
        const emailVerificationMins = parseInt(
          constants.EMAIL_VERIFICATION_MIN,
        );
        const emailVerificationSeconds = parseInt(
          constants.EMAIL_VERIFICATION_SEC,
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
                emailVerificationSeconds,
              ),
          },
          next,
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
            next,
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
          { message: error.message },
        ),
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
        next,
      );

      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          next(
            new HttpError("Invalid link", httpStatus.BAD_REQUEST, {
              message: "incorrect user or token details provided",
            }),
          );
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          const password = accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(10),
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
            next,
          );

          if (responseFromUpdateUser.success === true) {
            if (responseFromUpdateUser.status === httpStatus.BAD_REQUEST) {
              return responseFromUpdateUser;
            }
            let user = responseFromUpdateUser.data;
            filter = { token };
            logObject("the deletion of the token filter", filter);
            const responseFromDeleteToken = await AccessTokenModel(
              tenant,
            ).remove({ filter }, next);

            if (responseFromDeleteToken.success === true) {
              const responseFromSendEmail = await mailer.afterEmailVerification(
                {
                  firstName: user.firstName,
                  username: user.userName,
                  password,
                  email: user.email,
                },
                next,
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
                    : { message: "internal server errors" },
                ),
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
                  : { message: "internal server errors" },
              ),
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
          { message: error.message },
        ),
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
        next,
      );
      return responseFromBlacklistIp;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
          }),
        );
      }

      const responses = await Promise.all(
        ips.map(async (ip) => {
          try {
            const result = await BlacklistedIPModel(tenant).register(
              { ip },
              () => {},
            );
            return { ip, success: result.success };
          } catch (error) {
            logger.error(`Error blacklisting IP ${ip}: ${error.message}`);
            return { ip, success: false };
          }
        }),
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
          { message: error.message },
        ),
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
        tenant,
      ).remove({ filter }, next);
      return responseFromRemoveBlacklistedIp;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listBlacklistedIp: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await BlacklistedIPModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  /****************** Blacklisting IP ranges *********************************/
  blackListIpRange: async (request, next) => {
    try {
      const { range, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const response = await BlacklistedIPRangeModel(tenant).register(
        {
          range,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
          }),
        );
        return;
      }

      const responses = await Promise.all(
        ranges.map(async (range) => {
          const result = await BlacklistedIPRangeModel(tenant).register(
            { range },
            next,
          );
          return { range, success: result.success };
        }),
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
          { message: error.message },
        ),
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
      const response = await BlacklistedIPRangeModel(tenant).remove(
        { filter },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
      const response = await BlacklistedIPRangeModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  /****************** Blacklisting IP prefix *********************************/
  blackListIpPrefix: async (request, next) => {
    try {
      const { prefix, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const response = await BlacklistedIPPrefixModel(tenant).register(
        {
          prefix,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  bulkInsertBlacklistIpPrefix: async (request, next) => {
    try {
      const { prefixes, tenant } = {
        ...request.body,
        ...request.query,
      };

      if (!prefixes || !Array.isArray(prefixes) || prefixes.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Invalid input. Please provide an array of IP address prefixes.",
          }),
        );
        return;
      }

      const responses = await Promise.all(
        prefixes.map(async (prefix) => {
          const result = await BlacklistedIPPrefixModel(tenant).register(
            { prefix },
            next,
          );
          return { prefix, success: result.success };
        }),
      );

      const successful_responses = responses
        .filter((response) => response.success)
        .map((response) => response.prefix);

      const unsuccessful_responses = responses
        .filter((response) => !response.success)
        .map((response) => response.prefix);

      let finalMessage = "";
      let finalStatus = httpStatus.OK;

      if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "Some IP prefixes have been blacklisted.";
      } else if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length === 0
      ) {
        finalMessage = "All responses were successful.";
      } else if (
        successful_responses.length === 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "None of the IP prefixes provided were blacklisted.";
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
          { message: error.message },
        ),
      );
      return;
    }
  },
  removeBlacklistedIpPrefix: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await BlacklistedIPPrefixModel(tenant).remove(
        { filter },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listBlacklistedIpPrefix: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await BlacklistedIPPrefixModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  /****************** IP prefix *********************************/
  ipPrefix: async (request, next) => {
    try {
      const { prefix, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const response = await IPPrefixModel(tenant).register(
        {
          prefix,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  bulkInsertIpPrefix: async (request, next) => {
    try {
      const { prefixes, tenant } = {
        ...request.body,
        ...request.query,
      };

      if (!prefixes || !Array.isArray(prefixes) || prefixes.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Invalid input. Please provide an array of IP address prefixes.",
          }),
        );
        return;
      }

      const responses = await Promise.all(
        prefixes.map(async (prefix) => {
          const result = await IPPrefixModel(tenant).register({ prefix }, next);
          return { prefix, success: result.success };
        }),
      );

      const successful_responses = responses
        .filter((response) => response.success)
        .map((response) => response.prefix);

      const unsuccessful_responses = responses
        .filter((response) => !response.success)
        .map((response) => response.prefix);

      let finalMessage = "";
      let finalStatus = httpStatus.OK;

      if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "Some IP prefixes have been added.";
      } else if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length === 0
      ) {
        finalMessage = "All responses were successful.";
      } else if (
        successful_responses.length === 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "None of the IP prefixes provided were added.";
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
          { message: error.message },
        ),
      );
      return;
    }
  },
  removeIpPrefix: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await IPPrefixModel(tenant).remove({ filter }, next);
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listIpPrefix: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await IPPrefixModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
        next,
      );
      return responseFromWhitelistIp;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  bulkWhiteListIps: async (request, next) => {
    try {
      const { ips, tenant } = {
        ...request.body,
        ...request.query,
      };

      if (!ips || !Array.isArray(ips) || ips.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid input. Please provide an array of IP addresses.",
          }),
        );
      }

      const responses = await Promise.all(
        ips.map(async (ip) => {
          try {
            const result = await WhitelistedIPModel(tenant).register(
              { ip },
              () => {},
            );
            return { ip, success: result.success };
          } catch (error) {
            logger.error(`Error whitelisting IP ${ip}: ${error.message}`);
            return { ip, success: false };
          }
        }),
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
        finalMessage = "Some IPs have been whitelisted.";
      } else if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length === 0
      ) {
        finalMessage = "All responses were successful.";
      } else if (
        successful_responses.length === 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "None of the IPs provided were whitelisted.";
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
          { message: error.message },
        ),
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
        tenant,
      ).remove({ filter }, next);
      return responseFromRemoveWhitelistedIp;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listWhitelistedIp: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await WhitelistedIPModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
        next,
      );
      return responseFromListUnkownIP;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  analyzeIPRequestPatterns: async ({ ip, tenant = "airqo", endpoint } = {}) => {
    try {
      // Define endpoints to monitor for bot-like patterns
      // This can be moved to a central constants file if used elsewhere.
      const BOT_MONITORED_ENDPOINTS = ["/api/v2/devices/readings"];

      if (!BOT_MONITORED_ENDPOINTS.includes(endpoint)) {
        // Only analyze patterns for specific, sensitive endpoints
        return;
      }

      const MIN_REQUESTS_FOR_ANALYSIS = 10;
      const MIN_PATTERN_OCCURRENCES = 5;
      const MIN_INTERVAL_MINUTES = 20; // Ignore intervals less than 20 minutes
      const MAX_PREFIX_BOTS = 3;

      // Fetch requests specifically for this IP and endpoint
      const requests = await IPRequestLogModel(tenant).getRequestsForEndpoint(
        ip,
        endpoint,
      );

      if (requests.length < MIN_REQUESTS_FOR_ANALYSIS) {
        return; // Not enough data to analyze
      }

      requests.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const deltas = [];
      for (let i = 1; i < requests.length; i++) {
        const deltaMinutes =
          (requests[i].timestamp.getTime() -
            requests[i - 1].timestamp.getTime()) /
          (1000 * 60);
        deltas.push(Math.round(deltaMinutes));
      }

      const deltaCounts = deltas.reduce((acc, delta) => {
        if (delta < MIN_INTERVAL_MINUTES) return acc; // Ignore short intervals
        acc[delta] = (acc[delta] || 0) + 1;
        return acc;
      }, {});

      // Find the most frequent interval
      let mostFrequentInterval = 0;
      let maxCount = 0;
      for (const interval in deltaCounts) {
        if (deltaCounts[interval] > maxCount) {
          maxCount = deltaCounts[interval];
          mostFrequentInterval = parseInt(interval, 10);
        }
      }

      if (maxCount < MIN_PATTERN_OCCURRENCES) {
        return; // No significant pattern found
      }

      // Pattern detected!
      logger.warn(
        `🤖 Bot-like pattern detected for IP: ${ip}. Interval: ~${mostFrequentInterval} minutes. Occurrences: ${maxCount}.`,
      );

      // 1. Blacklist the IP
      const blacklistResponse = await BlacklistedIPModel(tenant).register({
        ip,
      });
      if (!blacklistResponse.success) {
        logger.error(
          `Failed to blacklist IP ${ip}: ${blacklistResponse.message}`,
        );
      }
      await IPRequestLogModel(tenant).markAsBot(ip, mostFrequentInterval);

      // 2. Handle serverless/cloud provider IPs by blacklisting the prefix
      const ipPrefix = ip.split(".").slice(0, 2).join(".");
      const prefixBotLogs =
        await IPRequestLogModel(tenant).getBotLogsByPrefix(ipPrefix);

      if (prefixBotLogs.length >= MAX_PREFIX_BOTS) {
        logger.warn(
          `Multiple bots (${prefixBotLogs.length}) detected from prefix ${ipPrefix}. Blacklisting prefix.`,
        );
        const prefixBlacklistResponse = await BlacklistedIPPrefixModel(
          tenant,
        ).register({
          prefix: ipPrefix,
        });
        if (!prefixBlacklistResponse.success) {
          logger.error(
            `Failed to blacklist prefix ${ipPrefix}: ${prefixBlacklistResponse.message}`,
          );
        }
      }

      // 3. Notify admins
      const adminEmails = constants.SUPER_ADMIN_EMAIL_ALLOWLIST
        ? constants.SUPER_ADMIN_EMAIL_ALLOWLIST.split(",")
        : [];
      if (adminEmails.length > 0) {
        mailer
          .sendBotAlert(
            {
              recipients: adminEmails,
              ip,
              interval: mostFrequentInterval,
              occurrences: maxCount,
              prefix: ipPrefix,
              prefixBotCount: prefixBotLogs.length,
            },
            { tenant },
          )
          .catch((err) =>
            logger.error(
              `Failed to send bot alert email for IP ${ip}: ${err.message}`,
            ),
          );
      }
    } catch (error) {
      logObject(
        `Error during IP pattern analysis for ${ip}: ${error.message}`,
        error,
      );
      logger.error(
        `🐛🐛 Error during IP pattern analysis for ${ip}: ${error.message}`,
      );
    }
  },
};

module.exports = token;
