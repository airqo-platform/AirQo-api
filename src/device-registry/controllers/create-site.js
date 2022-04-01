const SiteActivitySchema = require("../models/SiteActivity");
const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const { logObject, logElement, logText } = require("../utils/log");
const { validationResult } = require("express-validator");

const errors = require("../utils/errors");

const generateFilter = require("../utils/generate-filter");

const createSiteUtil = require("../utils/create-site");

const { getModelByTenant } = require("../utils/multitenancy");

const log4js = require("log4js");
const httpStatus = require("http-status");
const logger = log4js.getLogger("create-site-util");

const manageSite = {
  register: async (req, res) => {
    logText("registering site.............");
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
      const { tenant } = req.query;
      let responseFromCreateSite = await createSiteUtil.create(tenant, req);
      if (responseFromCreateSite.success === true) {
        let status = responseFromCreateSite.status
          ? responseFromCreateSite.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateSite.message,
          site: responseFromCreateSite.data,
        });
      }

      if (responseFromCreateSite.success === false) {
        let errors = responseFromCreateSite.errors
          ? responseFromCreateSite.errors
          : "";
        let status = responseFromCreateSite.status
          ? responseFromCreateSite.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateSite.message,
          errors,
        });
      }
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
      };
    }
  },

  generateMetadata: async (req, res) => {
    logText("generating site metadata.............");
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
      let responseFromGenerateMetadata = await createSiteUtil.generateMetadata(
        req
      );
      logObject(
        "responseFromGenerateMetadata in controller",
        responseFromGenerateMetadata
      );

      if (responseFromGenerateMetadata.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromGenerateMetadata.message,
          metadata: responseFromGenerateMetadata.data,
        });
      }

      if (responseFromGenerateMetadata.success === false) {
        let error = responseFromGenerateMetadata.errors
          ? responseFromGenerateMetadata.errors
          : "";
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromGenerateMetadata.message,
          error,
        });
      }
    } catch (error) {
      logger.error(`server side error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listNearestWeatherStation: async (req, res) => {
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
      const { query, body } = req;
      const { id, tenant } = query;
      let request = {};
      request["query"] = {};
      request["query"]["id"] = id;
      request["query"]["tenant"] = tenant;
      let responseFromFindNearestSite = await createSiteUtil.findNearestWeatherStation(
        request
      );
      if (responseFromFindNearestSite.success === true) {
        const status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: "nearest site retrieved",
          nearest_weather_station: responseFromFindNearestSite.data,
        });
      }

      if (responseFromFindNearestSite.success === false) {
        const status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromFindNearestSite.errors
          ? responseFromFindNearestSite.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromFindNearestSite.message,
          errors,
        });
      }
    } catch (error) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listWeatherStations: async (req, res) => {
    try {
      const responseFromListTahmoStations = await createSiteUtil.listWeatherStations();
      logObject("responseFromListTahmoStations", responseFromListTahmoStations);
      if (responseFromListTahmoStations.success === true) {
        const status = responseFromListTahmoStations.status
          ? responseFromListTahmoStations.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListTahmoStations.message,
          stations: responseFromListTahmoStations.data,
        });
      } else if (responseFromListTahmoStations.success === false) {
        const status = responseFromListTahmoStations.status
          ? responseFromListTahmoStations.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromListTahmoStations.errors
          ? responseFromListTahmoStations.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromListTahmoStations.message,
          errors,
        });
      }
    } catch (error) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  findAirQlouds: async (req, res) => {
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
      const { query, body } = req;
      const { id, tenant } = query;
      let request = {};
      request["query"] = {};
      request["query"]["id"] = id;
      request["query"]["tenant"] = tenant;
      logObject("request", request);
      let responseFromFindAirQloud = await createSiteUtil.findAirQlouds(
        request
      );
      logObject("responseFromFindAirQloud", responseFromFindAirQloud);
      if (responseFromFindAirQloud.success === true) {
        let status = responseFromFindAirQloud.status
          ? responseFromFindAirQloud.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          airqlouds: responseFromFindAirQloud.data,
          message: responseFromFindAirQloud.message,
        });
      }
      if (responseFromFindAirQloud.success === false) {
        let errors = responseFromFindAirQloud.errors
          ? responseFromFindAirQloud.errors
          : "";
        let status = responseFromFindAirQloud.status
          ? responseFromFindAirQloud.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromFindAirQloud.message,
          errors,
        });
      }
    } catch (error) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside delete site............");
      const { tenant } = req.query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let filter = generateFilter.sites(req);
      logObject("filter", filter);
      let responseFromRemoveSite = await createSiteUtil.delete(tenant, filter);
      if (responseFromRemoveSite.success === true) {
        const status = responseFromRemoveSite.status
          ? responseFromRemoveSite.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveSite.message,
          site: responseFromRemoveSite.data,
        });
      }

      if (responseFromRemoveSite.success === false) {
        const status = responseFromRemoveSite.status
          ? responseFromRemoveSite.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromRemoveSite.errors
          ? responseFromRemoveSite.errors
          : "";
        return res.status(status).json({
          success: false,
          message: responseFromRemoveSite.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  update: async (req, res) => {
    try {
      logText("updating site................");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      let filter = generateFilter.sites(req);
      logObject("responseFromFilter", filter);
      let update = req.body;
      let responseFromUpdateSite = await createSiteUtil.update(
        tenant,
        filter,
        update
      );
      logObject("responseFromUpdateSite", responseFromUpdateSite);

      if (responseFromUpdateSite.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromUpdateSite.message,
          site: responseFromUpdateSite.data,
        });
      }

      if (responseFromUpdateSite.success === false) {
        const errors = responseFromUpdateSite.errors
          ? responseFromUpdateSite.errors
          : "";
        const status = responseFromUpdateSite.status
          ? responseFromUpdateSite.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateSite.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  refresh: async (req, res) => {
    try {
      logText("refreshing site details................");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      let filter = generateFilter.sites(req);
      let update = req.body;
      let responseFromRefreshSite = await createSiteUtil.refresh(tenant, req);
      logObject("responseFromRefreshSite", responseFromRefreshSite);
      if (responseFromRefreshSite.success === true) {
        let status = responseFromRefreshSite.status
          ? responseFromRefreshSite.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRefreshSite.message,
          site: responseFromRefreshSite.data,
        });
      }

      if (responseFromRefreshSite.success === false) {
        let error = responseFromRefreshSite.errors
          ? responseFromRefreshSite.errors
          : "";
        let status = responseFromRefreshSite.status
          ? responseFromRefreshSite.status
          : HTTPStatus.BAD_GATEWAY;

        return res.status(status).json({
          success: false,
          message: responseFromRefreshSite.message,
          error,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  findNearestSite: async (req, res) => {
    try {
      logText("list all sites by coordinates...");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant, latitude, longitude, radius } = req.query;

      logElement("latitude ", latitude);
      logElement("longitude ", longitude);

      let request = {};
      request["radius"] = radius;
      request["latitude"] = latitude;
      request["longitude"] = longitude;
      request["tenant"] = tenant;
      const responseFromFindNearestSite = await createSiteUtil.findNearestSitesByCoordinates(
        request
      );

      logObject("responseFromFindNearestSite", responseFromFindNearestSite);
      if (responseFromFindNearestSite.success === true) {
        let nearestSites = responseFromFindNearestSite.data;
        let status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : HTTPStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromFindNearestSite.message,
          sites: nearestSites,
        });
      }

      if (responseFromFindNearestSite.success === false) {
        let errors = responseFromFindNearestSite.errors
          ? responseFromFindNearestSite.errors
          : "";
        let status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromFindNearestSite.message,
          errors,
        });
      }
    } catch (e) {
      logElement("server error", e.message);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  list: async (req, res) => {
    try {
      const { tenant } = req.query;
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let filter = generateFilter.sites(req);
      let responseFromListSites = await createSiteUtil.list({
        tenant,
        filter,
        limit,
        skip,
      });

      if (responseFromListSites.success === true) {
        let status = responseFromListSites.status
          ? responseFromListSites.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListSites.message,
          sites: responseFromListSites.data,
        });
      } else if (responseFromListSites.success === false) {
        let errors = responseFromListSites.errors
          ? responseFromListSites.errors
          : { message: "" };

        let status = responseFromListSites.status
          ? responseFromListSites.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromListSites.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  recallDevice: async (req, res) => {
    const { tenant, deviceName } = req.query;
    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return errors.badRequest(
        res,
        "bad request errors",
        errors.convertErrorArrayToObject(nestedErrors)
      );
    }
    const isRecalled = await createSiteUtil.isDeviceRecalled(
      deviceName,
      tenant.toLowerCase()
    );
    if (isRecalled) {
      return res.status(HTTPStatus.CONFLICT).json({
        success: false,
        message: `Device ${deviceName} already recalled`,
      });
    }
    const {
      siteActivityBody,
      deviceBody,
    } = createSiteUtil.siteActivityRequestBodies(req, res, "recall");
    return await createSiteUtil.carryOutActivity(
      res,
      tenant,
      deviceName,
      deviceBody,
      siteActivityBody,
      {
        successMsg: `Successfully recalled device ${deviceName}`,
        errorMsg: `Failed to recall device ${deviceName}`,
      }
    );
  },
  deploymentFields: [
    "height",
    "mountType",
    "powerType",
    "date",
    "latitude",
    "longitude",
    "site_id",
    "isPrimaryInLocation",
    "isUsedForCollocation",
  ],
  deployDevice: async (req, res) => {
    const { tenant, deviceName } = req.query;

    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return errors.badRequest(
        res,
        "bad request errors",
        errors.convertErrorArrayToObject(nestedErrors)
      );
    }

    const isDeployed = await createSiteUtil.isDeviceDeployed(
      deviceName,
      tenant.toLowerCase()
    );

    if (isDeployed) {
      return res.status(HTTPStatus.CONFLICT).json({
        success: false,
        message: `Device ${deviceName} already deployed`,
      });
    }

    const {
      siteActivityBody,
      deviceBody,
    } = createSiteUtil.siteActivityRequestBodies(req, res, "deploy");
    return await createSiteUtil.carryOutActivity(
      res,
      tenant,
      deviceName,
      deviceBody,
      siteActivityBody,
      {
        successMsg: `Successfully deployed device ${deviceName}`,
        errorMsg: `Failed to deploy device ${deviceName}`,
      }
    );
  },
  maintenanceField: ["date", "tags", "maintenanceType", "description"],
  maintainDevice: async (req, res) => {
    const { tenant, deviceName } = req.query;
    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return errors.badRequest(
        res,
        "bad request errors",
        errors.convertErrorArrayToObject(nestedErrors)
      );
    }

    const {
      siteActivityBody,
      deviceBody,
    } = createSiteUtil.siteActivityRequestBodies(req, res, "maintain");
    return await createSiteUtil.carryOutActivity(
      res,
      tenant,
      deviceName,
      deviceBody,
      siteActivityBody,
      {
        successMsg: `Successfully maintained device ${deviceName}`,
        errorMsg: `Failed to maintained device ${deviceName}`,
      }
    );
  },
  deleteActivity: async (req, res) => {
    try {
      const { tenant, id } = req.query;
      if (tenant && id) {
        const Activity = await getModelByTenant(
          tenant.toLowerCase(),
          "activity",
          SiteActivitySchema
        );
        let filter = { _id: id };

        Activity.findOneAndDelete(filter)
          .exec()
          .then((deleted_activity) => {
            if (!isEmpty(deleted_activity)) {
              return res.status(HTTPStatus.OK).json({
                success: true,
                message: "the log has successfully been deleted",
                deleted_activity,
              });
            } else if (isEmpty(deleted_activity)) {
              return res.status(HTTPStatus.BAD_REQUEST).json({
                success: false,
                message: `there is no activity by that id (${id}), please crosscheck`,
              });
            }
          })
          .catch((error) => {
            return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
              success: false,
              message: "Internal Server Error",
              errors: { message: error },
            });
          });
      } else {
        errors.missingQueryParams(res);
      }
    } catch (e) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  updateActivity: async (req, res) => {
    try {
      const { tenant, id } = req.query;
      logElement("tenant", tenant);
      logElement("id", id);
      if (tenant && id) {
        const { activityBody } = await createSiteUtil.bodyFilterOptions(
          req,
          res
        );
        let filter = { _id: id };

        logObject("activity body", activityBody);

        const update = activityBody;

        const responseFromUpdateActivity = await getModelByTenant(
          tenant.toLowerCase(),
          "activity",
          SiteActivitySchema
        ).modify({ filter, update });

        if (responseFromUpdateActivity.success === true) {
          const status = responseFromUpdateActivity.status
            ? responseFromUpdateActivity.status
            : HTTPStatus.OK;
          return res.status(status).json({
            success: true,
            message: "activity updated successfully",
            updated_activity: responseFromUpdateActivity.data,
          });
        } else if (responseFromUpdateActivity.success === false) {
          const status = responseFromUpdateActivity.status
            ? responseFromUpdateActivity.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          return res.status(status).json({
            success: false,
            message: responseFromUpdateActivity.message,
          });
        }
      } else {
        errors.missingQueryParams(res);
      }
    } catch (e) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  getActivities: async (req, res) => {
    try {
      logText(".....getting site site_activities......................");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { tenant } = req.query;

      if (!tenant) {
        errors.missingQueryParams(res);
      }

      const filter = generateFilter.activities_v0(req);
      logObject("activity filter", filter);

      const responseFromListSite = await getModelByTenant(
        tenant.toLowerCase(),
        "activity",
        SiteActivitySchema
      ).list({ filter, limit, skip });

      if (responseFromListSite.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: "activities fetched successfully",
          site_activities: responseFromListSite.data,
        });
      } else if (responseFromListSite.success === false) {
        const errors = responseFromListSite.errors
          ? responseFromListSite.errors
          : "";
        const status = responseFromListSite.status
          ? responseFromListSite.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListSite.message,
          errors,
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },
};

module.exports = manageSite;
