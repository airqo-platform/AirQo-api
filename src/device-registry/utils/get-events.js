const EventSchema = require("models/Event");
const HTTPStatus = require("http-status");
const { getModelByTenant } = require("utils/multitenancy");
const isEmpty = require("is-empty");

const responseDevice = async (res, filter, tenant) => {
  try {
    const events = await getModelByTenant(tenant, "event", EventSchema)
      .find(filter)
      .limit(100)
      .lean()
      .exec();
    if (!isEmpty(events)) {
      return res.status(HTTPStatus.OK).json({
        success: true,
        message: `successfully listed the Events for device ${device}`,
        values: events.values,
      });
    } else if (isEmpty(events)) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: `unable to find the Events for device ${device}`,
      });
    }
  } catch (e) {
    return res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      message: `Server Error`,
      error: e.message,
    });
  }
};

const responseComponent = async (res, filter, tenant) => {
  try {
    const events = await getModelByTenant(tenant, "event", EventSchema)
      .find(filter)
      .limit(100)
      .lean()
      .exec();
    if (!isEmpty(events)) {
      return res.status(HTTPStatus.OK).json({
        success: true,
        message: `successfully listed the Events for the component ${filter.componentName}`,
        events,
      });
    } else if (isEmpty(events)) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: `unable to find the Events for the component ${filter.componentName}`,
      });
    }
  } catch (e) {
    return res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      message: `Server Error`,
      error: e.message,
    });
  }
};

const responseDeviceAndComponent = async (res, filter, tenant) => {
  try {
    constevents = await getModelByTenant(tenant, "event", EventSchema)
      .find(filter)
      .limit(100)
      .lean()
      .exec();

    if (!isEmpty(event)) {
      return res.status(HTTPStatus.OK).json({
        success: true,
        message: `successfully listed the Events for this device (${filter.deviceName}) component (${filter.componentName})`,
        values: events.values,
      });
    } else if (isEmpty(event)) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: `unable to find that Component ${filter.componentName} for device ${filter.deviceName}`,
      });
    }
  } catch (e) {
    return res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      message: `Server Error`,
      error: e.message,
    });
  }
};

const responseAll = async (req, res, tenant) => {
  try {
    // const limit = parseInt(req.query.limit, 0);
    const limit = 100;
    const skip = parseInt(req.query.skip, 0);
    const events = await getModelByTenant(tenant, "event", EventSchema).list({
      limit,
      skip,
    });
    if (!isEmpty(events)) {
      return res.status(HTTPStatus.OK).json({
        success: true,
        message: "successfully listed all platform Events",
        tip:
          "use documented query parameters (device/comp) to filter your search results",
        values: events.values,
      });
    } else if (isEmpty(events)) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: `unable to find all the platform Events`,
      });
    }
  } catch (e) {
    return res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      message: `Server Error`,
      error: e.message,
    });
  }
};

const responseDateRanges = () => {};

module.exports = {
  responseAll,
  responseDateRanges,
  responseDevice,
  responseDeviceAndComponent,
  responseComponent,
};
