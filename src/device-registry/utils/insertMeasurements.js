const constants = require("../config/constants");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logText, logElement } = require("./log");
const EventSchema = require("../models/Event");
const HTTPStatus = require("http-status");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
  unclearError,
} = require("./errors");

const insert = (res, tenant, transformedMeasurements) => {
  const errors = [];
  transformedMeasurements.forEach(async (measurement) => {
    try {
      const eventBody = {
        "values.time": { $ne: measurement.time },
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
      ).updateOne(eventBody, options, {
        upsert: true,
      });
      if (addedEvents) {
        logText("the events have successfully been added");
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: "successfully added the event(s)",
          nAdded: addedEvents.nModified,
        });
      } else if (!addedEvents) {
        logText("unable to add the events ");
      } else {
        logText("just unable to add events");
      }
    } catch (e) {
      logElement("there is an error: ", e.message);
      tryCatchErrors(res, e);
    }
  });
};

module.exports = insert;
