/***
 * I will use this script to insert measurements from
 * the respective Kafka topic ----using the create-event util
 * for creating a new event
 *
 *
 */

const constants = require("../config/constants");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logText, logElement } = require("./log");
const log4js = require("log4js");
const logger = log4js.getLogger("insert-measurements-util");
const EventModel = require("../models/Event");
// const { kafkaConsumer, kafka, kafkaClient, kafkaProducer } = require("../config/kafka-node");
// const { kafkaConsumer, kafkaProducer } = require("../config/kafkajs");
// topic: "hourly-measurements-topic",

const insert = async (tenant, transformedMeasurements) => {
  let nAdded = 0;
  let eventsAdded = [];
  let eventsRejected = [];
  let errors = [];

  // logObject("the transformed measurements received", transformedMeasurements);

  for (const measurement of transformedMeasurements) {
    try {
      // logObject("the measurement in the insertion process", measurement);
      const eventsFilter = {
        day: measurement.day,
        site_id: measurement.site_id,
        device_id: measurement.device_id,
        nValues: { $lt: parseInt(constants.N_VALUES) },
        $or: [
          { "values.time": { $ne: measurement.time } },
          { "values.device": { $ne: measurement.device } },
          { "values.frequency": { $ne: measurement.frequency } },
          { "values.device_id": { $ne: measurement.device_id } },
          { "values.site_id": { $ne: measurement.site_id } },
          { day: { $ne: measurement.day } },
        ],
      };
      let someDeviceDetails = {};
      someDeviceDetails["device_id"] = measurement.device_id;
      someDeviceDetails["site_id"] = measurement.site_id;
      logObject("someDeviceDetails", someDeviceDetails);

      // logObject("measurement", measurement);

      const eventsUpdate = {
        $push: { values: measurement },
        $min: { first: measurement.time },
        $max: { last: measurement.time },
        $inc: { nValues: 1 },
      };

      const addedEvents = await EventModel(tenant).updateOne(
        eventsFilter,
        eventsUpdate,
        {
          upsert: true,
        }
      );
      logObject("addedEvents", addedEvents);
      if (addedEvents) {
        nAdded += 1;
        eventsAdded.push(measurement);
        // const payloads = [
        //   {
        //     topic: "events",
        //     messages: { action: "create", event: measurement },
        //     timestamp: Date.now(),
        //   },
        // ];
        // kafkaProducer.send(payloads, (err, data) => {
        //   logObject("Kafka producer data", data);
        //   logger.info(`Kafka producer data, ${data}`);
        //   logObject("Kafka producer error", err);
        //   logger.error(`Kafka producer error, ${err}`);
        // });
      } else if (!addedEvents) {
        eventsRejected.push(measurement);
        let errMsg = {
          msg: "unable to add the events",
          record: {
            ...(measurement.device ? { device: measurement.device } : {}),
            ...(measurement.frequency
              ? { frequency: measurement.frequency }
              : {}),
            ...(measurement.time ? { time: measurement.time } : {}),
            ...(measurement.device_id
              ? { device_id: measurement.device_id }
              : {}),
            ...(measurement.site_id ? { site_id: measurement.site_id } : {}),
          },
        };
        errors.push(errMsg);
      } else {
        eventsRejected.push(measurement);
        let errMsg = {
          msg: "unable to add the events",
          record: {
            ...(measurement.device ? { device: measurement.device } : {}),
            ...(measurement.frequency
              ? { frequency: measurement.frequency }
              : {}),
            ...(measurement.time ? { time: measurement.time } : {}),
            ...(measurement.device_id
              ? { device_id: measurement.device_id }
              : {}),
            ...(measurement.site_id ? { site_id: measurement.site_id } : {}),
          },
        };
        errors.push(errMsg);
      }
    } catch (e) {
      logObject("the detailed duplicate error", e);
      eventsRejected.push(measurement);
      let errMsg = {
        msg: "duplicate record",
        record: {
          ...(measurement.device ? { device: measurement.device } : {}),
          ...(measurement.frequency
            ? { frequency: measurement.frequency }
            : {}),
          ...(measurement.time ? { time: measurement.time } : {}),
          ...(measurement.device_id
            ? { device_id: measurement.device_id }
            : {}),
          ...(measurement.site_id ? { site_id: measurement.site_id } : {}),
        },
      };
      errors.push(errMsg);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: "finished the operation with some errors",
      errors: errors,
    };
  } else {
    return {
      success: true,
      message: "successfully added all the events",
    };
  }
};

module.exports = insert;
