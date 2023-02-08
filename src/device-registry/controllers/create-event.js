const HTTPStatus = require("http-status");
const constants = require("@config/constants");
const { logObject, logText, logElement } = require("@utils/log");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-event-controller`
);

const errors = require("@utils/errors");

const { validationResult } = require("express-validator");
const isEmpty = require("is-empty");
const createEventUtil = require("@utils/create-event");
createDeviceUtil = require("@utils/create-device");

const { Kafka } = require("kafkajs");
const { SchemaRegistry } = require("@kafkajs/confluent-schema-registry");

const SCHEMA_REGISTRY = constants.SCHEMA_REGISTRY;
const BOOTSTRAP_SERVERS = constants.KAFKA_BOOTSTRAP_SERVERS;
const RAW_MEASUREMENTS_TOPICS = constants.KAFKA_RAW_MEASUREMENTS_TOPICS;
const KAFKA_CLIENT_ID = constants.KAFKA_CLIENT_ID;
const KAFKA_CLIENT_GROUP = constants.KAFKA_CLIENT_GROUP;

const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: [BOOTSTRAP_SERVERS],
});
const registry = new SchemaRegistry({ host: SCHEMA_REGISTRY });
const consumer = kafka.consumer({ groupId: KAFKA_CLIENT_GROUP });

const createEvent = {
  rawMeasurementsConsumer: async () => {
    await consumer.connect();

    const topics = RAW_MEASUREMENTS_TOPICS.split(",");

    for (const topic of topics) {
      await consumer.subscribe({
        topic: topic.trim().toLowerCase(),
        fromBeginning: true,
      });
    }

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const decodedValue = await registry.decode(message.value);
          const measurements = decodedValue.measurements;
          // insertMeasurtements.addValuesArray(measurements);
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
      },
    });
  },
  consume: async (req, res) => {
    try {
      const responseFromConsumeMeasurements = await createEventUtil.consume();
      if (responseFromConsumeMeasurements.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromConsumeMeasurements.message,
          response: responseFromConsumeMeasurements.data,
        });
      } else {
        return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: responseFromConsumeMeasurements.message,
          errors: responseFromConsumeMeasurements.errors
            ? responseFromConsumeMeasurements.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  addValues: async (req, res) => {
    try {
      logText("adding values...");
      const { tenant } = req.query;
      const measurements = req.body;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let response = await createEventUtil.insert(tenant, measurements);

      if (!response.success) {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "finished the operation with some errors",
          errors: response.errors,
        });
      } else {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: "successfully added all the events",
        });
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "server side error , create events - controller",
        errors: { message: e.message },
      });
    }
  },

  listFromBigQuery: async (req, res) => {
    try {
      const { query } = req;
      const { format } = query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const responseFromListFromBigQuery = await createEventUtil.getMeasurementsFromBigQuery(
        req
      );
      if (responseFromListFromBigQuery.success === true) {
        const status = responseFromListFromBigQuery.status
          ? responseFromListFromBigQuery.status
          : HTTPStatus.OK;
        if (format && format === "csv") {
          return res
            .status(status)
            .set({
              "Content-Type": "text/csv",
              "Content-Disposition": `attachment; filename="airqo-data-export.csv"`,
            })
            .type("text/csv")
            .send(responseFromListFromBigQuery.data);
        }
        return res.status(status).json({
          success: true,
          measurements: responseFromListFromBigQuery.data,
          message: "successfully retrieved the measurements",
        });
      } else if (responseFromListFromBigQuery.success === false) {
        const status = responseFromListFromBigQuery.status
          ? responseFromListFromBigQuery.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListFromBigQuery.message,
          errors: responseFromListFromBigQuery.errors
            ? responseFromListFromBigQuery.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  latestFromBigQuery: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      const { query } = req;
      const {
        device,
        device_number,
        site,
        frequency,
        startTime,
        endTime,
        device_id,
        site_id,
        external,
        metadata,
        tenant,
        recent,
        skip,
        limit,
        page,
      } = query;
      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["device_number"] = device_number;
      request["query"]["site"] = site;
      request["query"]["frequency"] = frequency;
      request["query"]["startTime"] = startTime;
      request["query"]["endTime"] = endTime;
      request["query"]["device_id"] = device_id;
      request["query"]["site_id"] = site_id;
      request["query"]["external"] = external;
      request["query"]["metadata"] = metadata;
      request["query"]["tenant"] = tenant;
      request["query"]["recent"] = recent;
      request["query"]["skip"] = parseInt(skip);
      request["query"]["limit"] = parseInt(limit);
      request["query"]["page"] = parseInt(page);

      await createEventUtil.list(request, (result) => {
        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          logElement("we have gotten some challenges", result);
          const status = result.status
            ? result.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            errors: result.errors ? result.errors : { message: "" },
            message: result.message,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      const {
        device,
        device_number,
        site,
        frequency,
        startTime,
        endTime,
        device_id,
        site_id,
        external,
        metadata,
        tenant,
        network,
        recent,
        airqloud,
        airqloud_id,
        skip,
        limit,
        page,
        lat_long,
      } = query;
      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["device_number"] = device_number;
      request["query"]["site"] = site;
      request["query"]["frequency"] = frequency;
      request["query"]["startTime"] = startTime;
      request["query"]["endTime"] = endTime;
      request["query"]["device_id"] = device_id;
      request["query"]["site_id"] = site_id;
      request["query"]["airqloud_id"] = airqloud_id;
      request["query"]["airqloud"] = airqloud;
      request["query"]["external"] = external;
      request["query"]["metadata"] = metadata;
      request["query"]["tenant"] = tenant;
      request["query"]["network"] = network;
      request["query"]["recent"] = recent;
      request["query"]["lat_long"] = lat_long;
      request["query"]["skip"] = parseInt(skip);
      request["query"]["limit"] = parseInt(limit);
      request["query"]["page"] = parseInt(page);

      await createEventUtil.list(request, (result) => {
        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            errors: result.errors ? result.errors : { message: "" },
            message: result.message,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listGood: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      const {
        device,
        device_number,
        site,
        frequency,
        startTime,
        endTime,
        device_id,
        site_id,
        external,
        metadata,
        tenant,
        network,
        recent,
        airqloud,
        airqloud_id,
        skip,
        limit,
        page,
        lat_long,
      } = query;
      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["device_number"] = device_number;
      request["query"]["site"] = site;
      request["query"]["frequency"] = frequency;
      request["query"]["startTime"] = startTime;
      request["query"]["endTime"] = endTime;
      request["query"]["device_id"] = device_id;
      request["query"]["site_id"] = site_id;
      request["query"]["airqloud_id"] = airqloud_id;
      request["query"]["airqloud"] = airqloud;
      request["query"]["external"] = external;
      request["query"]["metadata"] = metadata;
      request["query"]["tenant"] = tenant;
      request["query"]["index"] = "good";
      request["query"]["external"] = "no";
      request["query"]["metadata"] = "site_id";
      request["query"]["network"] = network;
      request["query"]["recent"] = recent;
      request["query"]["lat_long"] = lat_long;
      request["query"]["skip"] = parseInt(skip);
      request["query"]["limit"] = parseInt(limit);
      request["query"]["page"] = parseInt(page);

      await createEventUtil.list(request, (result) => {
        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors ? result.errors : { message: "" };
          res.status(status).json({
            success: false,
            errors,
            message: result.message,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listModerate: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      const {
        device,
        device_number,
        site,
        frequency,
        startTime,
        endTime,
        device_id,
        site_id,
        external,
        metadata,
        tenant,
        network,
        recent,
        airqloud,
        airqloud_id,
        skip,
        limit,
        page,
        lat_long,
      } = query;
      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["device_number"] = device_number;
      request["query"]["site"] = site;
      request["query"]["frequency"] = frequency;
      request["query"]["startTime"] = startTime;
      request["query"]["endTime"] = endTime;
      request["query"]["device_id"] = device_id;
      request["query"]["site_id"] = site_id;
      request["query"]["airqloud_id"] = airqloud_id;
      request["query"]["airqloud"] = airqloud;
      request["query"]["external"] = external;
      request["query"]["metadata"] = metadata;
      request["query"]["tenant"] = tenant;
      request["query"]["index"] = "moderate";
      request["query"]["external"] = "no";
      request["query"]["metadata"] = "site_id";
      request["query"]["network"] = network;
      request["query"]["recent"] = recent;
      request["query"]["lat_long"] = lat_long;
      request["query"]["skip"] = parseInt(skip);
      request["query"]["limit"] = parseInt(limit);
      request["query"]["page"] = parseInt(page);

      await createEventUtil.list(request, (result) => {
        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors ? result.errors : { message: "" };
          res.status(status).json({
            success: false,
            errors,
            message: result.message,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listU4sg: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      const {
        device,
        device_number,
        site,
        frequency,
        startTime,
        endTime,
        device_id,
        site_id,
        external,
        metadata,
        tenant,
        network,
        recent,
        airqloud,
        airqloud_id,
        skip,
        limit,
        page,
        lat_long,
      } = query;
      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["device_number"] = device_number;
      request["query"]["site"] = site;
      request["query"]["frequency"] = frequency;
      request["query"]["startTime"] = startTime;
      request["query"]["endTime"] = endTime;
      request["query"]["device_id"] = device_id;
      request["query"]["site_id"] = site_id;
      request["query"]["airqloud_id"] = airqloud_id;
      request["query"]["airqloud"] = airqloud;
      request["query"]["external"] = external;
      request["query"]["metadata"] = metadata;
      request["query"]["tenant"] = tenant;
      request["query"]["index"] = "u4sg";
      request["query"]["external"] = "no";
      request["query"]["metadata"] = "site_id";
      request["query"]["network"] = network;
      request["query"]["recent"] = recent;
      request["query"]["lat_long"] = lat_long;
      request["query"]["skip"] = parseInt(skip);
      request["query"]["limit"] = parseInt(limit);
      request["query"]["page"] = parseInt(page);

      await createEventUtil.list(request, (result) => {
        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors ? result.errors : { message: "" };
          res.status(status).json({
            success: false,
            errors,
            message: result.message,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listUnhealthy: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      const {
        device,
        device_number,
        site,
        frequency,
        startTime,
        endTime,
        device_id,
        site_id,
        external,
        metadata,
        tenant,
        network,
        recent,
        airqloud,
        airqloud_id,
        skip,
        limit,
        page,
        lat_long,
      } = query;
      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["device_number"] = device_number;
      request["query"]["site"] = site;
      request["query"]["frequency"] = frequency;
      request["query"]["startTime"] = startTime;
      request["query"]["endTime"] = endTime;
      request["query"]["device_id"] = device_id;
      request["query"]["site_id"] = site_id;
      request["query"]["airqloud_id"] = airqloud_id;
      request["query"]["airqloud"] = airqloud;
      request["query"]["external"] = external;
      request["query"]["metadata"] = metadata;
      request["query"]["tenant"] = tenant;
      request["query"]["index"] = "unhealthy";
      request["query"]["external"] = "no";
      request["query"]["metadata"] = "site_id";
      request["query"]["network"] = network;
      request["query"]["recent"] = recent;
      request["query"]["lat_long"] = lat_long;
      request["query"]["skip"] = parseInt(skip);
      request["query"]["limit"] = parseInt(limit);
      request["query"]["page"] = parseInt(page);

      await createEventUtil.list(request, (result) => {
        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors ? result.errors : { message: "" };
          res.status(status).json({
            success: false,
            errors,
            message: result.message,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listVeryUnhealthy: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      const {
        device,
        device_number,
        site,
        frequency,
        startTime,
        endTime,
        device_id,
        site_id,
        external,
        metadata,
        tenant,
        network,
        recent,
        airqloud,
        airqloud_id,
        skip,
        limit,
        page,
        lat_long,
      } = query;
      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["device_number"] = device_number;
      request["query"]["site"] = site;
      request["query"]["frequency"] = frequency;
      request["query"]["startTime"] = startTime;
      request["query"]["endTime"] = endTime;
      request["query"]["device_id"] = device_id;
      request["query"]["site_id"] = site_id;
      request["query"]["airqloud_id"] = airqloud_id;
      request["query"]["airqloud"] = airqloud;
      request["query"]["external"] = external;
      request["query"]["metadata"] = metadata;
      request["query"]["tenant"] = tenant;
      request["query"]["index"] = "very_unhealthy";
      request["query"]["external"] = "no";
      request["query"]["metadata"] = "site_id";
      request["query"]["network"] = network;
      request["query"]["recent"] = recent;
      request["query"]["lat_long"] = lat_long;
      request["query"]["skip"] = parseInt(skip);
      request["query"]["limit"] = parseInt(limit);
      request["query"]["page"] = parseInt(page);

      await createEventUtil.list(request, (result) => {
        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors ? result.errors : { message: "" };
          res.status(status).json({
            success: false,
            errors,
            message: result.message,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listHazardous: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      const {
        device,
        device_number,
        site,
        frequency,
        startTime,
        endTime,
        device_id,
        site_id,
        external,
        metadata,
        tenant,
        network,
        recent,
        airqloud,
        airqloud_id,
        skip,
        limit,
        page,
        lat_long,
      } = query;
      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["device_number"] = device_number;
      request["query"]["site"] = site;
      request["query"]["frequency"] = frequency;
      request["query"]["startTime"] = startTime;
      request["query"]["endTime"] = endTime;
      request["query"]["device_id"] = device_id;
      request["query"]["site_id"] = site_id;
      request["query"]["airqloud_id"] = airqloud_id;
      request["query"]["airqloud"] = airqloud;
      request["query"]["external"] = external;
      request["query"]["metadata"] = metadata;
      request["query"]["tenant"] = tenant;
      request["query"]["index"] = "hazardous";
      request["query"]["external"] = "no";
      request["query"]["metadata"] = "site_id";
      request["query"]["network"] = network;
      request["query"]["recent"] = recent;
      request["query"]["lat_long"] = lat_long;
      request["query"]["skip"] = parseInt(skip);
      request["query"]["limit"] = parseInt(limit);
      request["query"]["page"] = parseInt(page);

      await createEventUtil.list(request, (result) => {
        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors ? result.errors : { message: "" };
          res.status(status).json({
            success: false,
            errors,
            message: result.message,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  transform: async (req, res) => {
    try {
      const { query, body } = req;
      let request = {};
      request["query"] = {};
      request["body"] = {};
      request["query"] = query;
      request["body"] = body;

      const responseFromTransformEvents = await createEventUtil.transformManyEvents(
        request
      );

      if (responseFromTransformEvents.success === true) {
        const status = responseFromTransformEvents.status
          ? responseFromTransformEvents.status
          : HTTPStatus.OK;
        return res.status(status).json({
          message: responseFromTransformEvents.message,
          transformedEvents: responseFromTransformEvents.data,
        });
      } else if (responseFromTransformEvents.success === false) {
        const status = responseFromTransformEvents.status
          ? responseFromTransformEvents.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromTransformEvents.message,
          errors: responseFromTransformEvents.errors
            ? responseFromTransformEvents.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  create: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      const { query, body } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromCreateEvents = await createEventUtil.create(request);
      if (responseFromCreateEvents.success === true) {
        const status = responseFromCreateEvents.status
          ? responseFromCreateEvents.status
          : HTTPStatus.OK;
        return res
          .status(status)
          .json({ success: true, message: responseFromCreateEvents.message });
      } else if (responseFromCreateEvents.success === false) {
        const status = responseFromCreateEvents.status
          ? responseFromCreateEvents.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateEvents.message,
          errors: responseFromCreateEvents.errors
            ? responseFromCreateEvents.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  transmitMultipleSensorValues: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      const { body, query } = req;
      const { name, device_number, chid, tenant } = query;

      let request = {};
      request["query"] = {};
      request["query"]["name"] = name;
      request["query"]["tenant"] = tenant;
      request["query"]["device_number"] = chid || device_number;
      request["body"] = body;

      const responseFromTransmitMultipleSensorValues = await createEventUtil.transmitMultipleSensorValues(
        request
      );

      if (responseFromTransmitMultipleSensorValues.success === true) {
        const status = responseFromTransmitMultipleSensorValues.status
          ? responseFromTransmitMultipleSensorValues.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromTransmitMultipleSensorValues.message,
          response: responseFromTransmitMultipleSensorValues.data,
        });
      } else {
        const status = responseFromTransmitMultipleSensorValues.status
          ? responseFromTransmitMultipleSensorValues.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromTransmitMultipleSensorValues.message,
          errors: responseFromTransmitMultipleSensorValues.errors
            ? responseFromTransmitMultipleSensorValues.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  bulkTransmitMultipleSensorValues: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      const { body, query } = req;
      const { name, device_number, chid, tenant } = query;

      let request = {};
      request["query"] = {};
      request["query"]["name"] = name;
      request["query"]["tenant"] = tenant;
      request["query"]["device_number"] = chid || device_number;
      request["body"] = body;

      const responseFromBulkTransmitMultipleSensorValues = await createEventUtil.bulkTransmitMultipleSensorValues(
        request
      );

      if (responseFromBulkTransmitMultipleSensorValues.success === true) {
        const status = responseFromBulkTransmitMultipleSensorValues.status
          ? responseFromBulkTransmitMultipleSensorValues.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromBulkTransmitMultipleSensorValues.message,
        });
      } else {
        const status = responseFromBulkTransmitMultipleSensorValues.status
          ? responseFromBulkTransmitMultipleSensorValues.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromBulkTransmitMultipleSensorValues.message,
          errors: responseFromBulkTransmitMultipleSensorValues.errors
            ? responseFromBulkTransmitMultipleSensorValues.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  transmitValues: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let request = {};
      request["query"] = {};
      request["body"] = {};

      const responseFromTransmitValues = await createEventUtil.transmitValues(
        request
      );

      if (responseFromTransmitValues.success === true) {
        const status = responseFromTransmitValues.status
          ? responseFromTransmitValues.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromTransmitValues.message,
          response: responseFromTransmitValues.data,
        });
      } else {
        const status = responseFromTransmitValues.status
          ? responseFromTransmitValues.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromTransmitValues.message,
          errors: responseFromTransmitValues.errors
            ? responseFromTransmitValues.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  deleteValues: async () => {},
  deleteValuesOnPlatform: async (req, res) => {
    try {
      logText("the delete values operation starts....");
      // logger.info(`the delete values operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(res, "bad request errors", nestedErrors);
      }
      const { body } = req;
      let request = {};
      request["query"] = { ...req.query, body };
      // logger.info(`the request -- ${JSON.stringify(request)}`);
      // let responseFromClearValuesOnPlatform = await createEventUtil.clearEventsOnPlatform(
      //   request
      // );
      // logger.info(
      //   `responseFromClearValuesOnPlatform -- ${JSON.stringify(
      //     responseFromClearValuesOnPlatform
      //   )}`
      // );

      if (responseFromClearValuesOnPlatform.success === false) {
        const status = responseFromClearValuesOnPlatform.status
          ? responseFromClearValuesOnPlatform.status
          : HTTPStatus.BAD_GATEWAY;
        return res.status(status).json({
          success: false,
          message: responseFromClearValuesOnPlatform.message,
          errors: responseFromClearValuesOnPlatform.error
            ? responseFromClearValuesOnPlatform.error
            : { message: "" },
        });
      } else if (responseFromClearValuesOnPlatform.success === true) {
        const status = responseFromClearValuesOnPlatform.status
          ? responseFromClearValuesOnPlatform.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromClearValuesOnPlatform.message,
          data: responseFromClearValuesOnPlatform.data,
        });
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  addEvents: async (req, res) => {
    try {
      // logger.info(`adding values...`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      // logger.info(`adding values...`);
      const { device, tenant } = req.query;
      const { body } = req;

      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["tenant"] = tenant;
      request["body"] = body;

      let responseFromAddEventsUtil = await createEventUtil.addEvents(request);

      logObject("responseFromAddEventsUtil", responseFromAddEventsUtil);

      // logger.info(
      //   `responseFromAddEventsUtil -- ${JSON.stringify(
      //     responseFromAddEventsUtil
      //   )}`
      // );

      if (responseFromAddEventsUtil.success === false) {
        const status = responseFromAddEventsUtil.status
          ? responseFromAddEventsUtil.status
          : HTTPStatus.FORBIDDEN;
        return res.status(status).json({
          success: false,
          message: "finished the operation with some errors",
          errors: responseFromAddEventsUtil.error
            ? responseFromAddEventsUtil.error
            : { message: "" },
        });
      } else if (responseFromAddEventsUtil.success === true) {
        const status = responseFromAddEventsUtil.status
          ? responseFromAddEventsUtil.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully added all the events",
          stored_events: responseFromAddEventsUtil.data,
        });
      }
    } catch (e) {
      logger.error(`addValue -- ${e.message}`);
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "internal server error",
        errors: { message: e.message },
      });
    }
  },
  viewEvents: async (req, res) => {
    try {
      // logger.info(`viewing events...`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let responseFromEventsUtil = await createEventUtil.viewEvents(req);
      logObject("responseFromEventsUtil", responseFromEventsUtil);
      // logger.info(
      //   `responseFromEventsUtil -- ${JSON.stringify(responseFromEventsUtil)}`
      // );
      if (responseFromEventsUtil.success === true) {
        res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromEventsUtil.message,
          measurements: responseFromEventsUtil.data,
        });
      } else if (responseFromEventsUtil.success === false) {
        const status = responseFromEventsUtil.status
          ? responseFromEventsUtil.status
          : HTTPStatus.BAD_GATEWAY;
        res.status(status).json({
          success: false,
          message: responseFromEventsUtil.message,
          errors: responseFromEventsUtil.error
            ? responseFromEventsUtil.error
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "server error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createEvent;
