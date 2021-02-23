const constants = require("../config/constants");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logText, logElement } = require("./log");
const EventSchema = require("../models/Event");
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
          message: "successfully added these events",
          values: transformedMeasurements,
        });
      } else if (!addedEvents) {
        logText("unable to add the events ");
        unclearError(res);
      } else {
        logText("just unable to add events");
        unclearError(res);
      }
    } catch (e) {
      logElement("there is an error: ", e.message);
      tryCatchErrors(res, e);
    }
  });
};

module.exports = insert;
