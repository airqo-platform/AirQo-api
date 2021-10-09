const SiteActivitySchema = require("../models/SiteActivity");
const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const { logObject, logElement, logText } = require("../utils/log");
const { validationResult } = require("express-validator");

const {
  carryOutActivity,
  isDeviceDeployed,
  isDeviceRecalled,
  siteActivityRequestBodies,
  queryFilterOptions,
  bodyFilterOptions,
} = require("../utils/site-activities");

const {
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
  missingOrInvalidValues,
  badRequest,
  logger_v2,
  errorCodes,
} = require("../utils/errors");

const generateFilter = require("../utils/generate-filter");

const createSiteUtil = require("../utils/create-site");

const manipulateArraysUtil = require("../utils/manipulate-arrays");

const { getModelByTenant } = require("../utils/multitenancy");

const log4js = require("log4js");
const logger = log4js.getLogger("create-site-util");

const manageSite = {
  register: async (req, res) => {
    logText("registering site.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      let responseFromCreateSite = await createSiteUtil.create(tenant, req);
      logObject("responseFromCreateSite in controller", responseFromCreateSite);
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
          : HTTPStatus.CONFLICT;
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
    logText("registering site.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
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

  delete: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside delete site............");
      const { tenant } = req.query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      let filter = generateFilter.sites(req);
      logObject("filter", filter);
      let responseFromRemoveSite = await createSiteUtil.delete(tenant, filter);
      if (responseFromRemoveSite.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromRemoveSite.message,
          site: responseFromRemoveSite.data,
        });
      } else if (responseFromRemoveSite.success == false) {
        if (responseFromRemoveSite.errors) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromRemoveSite.message,
            errors: responseFromRemoveSite.errors,
          });
        } else {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromRemoveSite.message,
          });
        }
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
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
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
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      let filter = generateFilter.sites(req);
      logObject("responseFromFilter", filter);
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
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
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
      logText(".....................................");
      logText("list all sites by query params provided");
      const { tenant } = req.query;
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      let filter = generateFilter.sites(req);
      logObject("filter in the controller", filter);
      let responseFromListSites = await createSiteUtil.list({
        tenant,
        filter,
        limit,
        skip,
      });
      logElement(
        "has the response for listing sites been successful?",
        responseFromListSites.success
      );
      if (responseFromListSites.success === true) {
        let status = responseFromListSites.status
          ? responseFromListSites.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListSites.message,
          sites: responseFromListSites.data,
        });
      }

      if (responseFromListSites.success === false) {
        let error = responseFromListSites.errors
          ? responseFromListSites.errors
          : "";

        let status = responseFromListSites.status
          ? responseFromListSites.status
          : HTTPStatus.BAD_GATEWAY;

        res.status(status).json({
          success: false,
          message: responseFromListSites.message,
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

  recallDevice: async (req, res) => {
    const { tenant, deviceName } = req.query;
    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return badRequest(
        res,
        "bad request errors",
        manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
      );
    }
    const isRecalled = await isDeviceRecalled(deviceName, tenant.toLowerCase());
    if (isRecalled) {
      return res.status(HTTPStatus.CONFLICT).json({
        success: false,
        message: `Device ${deviceName} already recalled`,
      });
    }
    const { siteActivityBody, deviceBody } = siteActivityRequestBodies(
      req,
      res,
      "recall"
    );
    return await carryOutActivity(
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
      return badRequest(
        res,
        "bad request errors",
        manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
      );
    }

    const isDeployed = await isDeviceDeployed(deviceName, tenant.toLowerCase());

    if (isDeployed) {
      return res.status(HTTPStatus.CONFLICT).json({
        success: false,
        message: `Device ${deviceName} already deployed`,
      });
    }

    const { siteActivityBody, deviceBody } = siteActivityRequestBodies(
      req,
      res,
      "deploy"
    );
    return await carryOutActivity(
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
      return badRequest(
        res,
        "bad request errors",
        manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
      );
    }

    const { siteActivityBody, deviceBody } = siteActivityRequestBodies(
      req,
      res,
      "maintain"
    );
    return await carryOutActivity(
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
        missingQueryParams(res);
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
        const { activityBody } = await bodyFilterOptions(req, res);
        let filter = { _id: id };

        logObject("activity body", activityBody);

        const updated_activity = await getModelByTenant(
          tenant.toLowerCase(),
          "activity",
          SiteActivitySchema
        ).findOneAndUpdate(filter, activityBody, {
          new: true,
        });

        if (!isEmpty(updated_activity)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "activity updated successfully",
            updated_activity,
          });
        } else if (isEmpty(updated_activity)) {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: `An activity log by this ID (${id}) could be missing, please crosscheck`,
          });
        }
      } else {
        missingQueryParams(res);
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
        missingQueryParams(res);
      }

      const filter = generateFilter.activities_v0(req);
      logObject("activity filter", filter);

      const site_activities = await getModelByTenant(
        tenant.toLowerCase(),
        "activity",
        SiteActivitySchema
      ).list({ filter, limit, skip });

      if (!isEmpty(site_activities)) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: "activities fetched successfully",
          site_activities,
        });
      } else if (isEmpty(site_activities)) {
        return res.status(HTTPStatus.OK).json({
          success: false,
          message: `no site site_activities for this organisation (${tenant.toLowerCase()})`,
          site_activities,
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
