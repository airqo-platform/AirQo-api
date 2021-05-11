const SiteActivitySchema = require("../models/SiteActivity");
const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const { logObject, logElement, logText } = require("../utils/log");
const { getModelByTenant } = require("../utils/multitenancy");

const {
  carryOutActivity,
  isDeviceDeployed,
  isDeviceRecalled,
  siteActivityRequestBodies,
  doLocationActivity,
  queryFilterOptions,
  bodyFilterOptions,
} = require("../utils/site-activities");

const {
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");

const getDetail = require("../utils/get-device-details");

const manageSite = {
  recallDevice: async  (req, res) => {
    const { tenant, deviceName } = req.query;
    const isRecalled = await isDeviceRecalled(
        deviceName,
        tenant.toLowerCase()
    );
    if (isRecalled) {
      return res.status(HTTPStatus.CONFLICT).json({
      success: false,
      message: `Device ${deviceName} already recalled`,
    })
    }
    const { siteActivityBody, deviceBody } = siteActivityRequestBodies(req, res, "recall");
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
    )

  },
  deploymentFields: [
      "height",
      "mountType",
      "powerType",
      "date",
      "latitude",
      "longitude",
      "isPrimaryInLocation",
      "isUserForCollocaton"
  ],
  deployDevice: async (req, res) => {
    const {tenant, deviceName} = req.query;

    const isDeployed = await isDeviceDeployed(
        deviceName,
        tenant.toLowerCase()
    );

    if (isDeployed) {
      return res.status(HTTPStatus.CONFLICT).json({
        success: false,
        message: `Device ${deviceName} already deployed`,
      })
    }
    const { siteActivityBody, deviceBody } = siteActivityRequestBodies(req, res, "deploy");
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
    )
  },
  maintenanceField: [
    "date",
    "tags",
    "maintenanceType",
    "description"
  ],
  maintainDevice: async (req, res) => {
    const {tenant, deviceName} = req.query;
    const { siteActivityBody, deviceBody } = siteActivityRequestBodies(req, res, "maintain");
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
    )

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
          .then((deletedActivity) => {
            if (!isEmpty(deletedActivity)) {
              return res.status(HTTPStatus.OK).json({
                success: true,
                message: "the log has successfully been deleted",
                deletedActivity,
              });
            } else if (isEmpty(deletedActivity)) {
              return res.status(HTTPStatus.BAD_REQUEST).json({
                success: false,
                message: `there is no log by that id (${id}), please crosscheck`,
              });
            }
          })
          .catch((error) => {
            callbackErrors(error, req, res);
          });
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
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

        const updatedActivity = await getModelByTenant(
          tenant.toLowerCase(),
          "activity",
          SiteActivitySchema
        ).findOneAndUpdate(filter, activityBody, {
          new: true,
        });

        if (!isEmpty(updatedActivity)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Activity updated successfully",
            updatedActivity,
          });
        } else if (isEmpty(updatedActivity)) {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: `An activity log by this ID (${id}) could be missing, please crosscheck`,
          });
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  getActivities: async (req, res) => {
    try {
      logText(".....getting logs......................");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { tenant, device, type, location, next, id } = req.query;
      logElement("the tenant", tenant);

      const { activityFilter } = await queryFilterOptions(req, res);
      logObject("activity filter", activityFilter);

      if (tenant) {
        if (!device && !type && !location && !next && !id) {
          const locationActivities = await getModelByTenant(
            tenant.toLowerCase(),
            "activity",
            SiteActivitySchema
          ).list({
            limit,
            skip,
          });
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Activities fetched successfully",
            locationActivities,
          });
        } else {
          const activities = await getModelByTenant(
            tenant.toLowerCase(),
            "activity",
            SiteActivitySchema
          ).find(activityFilter);

          if (!isEmpty(activities)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "Activities fetched successfully",
              activities,
            });
          } else if (isEmpty(activities)) {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: `Your query filters have no results for this organisation (${tenant.toLowerCase()})`,
            });
          }
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },
};

module.exports = manageSite;
