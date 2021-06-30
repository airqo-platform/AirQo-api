const constants = require("../config/constants");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logText, logElement } = require("./log");
const EventSchema = require("../models/Event");
const HTTPStatus = require("http-status");
const componentSchema = require("../models/Component");

const insert = async (tenant, transformedMeasurements) => {
  let nAdded = 0;
  let eventsAdded = [];
  let eventsRejected = [];
  let errors = [];

  for (const measurement of transformedMeasurements) {
    try {
      console.log("the measurement: ", measurement);
      const eventBody = {
        day: measurement.day,
        nValues: { $lt: constants.N_VALUES },
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
        $addToSet: { values: measurement },
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
      if (addedEvents) {
        nAdded += 1;
        eventsAdded.push(measurement);
      } else if (!addedEvents) {
        eventsRejected.push(measurement);
        errors.push("unable to add the events ");
      } else {
        eventsRejected.push(measurement);
        errors.push("unable to add the events ");
      }
    } catch (e) {
      eventsRejected.push(measurement);
      errors.push(e.message);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: "finished the operation with some errors",
      errors: errors,
      valuesRejected: eventsRejected,
      valuesAdded: eventsAdded,
    };
  } else {
    return {
      success: true,
      message: "successfully added all the events",
      valuesAdded: eventsAdded,
    };
  }
};

module.exports = insert;
