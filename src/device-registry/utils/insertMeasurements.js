const constants = require("../config/constants");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logText, logElement } = require("./log");
const EventSchema = require("../models/Event");

const insert = (tenant, transformedMeasurements) => {
  transformedMeasurements.forEach(async (measurement) => {
    try {
      const eventBody = {
        day: measurement.day,
        nValues: { $lt: constants.N_VALUES },
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
      ).updateMany(eventBody, options, {
        upsert: true,
      });
      if (addedEvents) {
        logText("the events have successfully been added");
      } else if (!addedEvents) {
        logText("unable to add the events ");
      } else {
        logText("just unable to add events");
      }
    } catch (e) {
      logElement("there is an error: ", e.message);
    }
  });
};

module.exports = insert;
