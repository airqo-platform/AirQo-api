const SimModel = require("@models/Sim");
const constants = require("@config/constants");
const { logObject, logElement, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const generateFilter = require("@utils/generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-sim-util`);
const axios = require("axios");
const xml2js = require("xml2js");
const thingsMobile = require("@config/things-mobile");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const convertFromBytesToMegaBytes = (bytes) => {
  return bytes / (1000 * 1000);
};

const createSim = {
  create: async (request) => {},
  createLocal: async (request) => {
    try {
      const { body } = request;
      const { tenant } = request.query;
      logObject("body", body);
      return await SimModel(tenant)
        .create(body)
        .then((createdSim) => {
          logObject("createdSim", createdSim);
          return {
            success: true,
            message: "successfully created SIM",
            data: createdSim,
            status: httpStatus.OK,
          };
        })
        .catch((error) => {
          logObject("error", error);
          return {
            success: false,
            message: "Internal Server Error",
            errors: { message: error.message },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        });
    } catch (error) {
      logElement(" the util server error,", error.message);
      logger.error(
        `Internal Server Error --- createLocal ---  ${JSON.stringify(error)}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  createBulkLocal: async (request) => {
    try {
      const { sims } = request.body;
      const { tenant } = request.query;
      const batchSize = 10;
      const simCreationResults = [];
      for (let i = 0; i < sims.length; i += batchSize) {
        const batch = sims.slice(i, i + batchSize);

        const batchPromises = batch.map((simData) => {
          return SimModel(tenant)
            .create({ msisdn: simData })
            .then((createdSim) => {
              return {
                success: true,
                message: "Successfully created SIM",
                data: createdSim,
              };
            })
            .catch((error) => {
              return {
                success: false,
                message: "Error creating SIM",
                errors: { message: error.message },
              };
            });
        });
        const batchResults = await Promise.all(batchPromises);
        simCreationResults.push(...batchResults);
      }

      const successfulSimCreations = simCreationResults.filter(
        (result) => result.success
      );

      const failedSimCreations = simCreationResults.filter(
        (result) => !result.success
      );

      let message = "All SIM cards created successfully";

      if (
        failedSimCreations.length > 0 &&
        failedSimCreations.length < sims.length
      ) {
        message = "Some SIM cards created successfully";
      } else if (failedSimCreations.length === sims.length) {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message: "All SIM cards failed to create",
            failedSimCreations,
          },
        };
      }

      return {
        success: true,
        message,
        status: httpStatus.OK,
        data: successfulSimCreations,
        failedCreations: failedSimCreations,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(
        `Internal Server Error --- createBulkLocal ---  ${JSON.stringify(
          error
        )}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  listLocal: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const { limit, skip } = query;

      logObject("limit", limit);
      logObject("skip", skip);

      const filter = generateFilter.sims(request);
      logObject("filter", filter);
      if (filter.success && filter.success === false) {
        return filter;
      }

      const responseFromListSim = await SimModel(tenant).list({
        filter,
        limit,
        skip,
      });

      return responseFromListSim;
    } catch (error) {
      logElement("list Sims util", error.message);
      logger.error(
        `Internal Server Error --- listLocal ---  ${JSON.stringify(error)}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteLocal: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.sims(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      const responseFromRemoveSim = await SimModel(tenant).remove({
        filter,
      });
      return responseFromRemoveSim;
    } catch (error) {
      logElement("delete Sim util", error.message);
      logger.error(
        `Internal Server Error --- deleteLocal ---  ${JSON.stringify(error)}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateLocal: async (request) => {
    try {
      const { query } = request;
      const { body } = request;
      const { tenant } = query;

      let update = body;
      const filter = generateFilter.sims(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      delete update.msisdn;
      delete update.balance;
      delete update.activationDate;
      delete update.name;
      delete update.status;
      delete update.plan;
      delete update.totalTraffic;
      delete update.simBarcode;
      delete update.active;
      const responseFromModifySim = await SimModel(tenant).modify({
        filter,
        update,
      });

      return responseFromModifySim;
    } catch (error) {
      logElement("update Sims util", error.message);
      logger.error(
        `Internal Server Error --- updateLocal ---  ${JSON.stringify(error)}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  checkStatus: async (request) => {
    try {
      const { tenant } = request.query;
      const { sim_id } = request.params;
      const sim = await SimModel(tenant).findById(ObjectId(sim_id)).lean();
      logObject("the sim", sim);
      if (isEmpty(sim)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `${sim_id} provided does not exist` },
          status: httpStatus.BAD_REQUEST,
        };
      }
      if (
        isEmpty(constants.THINGS_MOBILE_BASE_URL) ||
        isEmpty(constants.THINGS_MOBILE_STATUS_URL)
      ) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: {
            message:
              "unable to retrieve the respective URLs required for operation",
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      const postUrl = `${constants.THINGS_MOBILE_BASE_URL}/${constants.THINGS_MOBILE_STATUS_URL}`;
      logObject("the postUrl", postUrl);
      const formData = {
        ...thingsMobile,
        msisdn: sim.msisdn,
      };

      logObject("formData", formData);

      const options = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };

      return await axios
        .post(postUrl, formData, options)
        .then(async (response) => {
          logObject("the response from the EXT sytem", response);
          const xmlResponse = response.data;

          const parsedResponse = await xml2js.parseStringPromise(xmlResponse, {
            explicitArray: false,
            mergeAttrs: true,
          });

          logObject("parsedResponse", parsedResponse);

          if (isEmpty(parsedResponse.result)) {
            return {
              success: false,
              message: "Internal Server Error",
              errors: { message: "Response from EXT system is undefined" },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          } else if (
            parsedResponse.result.done === "true" &&
            parsedResponse.result.sims
          ) {
            const simInfo = parsedResponse.result.sims.sim;

            logObject("simInfo", simInfo);

            const jsonOutput = {
              balance: convertFromBytesToMegaBytes(simInfo.balance),
              activationDate: simInfo.activationDate,
              msisdn: simInfo.msisdn,
              name: simInfo.name,
              status: simInfo.status,
              plan: simInfo.plan,
              totalTraffic: simInfo.totalTraffic,
            };

            logObject("jsonOutput", jsonOutput);

            const updatedSim = await SimModel(tenant)
              .findByIdAndUpdate(ObjectId(sim_id), jsonOutput, { new: true })
              .select("_id msisdn balance name plan status")
              .lean();

            logObject("updatedSim", updatedSim);
            if (!isEmpty(updatedSim)) {
              return {
                success: true,
                message: "Successfully retrieved the SIM status",
                status: httpStatus.OK,
                data: updatedSim,
              };
            } else {
              return {
                success: false,
                message: "Internal Server Error",
                errors: { message: "unable to update the sim records" },
                status: httpStatus.INTERNAL_SERVER_ERROR,
              };
            }
          } else if (parsedResponse.result.done === "false") {
            return {
              success: false,
              message: "Internal Server Error",
              errors: {
                message: parsedResponse.result.errorMessage
                  ? parsedResponse.result.errorMessage
                  : "",
                code: parsedResponse.result.errorCode
                  ? parsedResponse.result.errorCode
                  : "",
              },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        })
        .catch((error) => {
          logObject("the error inside the checkStatus util", error);
          logger.error(
            `Internal Server Error --- checkStatus --- ${JSON.stringify(error)}`
          );
          return {
            success: false,
            errors: { message: error.message },
            status: httpStatus.INTERNAL_SERVER_ERROR,
            message: "Internal Server Error",
          };
        });
    } catch (error) {
      logObject(" the util server error,", error.message);
      logger.error(
        `Internal Server Error --- checkStatus ---  ${JSON.stringify(error)}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  activateSim: async (request) => {
    try {
      return {
        success: false,
        status: httpStatus.SERVICE_UNAVAILABLE,
        message: "service temporarily unavailable",
        errors: { message: "service temporarily unavailable" },
      };
      const { tenant } = request.query;
      const { sim_id } = req.params;
      const sim = await SimModel(tenant).findById(ObjectId(sim_id)).lean();
      logObject("the sim", sim);
      if (isEmpty(sim)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `${sim_id} provided does not exist` },
          status: httpStatus.BAD_REQUEST,
        };
      }
      if (
        isEmpty(constants.THINGS_MOBILE_BASE_URL) ||
        isEmpty(constants.THINGS_MOBILE_ACTIVATE_URL)
      ) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: {
            message:
              "unable to retrieve the respective URLs required for operation",
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      const postUrl = `${constants.THINGS_MOBILE_BASE_URL}/${constants.THINGS_MOBILE_ACTIVATE_URL}`;
      const formData = {
        ...thingsMobile,
        msisdn: sim.msisdn,
        simBarcode: sim.simBarcode,
      };

      const options = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };

      await axios
        .post(postUrl, new URLSearchParams(formData), options)
        .then(async (response) => {
          const xmlResponse = response.data;

          const parsedResponse = await xml2js.parseStringPromise(xmlResponse, {
            explicitArray: false,
            mergeAttrs: true,
          });
          const { done, errorCode, errorMessage } = parsedResponse.result;
          if (done) {
            return {
              success: true,
              message: "Successfully activated the SIM",
              status: httpStatus.OK,
              data: jsonOutput,
            };
          } else if (!done) {
            return {
              success: false,
              message: "Internal Server Error",
              errors: { message: errorMessage, code: errorCode },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        })
        .catch((error) => {
          logObject("error", error);
          logger.error(
            `Internal Server Error --- activateSim --- ${JSON.stringify(error)}`
          );
          return {
            success: false,
            errors: { message: error.message },
            status: httpStatus.INTERNAL_SERVER_ERROR,
            message: "Internal Server Error",
          };
        });
    } catch (error) {
      logObject(" the util server error,", error.message);
      logger.error(
        `Internal Server Error --- activateSim ---  ${JSON.stringify(error)}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  deactivateSim: async (request) => {
    try {
      return {
        success: false,
        status: httpStatus.SERVICE_UNAVAILABLE,
        message: "service temporarily unavailable",
        errors: { message: "service temporarily unavailable" },
      };
      s;
      const { tenant } = request.query;
      const { sim_id } = req.params;
      const sim = await SimModel(tenant).findById(ObjectId(sim_id)).lean();
      logObject("the sim", sim);
      if (isEmpty(sim)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `${sim_id} provided does not exist` },
          status: httpStatus.BAD_REQUEST,
        };
      }
      if (
        isEmpty(constants.THINGS_MOBILE_BASE_URL) ||
        isEmpty(constants.THINGS_MOBILE_DEACTIVATE_URL)
      ) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: {
            message:
              "unable to retrieve the respective URLs required for operation",
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      const postUrl = `${constants.THINGS_MOBILE_BASE_URL}/${constants.THINGS_MOBILE_DEACTIVATE_URL}`;
      const formData = {
        ...thingsMobile,
        msisdn: sim.msisdn,
      };

      const options = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };

      return await axios
        .post(postUrl, new URLSearchParams(formData), options)
        .then(async (response) => {
          const xmlResponse = response.data;

          const parsedResponse = await xml2js.parseStringPromise(xmlResponse, {
            explicitArray: false,
            mergeAttrs: true,
          });
          const { done, errorCode, errorMessage } = parsedResponse.result;

          if (done) {
            return {
              success: true,
              message: "Successfully deactivated the SIM",
              status: httpStatus.OK,
              data: jsonOutput,
            };
          } else if (!done) {
            return {
              success: false,
              message: "Unable to deactivate the sim",
              errors: { message: errorMessage, code: errorCode },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        })
        .catch((error) => {
          logObject("error", error);
          logger.error(
            `Internal Server Error --- deactivateSim --- ${JSON.stringify(
              error
            )}`
          );
          return {
            success: false,
            errors: { message: JSON.stringify(error) },
            status: httpStatus.INTERNAL_SERVER_ERROR,
            message: "Internal Server Error",
          };
        });
    } catch (error) {
      logObject(" the util server error,", error.message);
      logger.error(
        `Internal Server Error --- deactivateSim ---  ${JSON.stringify(error)}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  updateSimName: async (request) => {
    try {
      return {
        success: false,
        status: httpStatus.SERVICE_UNAVAILABLE,
        message: "service temporarily unavailable",
        errors: { message: "service temporarily unavailable" },
      };
      const { tenant } = request.query;
      const { name } = request.body;
      const { sim_id } = req.params;
      const sim = await SimModel(tenant).findById(ObjectId(sim_id)).lean();
      logObject("the sim", sim);
      if (isEmpty(sim)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `${sim_id} provided does not exist` },
          status: httpStatus.BAD_REQUEST,
        };
      }
      if (
        isEmpty(constants.THINGS_MOBILE_BASE_URL) ||
        isEmpty(constants.THINGS_MOBILE_UPDATE_SIM_NAME_URL)
      ) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: {
            message:
              "unable to retrieve the respective URLs required for operation",
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      const postUrl = `${constants.THINGS_MOBILE_BASE_URL}/${constants.THINGS_MOBILE_UPDATE_SIM_NAME_URL}`;
      const formData = {
        ...thingsMobile,
        msisdn: sim.msisdn,
        name,
      };

      const options = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };

      return await axios
        .post(postUrl, new URLSearchParams(formData), options)
        .then(async (response) => {
          const xmlResponse = response.data;

          const parsedResponse = await xml2js.parseStringPromise(xmlResponse, {
            explicitArray: false,
            mergeAttrs: true,
          });
          const { done, errorCode, errorMessage } = parsedResponse.result;

          if (done) {
            return {
              success: true,
              message: "Successfully updated the sim name",
              status: httpStatus.OK,
              data: jsonOutput,
            };
          } else if (!done) {
            return {
              success: false,
              message: "Unable to update the sin name",
              errors: { message: errorMessage, code: errorCode },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        })
        .catch((error) => {
          logObject("error", error);
          logger.error(
            `Internal Server Error --- updateSimName --- ${JSON.stringify(
              error
            )}`
          );
          return {
            success: false,
            errors: { message: JSON.stringify(error) },
            status: httpStatus.INTERNAL_SERVER_ERROR,
            message: "Internal Server Error",
          };
        });
    } catch (error) {
      logObject(" the util server error,", error.message);
      logger.error(
        `Internal Server Error --- updateSimName ---  ${JSON.stringify(error)}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  rechargeSim: async (request) => {
    try {
      return {
        success: false,
        status: httpStatus.SERVICE_UNAVAILABLE,
        message: "service temporarily unavailable",
        errors: { message: "service temporarily unavailable" },
      };
      const { tenant } = request.query;
      const { amount } = request.body;
      const { sim_id } = req.params;
      const sim = await SimModel(tenant).findById(ObjectId(sim_id)).lean();
      logObject("the sim", sim);
      if (isEmpty(sim)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `${sim_id} provided does not exist` },
          status: httpStatus.BAD_REQUEST,
        };
      }
      if (
        isEmpty(constants.THINGS_MOBILE_BASE_URL) ||
        isEmpty(constants.THINGS_MOBILE_RECHARGE_URL)
      ) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: {
            message:
              "unable to retrieve the respective URLs required for operation",
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      const postUrl = `${constants.THINGS_MOBILE_BASE_URL}/${constants.THINGS_MOBILE_RECHARGE_URL}`;
      const formData = {
        ...thingsMobile,
        msisdn: sim.msisdn,
        amount,
      };

      const options = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };

      return await axios
        .post(postUrl, new URLSearchParams(formData), options)
        .then(async (response) => {
          const xmlResponse = response.data;

          const parsedResponse = await xml2js.parseStringPromise(xmlResponse, {
            explicitArray: false,
            mergeAttrs: true,
          });
          const { done, errorCode, errorMessage } = parsedResponse.result;

          if (done) {
            return {
              success: true,
              message: "Successfully updated the sim name",
              status: httpStatus.OK,
              data: jsonOutput,
            };
          } else if (!done) {
            return {
              success: false,
              message: "Unable to update the sin name",
              errors: { message: errorMessage, code: errorCode },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        })
        .catch((error) => {
          logObject("error", error);
          logger.error(
            `Internal Server Error --- rechargeSim --- ${JSON.stringify(error)}`
          );
          return {
            success: false,
            errors: { message: JSON.stringify(error) },
            status: httpStatus.INTERNAL_SERVER_ERROR,
            message: "Internal Server Error",
          };
        });
    } catch (error) {
      logObject(" the util server error,", error.message);
      logger.error(
        `Internal Server Error --- rechargeSim ---  ${JSON.stringify(error)}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
};

module.exports = createSim;
