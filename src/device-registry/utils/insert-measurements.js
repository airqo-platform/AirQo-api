const constants = require("../config/constants");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logText, logElement } = require("./log");
const EventSchema = require("../models/Event");
const { groupMeasurementsBy } = require("./transform-measurements");

const insert = async (tenant, transformedMeasurements) => {
  let nAdded = 0;
  let eventsAdded = [];
  let eventsRejected = [];
  let errors = [];

  logObject("the transformed measurements received", transformedMeasurements);

  for (const measurement of transformedMeasurements) {
    try {
      logObject("the measurement in the insertion process", measurement);
      const eventBody = {
        day: measurement.day,
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
      const options = {
        $push: { values: measurement },
        $min: { first: measurement.time },
        $max: { last: measurement.time },
        $inc: { nValues: 1 },
      };
      const addedEvents = await getModelByTenant(
        tenant.toLowerCase(),
        "event",
        EventSchema
      ).updateOne(eventBody, options, {
        upsert: true,
      });
      logObject("addedEvents", addedEvents);
      if (addedEvents) {
        nAdded += 1;
        eventsAdded.push(measurement);
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

const bulkInsert = async (transformedMeasurements) => {

  const groupByTenant = groupMeasurementsBy('tenant');
  let bulkResponse = [];

  for (const [tenant, measurements] of Object.entries(groupByTenant(transformedMeasurements))) {
    
    const response = await insert(tenant, measurements);
    bulkResponse.push(response);
  }
  
  return bulkResponse;
};

module.exports = { bulkInsert, insert };
