const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const log4js = require("log4js");
const logger = log4js.getLogger("create-event-controller");

const errors = require("../utils/errors");

const { validationResult } = require("express-validator");
const isEmpty = require("is-empty");
const createEventUtil = require("../utils/create-event");
createDeviceUtil = require("../utils/create-device");

const { Kafka } = require("kafkajs");
const { SchemaRegistry } = require("@kafkajs/confluent-schema-registry");
const constants = require("../config/constants");
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
          logObject("Kafka Raw Measurements consumer", e);
        }
      },
    });
  },
  addValues: async (req, res) => {
    try {
      logText("adding values...");
      const { tenant } = req.query;
      const measurements = req.body;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "server side error , create events - controller",
        error: e.message,
      });
    }
  },
  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
        if (result.success === true) {
          const status = result.status ? result.status : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        }

        if (result.success === false) {
          const status = result.status
            ? result.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors ? result.errors : "";
          res.status(status).json({
            success: false,
            errors,
            message: result.message,
          });
        }
      });
    } catch (error) {
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
      }
      if (responseFromTransformEvents.success === false) {
        const status = responseFromTransformEvents.status
          ? responseFromTransformEvents.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromTransformEvents.errors
          ? responseFromTransformEvents.errors
          : "";
        return res.status(status).json({
          message: responseFromTransformEvents.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  create: async (req, res) => {
    try {
      const { query, body } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromCreateEvents = createEventUtil.create(request);
      if (responseFromCreateEvents.success === true) {
        const status = responseFromCreateEvents.status
          ? responseFromCreateEvents.status
          : HTTPStatus.OK;
        return res
          .status(status)
          .json({ success: true, message: responseFromCreateEvents.message });
      }
      if (responseFromCreateEvents.success === false) {
        const status = responseFromCreateEvents.status
          ? responseFromCreateEvents.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromCreateEvents.errors
          ? responseFromCreateEvents.errors
          : "";
        return res.status(status).json({
          success: false,
          message: responseFromCreateEvents.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  transmitValues: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      logElement("hasErrors ", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      } else {
        return createEventUtil.transmitValues(req, res);
      }
    } catch (error) {
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
      logger.info(`the delete values operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(res, "bad request errors", nestedErrors);
      }
      const { body } = req;
      let request = {};
      request["query"] = { ...req.query, body };
      logger.info(`the request -- ${JSON.stringify(request)}`);
      let responseFromClearValuesOnPlatform = await createEventUtil.clearEventsOnPlatform(
        request
      );
      logger.info(
        `responseFromClearValuesOnPlatform -- ${JSON.stringify(
          responseFromClearValuesOnPlatform
        )}`
      );

      if (responseFromClearValuesOnPlatform.success == false) {
        let error = responseFromClearValuesOnPlatform.error
          ? responseFromClearValuesOnPlatform.error
          : "";
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromClearValuesOnPlatform.message,
          error,
        });
      }

      if (responseFromClearValuesOnPlatform.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromClearValuesOnPlatform.message,
          data: responseFromClearValuesOnPlatform.data,
        });
      }
    } catch (e) {
      logger.error(`responseFromClearValuesOnPlatform -- ${e.message}`);
      errors.tryCatchErrors(
        res,
        e.message,
        "responseFromClearValuesOnPlatform"
      );
    }
  },

  /***********************************************************
   * api_v2 starts
   */
  addEvents: async (req, res) => {
    try {
      logger.info(`adding values...`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      logger.info(`adding values...`);
      const { device, tenant } = req.query;
      const { body } = req;

      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["tenant"] = tenant;
      request["body"] = body;

      let responseFromAddEventsUtil = await createEventUtil.addEvents(request);

      logObject("responseFromAddEventsUtil", responseFromAddEventsUtil);

      logger.info(
        `responseFromAddEventsUtil -- ${JSON.stringify(
          responseFromAddEventsUtil
        )}`
      );

      if (!responseFromAddEventsUtil.success) {
        let errors = responseFromAddEventsUtil.error
          ? responseFromAddEventsUtil.error
          : "";
        return res.status(HTTPStatus.FORBIDDEN).json({
          success: false,
          message: "finished the operation with some errors",
          errors,
        });
      }

      if (responseFromAddEventsUtil.success) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: "successfully added all the events",
          stored_events: responseFromAddEventsUtil.data,
        });
      }
    } catch (e) {
      logger.error(`addValue -- ${e.message}`);
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "server error",
        error: e.message,
      });
    }
  },
  viewEvents: async (req, res) => {
    try {
      logger.info(`viewing events...`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let responseFromEventsUtil = await createEventUtil.viewEvents(req);
      logObject("responseFromEventsUtil", responseFromEventsUtil);
      logger.info(
        `responseFromEventsUtil -- ${JSON.stringify(responseFromEventsUtil)}`
      );
      if (responseFromEventsUtil.success === true) {
        res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromEventsUtil.message,
          measurements: responseFromEventsUtil.data,
        });
      }

      if (responseFromEventsUtil.success === false) {
        let error = responseFromEventsUtil.error
          ? responseFromEventsUtil.error
          : "";
        res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromEventsUtil.message,
          error,
        });
      }
    } catch (error) {
      logger.error(`viewEvents -- ${error.message}`);
      res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "server error",
        error: error.message,
      });
    }
  },

  /************************************************************
   * api_v2 ends
   */
};

module.exports = createEvent;
