const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const EventSchema = require("../models/Event");
const { getModelByTenant } = require("./multitenancy");

const createEventsOnPlatform = async (tenant, transformedMeasurements) => {
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

const createOneSensorEventOnThingSpeak = async (req, res) => {
  try {
    const { quantity_kind, value } = req.body;
    const { tenant } = req.query;
    const deviceDetail = await getDetailsOnPlatform(req, res);
    const api_key = deviceDetail[0]._doc.writeKey;

    if (tenant && quantity_kind && value) {
      await axios
        .get(
          constants.ADD_VALUE(
            writeToThingMappings(quantity_kind),
            value,
            api_key
          )
        )
        .then(function(response) {
          let resp = {};
          resp.channel_id = response.data.channel_id;
          resp.created_at = response.data.created_at;
          resp.entry_id = response.data.entry_id;
          res.status(httpStatus.OK).json({
            message: "successfully transmitted the data",
            success: true,
            data: resp,
          });
        })
        .catch(function(error) {
          axiosError(error, req, res);
        });
    } else {
      missingQueryParams(req, res);
    }
  } catch (e) {
    tryCatchErrors(res, error);
  }
};

const createDeviceEventsOnThingSpeak = async (req, res) => {
  try {
    logText("write to thing json.......");
    let { tenant } = req.query;
    const requestBody = transmitMeasurementsRequestBody(req);
    const deviceDetail = await getDetailsOnPlatform(req, res);
    const api_key = deviceDetail[0]._doc.writeKey;
    requestBody.api_key = api_key;

    if (tenant) {
      await axios
        .post(constants.ADD_VALUE_JSON, requestBody)
        .then(function(response) {
          let resp = {};
          resp.channel_id = response.data.channel_id;
          resp.created_at = response.data.created_at;
          resp.entry_id = response.data.entry_id;
          res.status(HTTPStatus.OK).json({
            message: "successfully transmitted the data",
            success: true,
            update: resp,
          });
        })
        .catch(function(error) {
          logElement("the error", error.message);
          axiosError(error, req, res);
        });
    } else {
      missingQueryParams(req, res);
    }
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

const createMultipleDeviceEventsOnThingSpeak = async (req, res) => {
  try {
    logText("bulk write to thing.......");
    let { tenant, type } = req.query;
    let { updates } = req.body;
    const deviceDetail = await getDetailsOnPlatform(req, res);
    const channel = deviceDetail[0]._doc.channelID;
    const api_key = deviceDetail[0]._doc.writeKey;
    if (updates && tenant && type) {
      let transformedUpdates = await transformMeasurementFields(updates);
      let requestObject = {};
      requestObject.write_api_key = api_key;
      requestObject.updates = transformedUpdates;
      await axios
        .post(constants.BULK_ADD_VALUES_JSON(channel), requestObject)
        .then(function(response) {
          console.log(response.data);
          let output = response.data;
          res.status(HTTPStatus.OK).json({
            message: "successfully transmitted the data",
            success: true,
            data: output,
          });
        })
        .catch(function(error) {
          axiosError(error, req, res);
        });
    } else {
      missingQueryParams(req, res);
    }
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

module.exports = {
  createEventsOnPlatform,
  createOneSensorEventOnThingSpeak,
  createDeviceEventsOnThingSpeak,
  createMultipleDeviceEventsOnThingSpeak,
};
