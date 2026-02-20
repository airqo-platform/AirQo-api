const WhitelistedIPModel = require("@models/WhitelistedIP");
const ClientModel = require("@models/Client");
const UserModel = require("@models/User");
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const { logObject, logText, HttpError } = require("@utils/shared");
const { mailer, stringify, generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const ObjectId = mongoose.Types.ObjectId;
const crypto = require("crypto");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- client-util`);

const generateClientSecret = (length) => {
  if (length % 2 !== 0) {
    throw new Error("Length must be an even number");
  }
  const numBytes = length / 2;
  const clientSecret = crypto.randomBytes(numBytes).toString("hex");
  return clientSecret;
};

const client = {
  updateClient: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.clients(request, next);
      let update = Object.assign({}, body);
      if (update.client_secret) {
        delete update.client_secret;
      }
      if (update.isActive) {
        delete update.isActive;
      }
      const responseFromUpdateClient = await ClientModel(
        tenant.toLowerCase(),
      ).modify({ filter, update }, next);
      if (responseFromUpdateClient.success === true) {
        const ip = update.ip_address || "";
        const ip_addresses = update.ip_addresses || [];
        if (!isEmpty(ip)) {
          try {
            const res = await WhitelistedIPModel("airqo").updateOne(
              { ip },
              { ip },
              {
                upsert: true,
              },
            );
            if (res.ok === 1) {
              logText(`Whitelisting CLIENT IP ${ip} successful`);
            } else {
              logger.error(`Whitelisting CLIENT's IP ${ip} was NOT successful`);
            }
          } catch (error) {
            if (error.name === "MongoError" && error.code !== 11000) {
              logger.error(
                `🐛🐛 MongoError -- createClient -- ${stringify(error)}`,
              );
            } else if (error.code === 11000) {
              logger.error(
                `Duplicate key error for IP ${ip} when updating a CLIENT`,
              );
            }
          }
          return responseFromUpdateClient;
        } else if (ip_addresses && ip_addresses.length > 0) {
          const responses = await Promise.all(
            ip_addresses.map(async (ip) => {
              try {
                const result = await WhitelistedIPModel(tenant).updateOne(
                  { ip },
                  { ip },
                  {
                    upsert: true,
                  },
                );

                return {
                  ip,
                  success: result.ok === 1,
                  message:
                    result.ok === 1
                      ? `Whitelisting CLIENT IP ${ip} successful`
                      : `Whitelisting CLIENT's IP ${ip} was NOT successful`,
                };
              } catch (error) {
                if (error.name === "MongoError" && error.code !== 11000) {
                  logger.error(
                    `🐛🐛 MongoError -- whitelisting IP ${ip} -- ${stringify(
                      error,
                    )}`,
                  );
                } else if (error.code === 11000) {
                  logger.error(
                    `Duplicate key error for IP ${ip} when creating a new CLIENT`,
                  );
                }
                return {
                  ip,
                  success: false,
                  message: `Error whitelisting IP ${ip}: ${error.message}`,
                };
              }
            }),
          );

          const successfulResponses = responses
            .filter((response) => response.success)
            .map((response) => response.ip);

          const unsuccessfulResponses = responses
            .filter((response) => !response.success)
            .map((response) => response.ip);

          let finalMessage = "";
          let finalStatus = httpStatus.OK;

          if (
            successfulResponses.length > 0 &&
            unsuccessfulResponses.length > 0
          ) {
            finalMessage = "Some IPs have been whitelisted.";
          } else if (
            successfulResponses.length > 0 &&
            unsuccessfulResponses.length === 0
          ) {
            finalMessage = "All responses were successful.";
          } else if (
            successfulResponses.length === 0 &&
            unsuccessfulResponses.length > 0
          ) {
            finalMessage = "None of the IPs provided were whitelisted.";
            finalStatus = httpStatus.BAD_REQUEST;
          }
          // logObject("finalMessage", finalMessage);
          // logObject("successfulResponses", successfulResponses);
          // logObject("unsuccessfulResponses", unsuccessfulResponses);
          // logObject("finalStatus", finalStatus);
          return responseFromUpdateClient;
        } else {
          return responseFromUpdateClient;
        }
      } else {
        return responseFromUpdateClient;
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
  activateClient: async (request, next) => {
    try {
      const { query, body, params } = request;
      const { tenant } = query;
      const { client_id } = params;
      const filter = generateFilter.clients(request, next);

      const isActive = body.isActive === "true";

      const update = {
        isActive: isActive,
      };
      const responseFromUpdateClient = await ClientModel(
        tenant.toLowerCase(),
      ).modify({ filter, update }, next);
      if (
        isEmpty(responseFromUpdateClient.data) ||
        isEmpty(responseFromUpdateClient.data.user_id)
      ) {
        return {
          success: false,
          message: "Unable to find the user associated with the Client ID",
          errors: {
            message: "Unable to find the user associated with the Client ID",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }
      const user_id = ObjectId(responseFromUpdateClient.data.user_id);
      const userDetails = await UserModel(tenant)
        .findById(user_id)
        .lean()
        .select("firstName lastName email");

      if (responseFromUpdateClient.success === true) {
        const name =
          userDetails.firstName === "Unknown"
            ? "User"
            : userDetails.lastName === "Unknown"
              ? "User"
              : userDetails.firstName || userDetails.lastName;

        const email = userDetails.email;
        const responseFromSendEmail = await mailer.afterClientActivation(
          {
            name,
            client_id,
            email,
            action: isActive ? "activate" : "deactivate",
          },
          next,
        );
        const responseMessage = isActive
          ? "AirQo API client activated successfully"
          : "AirQo API client deactivated successfully";

        if (responseFromSendEmail.success === true) {
          return {
            success: true,
            message: responseMessage,
            status: httpStatus.OK,
            data: {
              ...responseFromUpdateClient.data,
              action: isActive ? "activate" : "deactivate",
            },
          };
        } else if (responseFromSendEmail.success === false) {
          return responseFromSendEmail;
        }
      } else {
        return responseFromUpdateClient;
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
  activateClientRequest: async (request, next) => {
    try {
      const { client_id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const filter = generateFilter.clients(request, next);
      const clientDetailsResponse = await ClientModel(tenant).list(
        { filter },
        next,
      );
      logObject("clientDetailsResponse", clientDetailsResponse);
      const { firstName, lastName, email } = clientDetailsResponse.data[0].user;
      const name = firstName || lastName || "";

      // Send confirmation email to the user
      const responseFromSendEmail = await mailer.clientActivationRequest(
        {
          name,
          email,
          tenant,
          client_id,
        },
        next,
      );

      // Send admin notification email (BCC to REQUEST_ACCESS_EMAILS)
      // Fire-and-forget; don't block on admin email result
      const hasAdminRecipients =
        constants.REQUEST_ACCESS_EMAILS || constants.SUPPORT_EMAIL;

      if (hasAdminRecipients) {
        mailer
          .clientActivationRequestAdmin(
            {
              name,
              userEmail: email,
              email: constants.SUPPORT_EMAIL || null,
              tenant,
              client_id,
            },
            next,
          )
          .catch((err) => {
            logger.error(
              `Failed to send admin client activation notification: ${err.message}`,
            );
          });
      } else {
        logger.warn(
          `No admin recipients configured for client activation request notification — client_id: ${client_id}`,
        );
      }

      if (responseFromSendEmail.success === true) {
        return {
          success: true,
          message: "activation request successfully received",
          status: responseFromSendEmail.status || "",
        };
      } else if (responseFromSendEmail.success === false) {
        logObject("responseFromSendEmail", responseFromSendEmail);
        return responseFromSendEmail;
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
  deleteClient: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.clients(request, next);
      const responseFromDeleteClient = await ClientModel(
        tenant.toLowerCase(),
      ).remove({ filter }, next);
      return responseFromDeleteClient;
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
  listClients: async (request, next) => {
    try {
      const { tenant, limit, skip } = { ...request.query };
      const filter = generateFilter.clients(request, next);
      const responseFromListClient = await ClientModel(
        tenant.toLowerCase(),
      ).list({ skip, limit, filter }, next);
      return responseFromListClient;
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
  getClientById: async (request, next) => {
    try {
      const { client_id } = request.params;
      const { tenant } = request.query;

      if (!client_id) {
        return {
          success: false,
          message: "client_id parameter is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "client_id parameter is required" },
        };
      }

      let validObjectId;
      try {
        validObjectId = ObjectId(client_id);
      } catch (error) {
        return {
          success: false,
          message: "Invalid client_id format",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "client_id must be a valid ObjectId" },
        };
      }

      const filter = { _id: validObjectId };
      const responseFromListClient = await ClientModel(
        tenant.toLowerCase(),
      ).list({ skip: 0, limit: 1, filter }, next);

      if (responseFromListClient.success === true) {
        // Even if found, the list method might return empty array if no match
        if (
          !responseFromListClient.data ||
          responseFromListClient.data.length === 0
        ) {
          return {
            success: false,
            message: "Client not found",
            status: httpStatus.NOT_FOUND,
            errors: { message: `Client with ID ${client_id} not found` },
          };
        }

        return {
          success: true,
          message: "successfully retrieved the client details",
          status: httpStatus.OK,
          data: responseFromListClient.data, // This will be an array with one item
        };
      } else {
        return responseFromListClient;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in getClientById: ${error.message}`,
      );
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
  createClient: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant, user_id } = { ...body, ...query };
      const client_secret = generateClientSecret(100);
      const userExists = await UserModel(tenant).exists({ _id: user_id });

      if (!userExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} does not exist`,
          }),
        );
      }
      let modifiedBody = Object.assign({}, body);
      modifiedBody.client_secret = client_secret;

      const responseFromCreateClient = await ClientModel(
        tenant.toLowerCase(),
      ).register(modifiedBody, next);

      if (responseFromCreateClient.success === true) {
        const client = responseFromCreateClient.data;
        const ip = modifiedBody.ip_address || "";
        const ip_addresses = modifiedBody.ip_addresses || [];
        if (!isEmpty(ip)) {
          try {
            const res = await WhitelistedIPModel("airqo").updateOne(
              { ip },
              { ip },
              {
                upsert: true,
              },
            );

            if (res.ok === 1) {
              logText(`Whitelisting CLIENT IP ${ip} successful`);
            } else {
              logger.error(`Whitelisting CLIENT's IP ${ip} was NOT successful`);
            }
          } catch (error) {
            if (error.name === "MongoError" && error.code !== 11000) {
              logger.error(
                `🐛🐛 MongoError -- createClient -- ${stringify(error)}`,
              );
            } else if (error.code === 11000) {
              logger.error(
                `Duplicate key error for IP ${ip} when creating a new CLIENT`,
              );
            }
          }
          return responseFromCreateClient;
        } else if (ip_addresses && ip_addresses.length > 0) {
          const responses = await Promise.all(
            ip_addresses.map(async (ip) => {
              try {
                const result = await WhitelistedIPModel(tenant).updateOne(
                  { ip },
                  { ip },
                  {
                    upsert: true,
                  },
                );

                return {
                  ip,
                  success: result.ok === 1,
                  message:
                    result.ok === 1
                      ? `Whitelisting CLIENT IP ${ip} successful`
                      : `Whitelisting CLIENT's IP ${ip} was NOT successful`,
                };
              } catch (error) {
                if (error.name === "MongoError" && error.code !== 11000) {
                  logger.error(
                    `🐛🐛 MongoError -- whitelisting IP ${ip} -- ${stringify(
                      error,
                    )}`,
                  );
                } else if (error.code === 11000) {
                  logger.error(
                    `Duplicate key error for IP ${ip} when creating a new CLIENT`,
                  );
                }
                return {
                  ip,
                  success: false,
                  message: `Error whitelisting IP ${ip}: ${error.message}`,
                };
              }
            }),
          );

          const successfulResponses = responses
            .filter((response) => response.success)
            .map((response) => response.ip);

          const unsuccessfulResponses = responses
            .filter((response) => !response.success)
            .map((response) => response.ip);

          let finalMessage = "";
          let finalStatus = httpStatus.OK;

          if (
            successfulResponses.length > 0 &&
            unsuccessfulResponses.length > 0
          ) {
            finalMessage = "Some IPs have been whitelisted.";
          } else if (
            successfulResponses.length > 0 &&
            unsuccessfulResponses.length === 0
          ) {
            finalMessage = "All responses were successful.";
          } else if (
            successfulResponses.length === 0 &&
            unsuccessfulResponses.length > 0
          ) {
            finalMessage = "None of the IPs provided were whitelisted.";
            finalStatus = httpStatus.BAD_REQUEST;
          }

          // logObject("finalMessage", finalMessage);
          // logObject("successfulResponses", successfulResponses);
          // logObject("unsuccessfulResponses", unsuccessfulResponses);
          // logObject("finalStatus", finalStatus);

          return responseFromCreateClient;
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
          { message: error.message },
        ),
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
          }),
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
            { message: "unable to complete operation" },
          ),
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
          { message: error.message },
        ),
      );
    }
  },
};

module.exports = client;
