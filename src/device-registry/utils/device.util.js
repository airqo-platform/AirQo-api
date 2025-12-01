"use strict";
const DeviceModel = require("@models/Device");
const ActivityModel = require("@models/Activity");
const CohortModel = require("@models/Cohort");
const ShippingBatchModel = require("@models/ShippingBatch");
const mongoose = require("mongoose");
const { isValidObjectId } = require("mongoose");
const axios = require("axios");
const { logObject, logText, logElement, HttpError } = require("@utils/shared");
const {
  generateFilter,
  claimTokenUtil,
  ActivityLogger,
} = require("@utils/common");
const constants = require("@config/constants");
const cryptoJS = require("crypto-js");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const moment = require("moment-timezone");
const ObjectId = mongoose.Types.ObjectId;
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- device-util`);
const qs = require("qs");
const stringSimilarity = require("string-similarity");
const QRCode = require("qrcode");
const { Kafka } = require("kafkajs");
const { transform } = require("node-json-transform");
const httpStatus = require("http-status");

let organizationUtil = null;
try {
  organizationUtil = require("@utils/organization.util");
  console.log("✅ Organization util loaded successfully");
} catch (error) {
  console.warn("⚠️  Organization util not available:", error.message);
  // Create a mock object with the same interface
  organizationUtil = {
    switchOrganizationContext: async () => ({
      success: false,
      message: "Organization service not available",
      status: 503,
    }),
    getUserOrganizations: async () => ({
      success: false,
      message: "Organization service not available",
      data: [],
    }),
    isAvailable: () => false,
    getStatus: () => ({ configured: false, ready: false }),
  };
}

const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

// Add this helper function near the top of device.util.js, after the imports

/**
 * Builds the MongoDB aggregation stage for computing device_categories
 * Single source of truth for category computation logic
 * @returns {Object} MongoDB $addFields stage
 */
const getDeviceCategoriesAddFieldsStage = () => {
  return {
    $addFields: {
      device_categories: {
        primary_category: { $ifNull: ["$category", "lowcost"] },
        deployment_category: { $ifNull: ["$deployment_type", "static"] },
        is_mobile: {
          $or: [
            { $eq: ["$mobility", true] },
            { $eq: ["$deployment_type", "mobile"] },
          ],
        },
        is_static: {
          $or: [
            { $eq: ["$mobility", false] },
            { $eq: ["$deployment_type", "static"] },
          ],
        },
        is_lowcost: { $eq: ["$category", "lowcost"] },
        is_bam: { $eq: ["$category", "bam"] },
        is_gas: { $eq: ["$category", "gas"] },
        all_categories: {
          $concatArrays: [
            [{ $ifNull: ["$category", "lowcost"] }],
            [{ $ifNull: ["$deployment_type", "static"] }],
          ],
        },
        category_hierarchy: [
          {
            level: "equipment",
            category: { $ifNull: ["$category", "lowcost"] },
            description: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$category", "lowcost"] },
                    then: "Low-cost sensor device",
                  },
                  {
                    case: { $eq: ["$category", "bam"] },
                    then: "Beta Attenuation Monitor (reference-grade)",
                  },
                  {
                    case: { $eq: ["$category", "gas"] },
                    then: "Gas sensor device",
                  },
                ],
                default: "Low-cost sensor device",
              },
            },
          },
          {
            level: "deployment",
            category: { $ifNull: ["$deployment_type", "static"] },
            description: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$deployment_type", "mobile"] },
                    then: "Mobile deployment (vehicle-mounted, grid-based)",
                  },
                  {
                    case: { $eq: ["$deployment_type", "static"] },
                    then: "Static deployment (fixed location, site-based)",
                  },
                ],
                default: "Static deployment (fixed location, site-based)",
              },
            },
          },
        ],
        category_relationships: {
          $cond: [
            {
              $or: [
                { $eq: ["$mobility", true] },
                { $eq: ["$deployment_type", "mobile"] },
              ],
            },
            {
              type: "mobile",
              note: {
                $concat: [
                  "This is a mobile ",
                  { $ifNull: ["$category", "lowcost"] },
                  " device. Mobile devices can belong to any equipment category (lowcost, bam, or gas) and use grid-based deployment.",
                ],
              },
              belongs_to_equipment_category: {
                $ifNull: ["$category", "lowcost"],
              },
              deployment_method: "grid-based",
            },
            {
              type: "static",
              note: {
                $concat: [
                  "This is a static ",
                  { $ifNull: ["$category", "lowcost"] },
                  " device deployed at a fixed location using site-based deployment.",
                ],
              },
              belongs_to_equipment_category: {
                $ifNull: ["$category", "lowcost"],
              },
              deployment_method: "site-based",
            },
          ],
        },
      },
    },
  };
};

const deviceUtil = {
  getDeviceCountSummary: async (request, next) => {
    try {
      const { tenant, group_id, cohort_id } = request.query;

      // 1. Build the initial filter based on group or cohort
      const filter = {};
      if (group_id) {
        const groupIds = group_id.split(",").map((id) => id.trim());
        filter.groups = { $in: groupIds };
      }
      if (cohort_id) {
        const cohortIds = cohort_id.split(",").map((id) => ObjectId(id.trim()));
        filter.cohorts = { $in: cohortIds };
      }

      // 2. Create the aggregation pipeline with $facet
      const pipeline = [
        { $match: filter },
        {
          $facet: {
            deployed: [{ $match: { status: "deployed" } }, { $count: "count" }],
            recalled: [{ $match: { status: "recalled" } }, { $count: "count" }],
            undeployed: [
              { $match: { status: "not deployed" } },
              { $count: "count" },
            ],
            online: [{ $match: { isOnline: true } }, { $count: "count" }],
            offline: [{ $match: { isOnline: false } }, { $count: "count" }],
            maintenance_overdue: [
              {
                $match: {
                  nextMaintenance: { $lt: new Date() },
                  status: "deployed",
                },
              },
              { $count: "count" },
            ],
          },
        },
      ];

      // 3. Execute the aggregation
      const results = await DeviceModel(tenant).aggregate(pipeline);

      // 4. Format the response
      const counts = results[0];
      const summary = {
        deployed: counts.deployed[0] ? counts.deployed[0].count : 0,
        recalled: counts.recalled[0] ? counts.recalled[0].count : 0,
        undeployed: counts.undeployed[0] ? counts.undeployed[0].count : 0,
        online: counts.online[0] ? counts.online[0].count : 0,
        offline: counts.offline[0] ? counts.offline[0].count : 0,
        maintenance_overdue: counts.maintenance_overdue[0]
          ? counts.maintenance_overdue[0].count
          : 0,
      };

      return {
        success: true,
        message: "Successfully retrieved device count summary.",
        data: summary,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getDeviceById: async (req, next) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        throw new HttpError("Invalid device id", httpStatus.BAD_REQUEST);
      }

      // Create a new request object for the list function
      const listRequest = {
        ...req,
        query: {
          ...req.query,
          id: id, // Pass the ID from params into the query for the list function
        },
      };

      // Call the list function
      const listResponse = await deviceUtil.list(listRequest, next);

      if (!listResponse.success || isEmpty(listResponse.data)) {
        throw new HttpError("Device not found", httpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: "Device details with activities fetched successfully",
        data: listResponse.data[0],
        status: httpStatus.OK,
        meta: listResponse.meta,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
        return;
      }
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  doesDeviceSearchExist: async (request, next) => {
    try {
      const { filter, tenant } = request;
      let doesSearchExist = await DeviceModel(tenant).exists(filter);
      logElement(" doesSearchExist", doesSearchExist);
      if (doesSearchExist) {
        return {
          success: true,
          message: "search exists",
          data: doesSearchExist,
        };
      } else if (!doesSearchExist) {
        return {
          success: false,
          message: "search does not exist",
          data: [],
        };
      }
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  doesDeviceExist: async (request, next) => {
    logText("checking device existence...");
    const responseFromList = await deviceUtil.list(request, next);
    if (responseFromList.success === true && responseFromList.data) {
      return true;
    }
    return false;
  },

  getDevicesCount: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.devices(request, next);
      const count = await DeviceModel(tenant).countDocuments(filter);
      return {
        success: true,
        message: "retrieved the number of devices",
        status: httpStatus.OK,
        data: count,
      };
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  generateQR: async (request, next) => {
    try {
      const { include_site } = request.query;
      const responseFromListDevice = await deviceUtil.list(request, next);
      logObject("responseFromListDevice", responseFromListDevice);
      if (responseFromListDevice.success === true) {
        const deviceBody = responseFromListDevice.data;
        if (isEmpty(deviceBody)) {
          return {
            success: false,
            message: "device does not exist",
          };
        }
        if (!isEmpty(include_site) && include_site === "no") {
          delete deviceBody[0].site;
        } else if (isEmpty(include_site)) {
          delete deviceBody[0].site;
        }

        const stringifiedJSON = deviceBody[0]
          ? JSON.stringify(deviceBody[0])
          : "";
        const url = await QRCode.toDataURL(stringifiedJSON);
        return {
          success: true,
          message: "successfully generated the QR Code",
          data: url,
          status: httpStatus.OK,
        };
      } else if (responseFromListDevice.success === false) {
        return responseFromListDevice;
      }
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  generateQRCode: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.devices(request, next);

      // Get device with minimal fields only
      const device = await DeviceModel(tenant)
        .findOne(filter)
        .select("name long_name device_number serial_number network")
        .lean(); // Use lean() for better performance

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Device does not exist" },
        };
      }

      // ✅ MINIMAL QR DATA - Only essential info
      const qrData = {
        id: device._id.toString(),
        name: device.long_name || device.name,
        network: device.network || "unknown",
        url: `${constants.DEPLOYMENT_URL ||
          "https://netmanager.airqo.net"}/device/${device.name}/overview`,
      };

      // Optional: Add device number if it exists
      if (device.device_number) {
        qrData.device_number = device.device_number;
      }

      // Optional: Add serial number if it exists
      if (device.serial_number) {
        qrData.serial = device.serial_number;
      }

      const qrString = JSON.stringify(qrData);

      if (qrString.length > 2000) {
        logger.warn(`QR Code data may be too large: ${qrString.length} bytes`);
      }

      // Generate QR code with appropriate settings
      const qrCodeDataURL = await QRCode.toDataURL(qrString, {
        type: "image/png",
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M", // Medium error correction for balance
      });

      return {
        success: true,
        message: "QR code generated successfully",
        data: {
          qr_code: qrCodeDataURL,
          device_name: device.name,
          data_size_bytes: qrString.length,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      // Handle specific QR code errors
      if (error.message && error.message.includes("too big")) {
        logger.error(`QR Code data size error: ${error.message}`);
        return {
          success: false,
          message: "QR code data is too large",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "Device data is too large for QR code generation",
            suggestion: "Use minimal device information for QR codes",
          },
        };
      }

      logger.error(`🪲🪲 QR Code Generation Error ${error.message}`);
      next(
        new HttpError(
          "QR Code Generation Failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (request, next) => {
    try {
      if (request.query.tenant !== "airqo") {
        return {
          success: false,
          message: "creation is not yet possible for this organisation",
          status: httpStatus.NOT_IMPLEMENTED,
        };
      }

      if (constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT") {
        return {
          success: false,
          message: "Bad Request",
          errors: {
            message:
              "please utilise SOFT creation when operating in testing environments",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      let responseFromCreateOnThingspeak = await deviceUtil.createOnThingSpeak(
        request,
        next
      );

      let enrichmentDataForDeviceCreation = responseFromCreateOnThingspeak.data
        ? responseFromCreateOnThingspeak.data
        : {};

      if (!isEmpty(enrichmentDataForDeviceCreation)) {
        let modifiedRequest = request;
        modifiedRequest["body"] = {
          ...request.body,
          ...enrichmentDataForDeviceCreation,
        };

        let responseFromCreateDeviceOnPlatform = await deviceUtil.createOnPlatform(
          modifiedRequest,
          next
        );
        logObject(
          "responseFromCreateDeviceOnPlatform",
          responseFromCreateDeviceOnPlatform
        );
        if (responseFromCreateDeviceOnPlatform.success === true) {
          return responseFromCreateDeviceOnPlatform;
        } else if (responseFromCreateDeviceOnPlatform.success === false) {
          let deleteRequest = {};
          deleteRequest["query"] = {};
          deleteRequest["query"]["device_number"] =
            enrichmentDataForDeviceCreation.device_number;

          let responseFromDeleteDeviceFromThingspeak = await deviceUtil.deleteOnThingspeak(
            deleteRequest,
            next
          );

          if (responseFromDeleteDeviceFromThingspeak.success === true) {
            let errorsString = responseFromCreateDeviceOnPlatform.errors
              ? JSON.stringify(responseFromCreateDeviceOnPlatform.errors)
              : "";
            try {
              logger.error(
                `creation operation failed -- successfully undid the successfull operations -- ${errorsString}`
              );
            } catch (error) {
              logger.error(`internal server error ${error.message}`);
            }
            return {
              success: false,
              message:
                "creation operation failed -- successfully undid the successfull operations",
              errors: responseFromCreateDeviceOnPlatform.errors
                ? responseFromCreateDeviceOnPlatform.errors
                : { message: "Internal Server Error" },
              status: responseFromCreateDeviceOnPlatform.status
                ? responseFromCreateDeviceOnPlatform.status
                : httpStatus.INTERNAL_SERVER_ERROR,
            };
          } else if (responseFromDeleteDeviceFromThingspeak.success === false) {
            const status = responseFromDeleteDeviceFromThingspeak.status
              ? responseFromDeleteDeviceFromThingspeak.status
              : httpStatus.INTERNAL_SERVER_ERROR;
            try {
              let errorsString = responseFromDeleteDeviceFromThingspeak.errors
                ? JSON.stringify(responseFromDeleteDeviceFromThingspeak.errors)
                : "";
              logger.error(
                `creation operation failed -- also failed to undo the successfull operations --${errorsString}`
              );
            } catch (error) {
              logger.error(`internal server error ${error.message}`);
            }
            return {
              success: false,
              message:
                "creation operation failed -- also failed to undo the successfull operations",
              errors: responseFromDeleteDeviceFromThingspeak.errors
                ? responseFromDeleteDeviceFromThingspeak.errors
                : { message: "Internal Server Error" },
              status,
            };
          }
        }
      } else if (isEmpty(enrichmentDataForDeviceCreation)) {
        try {
          let errorsString = responseFromCreateOnThingspeak.errors
            ? JSON.stringify(responseFromCreateOnThingspeak.errors)
            : "";
          logger.error(
            `unable to generate enrichment data for the device -- ${errorsString}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return {
          success: false,
          message: "unable to generate enrichment data for the device",
          errors: responseFromCreateOnThingspeak.errors
            ? responseFromCreateOnThingspeak.errors
            : { message: "Internal Server Error" },
          status: responseFromCreateOnThingspeak.status
            ? responseFromCreateOnThingspeak.status
            : "",
        };
      }
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (request, next) => {
    try {
      // logger.info(`in the update util....`);
      if (constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT") {
        return {
          success: false,
          message: "Bad Request",
          errors: {
            message:
              "please utilise SOFT update when operating in testing environments",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }
      let { device_number } = request.query;
      let modifiedRequest = Object.assign({}, request);
      if (isEmpty(device_number)) {
        // logger.info(`the device_number is not present in the update request`);
        let responseFromListDevice = await deviceUtil.list(request, next);
        // logger.info(`responseFromListDevice -- ${responseFromListDevice}`);
        if (responseFromListDevice.success === false) {
          return {
            success: false,
            message: responseFromListDevice.message,
            errors: responseFromListDevice.errors
              ? responseFromListDevice.errors
              : { message: "" },
          };
        }
        device_number = responseFromListDevice.data[0].device_number;
        // logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      // logger.info(`the modifiedRequest -- ${modifiedRequest} `);

      if (isEmpty(device_number)) {
        const responseFromUpdateDeviceOnPlatform = await deviceUtil.updateOnPlatform(
          request,
          next
        );
        return responseFromUpdateDeviceOnPlatform;
      } else if (!isEmpty(device_number)) {
        const responseFromUpdateDeviceOnThingspeak = await deviceUtil.updateOnThingspeak(
          modifiedRequest,
          next
        );
        if (responseFromUpdateDeviceOnThingspeak.success === true) {
          const responseFromUpdateDeviceOnPlatform = await deviceUtil.updateOnPlatform(
            request,
            next
          );
          return responseFromUpdateDeviceOnPlatform;
        } else if (responseFromUpdateDeviceOnThingspeak.success === false) {
          return responseFromUpdateDeviceOnThingspeak;
        }
      }
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  encryptKeys: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { body } = request;
      const update = body;
      const filter = generateFilter.devices(request, next);
      const responseFromEncryptKeys = await DeviceModel(tenant).encryptKeys({
        filter,
        update,
      });
      return responseFromEncryptKeys;
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (request, next) => {
    try {
      return {
        success: false,
        message: "feature temporarily disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      const { device_number } = request.query;
      let modifiedRequest = request;
      if (isEmpty(device_number)) {
        // logger.info(`the device_number is not present`);
        let responseFromListDevice = await deviceUtil.list(request, next);
        // logger.info(`responseFromListDevice -- ${responseFromListDevice}`);
        if (responseFromListDevice.success === false) {
          return responseFromListDevice;
        }
        let device_number = responseFromListDevice.data[0].device_number;
        // logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      // logger.info(`the modifiedRequest -- ${modifiedRequest} `);

      let responseFromDeleteDeviceFromThingspeak = await deviceUtil.deleteOnThingspeak(
        modifiedRequest,
        next
      );

      // logger.info(
      //   `responseFromDeleteDeviceFromThingspeak -- ${responseFromDeleteDeviceFromThingspeak}`
      // );
      if (responseFromDeleteDeviceFromThingspeak.success === true) {
        let responseFromDeleteDeviceOnPlatform = await deviceUtil.deleteOnPlatform(
          modifiedRequest,
          next
        );

        // logger.info(
        //   `responseFromDeleteDeviceOnPlatform -- ${responseFromDeleteDeviceOnPlatform}`
        // );

        if (responseFromDeleteDeviceOnPlatform.success === true) {
          return responseFromDeleteDeviceOnPlatform;
        } else if (responseFromDeleteDeviceOnPlatform.success === false) {
          return responseFromDeleteDeviceOnPlatform;
        }
      } else if (responseFromDeleteDeviceFromThingspeak.success === false) {
        return {
          success: false,
          message: responseFromDeleteDeviceFromThingspeak.message,
          errors: responseFromDeleteDeviceFromThingspeak.errors
            ? responseFromDeleteDeviceFromThingspeak.errors
            : { message: "" },
          status: parseInt(
            `${
              responseFromDeleteDeviceFromThingspeak.status
                ? responseFromDeleteDeviceFromThingspeak.status
                : ""
            }`
          ),
        };
      }
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (request, next) => {
    try {
      const {
        tenant: rawTenant,
        limit,
        skip,
        useCache = "true",
        detailLevel = "full",
        sortBy,
        order,
      } = request.query;
      const tenant = (rawTenant || constants.DEFAULT_TENANT).toLowerCase();
      const activitiesColl = ActivityModel(tenant).collection.name;
      const MAX_LIMIT =
        Number(constants.DEFAULT_LIMIT_FOR_QUERYING_DEVICES) || 1000;
      const _skip = Math.max(0, parseInt(skip, 10) || 0);
      const _limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(limit, 10) || MAX_LIMIT)
      );
      const sortOrder = order === "asc" ? 1 : -1;
      const sortField = sortBy ? sortBy : "createdAt";
      const filter = generateFilter.devices(request, next);

      let pipeline = [];

      // Base match
      pipeline.push({ $match: filter });

      if (detailLevel === "minimal") {
        // Minimal data for performance-critical scenarios
        pipeline.push(getDeviceCategoriesAddFieldsStage(), {
          $project: {
            _id: 1,
            name: 1,
            long_name: 1,
            status: 1,
            isActive: 1,
            network: 1,
            category: 1,
            deployment_type: 1,
            mobility: 1,
            device_number: 1,
            createdAt: 1,
            cached_total_activities: 1,
            device_categories: 1,
          },
        });
      } else if (detailLevel === "summary") {
        // Summary with essential relations and cached data
        pipeline.push(
          {
            $lookup: {
              from: "sites",
              localField: "site_id",
              foreignField: "_id",
              as: "site",
              pipeline: [
                { $project: { _id: 1, name: 1, district: 1, country: 1 } },
              ],
            },
          },
          {
            $lookup: {
              from: "grids",
              localField: "grid_id",
              foreignField: "_id",
              as: "assigned_grid",
              pipeline: [{ $project: { _id: 1, name: 1, admin_level: 1 } }],
            },
          },
          getDeviceCategoriesAddFieldsStage(),
          {
            $addFields: {
              total_activities: { $ifNull: ["$cached_total_activities", 0] },
              activities_by_type: {
                $ifNull: ["$cached_activities_by_type", {}],
              },
              latest_deployment_activity: "$cached_latest_deployment_activity",
              latest_maintenance_activity:
                "$cached_latest_maintenance_activity",
              latest_recall_activity: "$cached_latest_recall_activity",
            },
          },
          { $project: constants.DEVICES_INCLUSION_PROJECTION },
          { $project: constants.DEVICES_EXCLUSION_PROJECTION("summary") }
        );
      } else {
        // Full detail level (existing complex aggregation)
        const maxActivities = parseInt(request.query.maxActivities) || 500;

        pipeline.push(
          {
            $lookup: {
              from: "sites",
              localField: "site_id",
              foreignField: "_id",
              as: "site",
            },
          },
          {
            $unwind: {
              path: "$site",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "hosts",
              localField: "host_id",
              foreignField: "_id",
              as: "host",
            },
          },
          {
            $lookup: {
              from: "sites",
              localField: "previous_sites",
              foreignField: "_id",
              as: "previous_sites",
            },
          },
          {
            $lookup: {
              from: "cohorts",
              localField: "cohorts",
              foreignField: "_id",
              as: "cohorts",
            },
          },
          {
            $lookup: {
              from: "grids",
              localField: "site.grids",
              foreignField: "_id",
              as: "grids",
            },
          },
          {
            $lookup: {
              from: "grids",
              localField: "grid_id",
              foreignField: "_id",
              as: "assigned_grid",
            },
          }
        );

        if (useCache === "true") {
          // Use cached activity data - NO activities lookup
          pipeline.push(getDeviceCategoriesAddFieldsStage(), {
            $addFields: {
              // Map cached fields to expected output fields
              total_activities: { $ifNull: ["$cached_total_activities", 0] },
              activities_by_type: {
                $ifNull: ["$cached_activities_by_type", {}],
              },
              latest_activities_by_type: {
                $ifNull: ["$cached_latest_activities_by_type", {}],
              },
              latest_deployment_activity: {
                $ifNull: ["$cached_latest_deployment_activity", null],
              },
              latest_maintenance_activity: {
                $ifNull: ["$cached_latest_maintenance_activity", null],
              },
              latest_recall_activity: {
                $ifNull: ["$cached_latest_recall_activity", null],
              },
            },
          });
        } else {
          // Real-time activity aggregation (expensive)
          pipeline.push(
            {
              $lookup: {
                from: activitiesColl,
                let: { deviceName: "$name", deviceId: "$_id" },
                pipeline: [
                  {
                    // Prioritize indexed device_id lookup, fall back to legacy device name for backwards compatibility
                    $match: {
                      $expr: {
                        $or: [
                          { $eq: ["$device_id", "$$deviceId"] },
                          { $eq: ["$device", "$$deviceName"] },
                        ],
                      },
                    },
                  },
                  { $sort: { createdAt: -1 } },
                  {
                    $project: {
                      _id: 1,
                      site_id: 1,
                      device_id: 1,
                      device: 1,
                      activityType: 1,
                      maintenanceType: 1,
                      recallType: 1,
                      date: 1,
                      description: 1,
                      nextMaintenance: 1,
                      createdAt: 1,
                      tags: 1,
                    },
                  },
                  { $limit: maxActivities },
                ],
                as: "activities",
              },
            },
            getDeviceCategoriesAddFieldsStage(),
            {
              $addFields: {
                // Calculate total from activities array
                total_activities: {
                  $cond: [
                    { $isArray: "$activities" },
                    { $size: "$activities" },
                    0,
                  ],
                },
                // Find the latest activities from the single 'activities' array
                latest_deployment_activity: {
                  $reduce: {
                    input: "$activities",
                    initialValue: null,
                    in: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$$this.activityType", "deployment"] },
                            {
                              $or: [
                                { $eq: ["$$value", null] },
                                {
                                  $gt: [
                                    "$$this.createdAt",
                                    "$$value.createdAt",
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                        "$$this",
                        "$$value",
                      ],
                    },
                  },
                },
                latest_maintenance_activity: {
                  $reduce: {
                    input: "$activities",
                    initialValue: null,
                    in: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$$this.activityType", "maintenance"] },
                            {
                              $or: [
                                { $eq: ["$$value", null] },
                                {
                                  $gt: [
                                    "$$this.createdAt",
                                    "$$value.createdAt",
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                        "$$this",
                        "$$value",
                      ],
                    },
                  },
                },
                latest_recall_activity: {
                  $reduce: {
                    input: "$activities",
                    initialValue: null,
                    in: {
                      $cond: [
                        {
                          $and: [
                            {
                              $or: [
                                { $eq: ["$$this.activityType", "recall"] },
                                { $eq: ["$$this.activityType", "recallment"] },
                              ],
                            },
                            {
                              $or: [
                                { $eq: ["$$value", null] },
                                {
                                  $gt: [
                                    "$$this.createdAt",
                                    "$$value.createdAt",
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                        "$$this",
                        "$$value",
                      ],
                    },
                  },
                },
              },
            }
          );
        }

        pipeline.push({ $project: constants.DEVICES_INCLUSION_PROJECTION });
        pipeline.push({
          $project: constants.DEVICES_EXCLUSION_PROJECTION("full"),
        });
      }

      const facetPipeline = [
        ...pipeline,
        {
          $facet: {
            paginatedResults: [
              { $sort: { [sortField]: sortOrder } },
              { $skip: _skip },
              { $limit: _limit },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ];

      const results = await DeviceModel(tenant)
        .aggregate(facetPipeline)
        .allowDiskUse(true);

      const paginatedResults = results[0].paginatedResults;
      const total = results[0].totalCount[0]
        ? results[0].totalCount[0].count
        : 0;

      // **CRITICAL FIX: Post-process for BOTH cached and non-cached results**
      if (!isEmpty(paginatedResults) && detailLevel === "full") {
        paginatedResults.forEach((device) => {
          // Process activities for non-cached (real-time) results
          if (useCache === "false" && device.activities) {
            if (device.activities.length > 0) {
              const activitiesByType = {};
              const latestActivitiesByType = {};

              device.activities.forEach((activity) => {
                const type = activity.activityType || "unknown";
                activitiesByType[type] = (activitiesByType[type] || 0) + 1;

                if (
                  !latestActivitiesByType[type] ||
                  new Date(activity.createdAt) >
                    new Date(latestActivitiesByType[type].createdAt)
                ) {
                  latestActivitiesByType[type] = activity;
                }
              });

              device.activities_by_type = activitiesByType;
              device.latest_activities_by_type = latestActivitiesByType;
            } else {
              device.activities_by_type = {};
              device.latest_activities_by_type = {};
            }
          }

          // **FIX: Ensure total_activities is set correctly for cached results**
          // This handles cases where projection might have modified the field
          if (useCache === "true") {
            // Ensure the field exists and has the right value
            if (
              device.total_activities === undefined ||
              device.total_activities === null
            ) {
              device.total_activities = device.cached_total_activities || 0;
            }

            // Ensure other cached fields are properly mapped
            if (
              !device.activities_by_type &&
              device.cached_activities_by_type
            ) {
              device.activities_by_type = device.cached_activities_by_type;
            }
            if (
              !device.latest_activities_by_type &&
              device.cached_latest_activities_by_type
            ) {
              device.latest_activities_by_type =
                device.cached_latest_activities_by_type;
            }
          }

          // **FIX: Process assigned_grid for BOTH cached and non-cached**
          if (device.assigned_grid && device.assigned_grid.length > 0) {
            const grid = device.assigned_grid[0];
            device.assigned_grid = {
              _id: grid._id,
              name: grid.name,
              admin_level: grid.admin_level,
              long_name: grid.long_name,
            };
          } else {
            device.assigned_grid = null;
          }
        });
      }

      const baseUrl =
        typeof request.protocol === "string" &&
        typeof request.get === "function" &&
        typeof request.originalUrl === "string"
          ? `${request.protocol}://${request.get("host")}${
              request.originalUrl.split("?")[0]
            }`
          : "";

      const meta = {
        total,
        totalResults: paginatedResults.length,
        limit: _limit,
        skip: _skip,
        page: Math.floor(_skip / _limit) + 1,
        totalPages: Math.ceil(total / _limit),
        detailLevel,
        usedCache: useCache === "true",
      };

      if (baseUrl) {
        const nextSkip = _skip + _limit;
        if (nextSkip < total) {
          const nextQuery = { ...request.query, skip: nextSkip, limit: _limit };
          meta.nextPage = `${baseUrl}?${qs.stringify(nextQuery)}`;
        }

        const prevSkip = _skip - _limit;
        if (prevSkip >= 0) {
          const prevQuery = { ...request.query, skip: prevSkip, limit: _limit };
          meta.previousPage = `${baseUrl}?${qs.stringify(prevQuery)}`;
        }
      }

      return {
        success: true,
        message: "successfully retrieved the device details",
        data: paginatedResults,
        status: httpStatus.OK,
        meta,
      };
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  clear: (request, next) => {
    return {
      success: false,
      message: "coming soon...",
      status: httpStatus.NOT_IMPLEMENTED,
      errors: { message: "coming soon" },
    };
  },
  createOnClarity: (request, next) => {
    return {
      message: "coming soon",
      success: false,
      status: httpStatus.NOT_IMPLEMENTED,
      errors: { message: "coming soon" },
    };
  },
  createOnPlatform: async (request, next) => {
    try {
      logText("createOnPlatform util....");
      const { tenant } = request.query;
      const { body } = request;

      try {
        const defaultCohort = await CohortModel(tenant)
          .findOne({ name: constants.DEFAULT_COHORT_NAME })
          .select("_id")
          .lean();
        if (defaultCohort) {
          // Initialize cohorts array if it doesn't exist
          if (!body.cohorts) {
            body.cohorts = [];
          }

          // Add airqo cohort if not already present
          const airqoCohortId = defaultCohort._id.toString();
          const existingCohortIds = body.cohorts.map((id) => String(id));

          if (!existingCohortIds.includes(airqoCohortId)) {
            body.cohorts.push(defaultCohort._id);
            logText(`Added device to default 'airqo' cohort: ${airqoCohortId}`);
          }
        } else {
          logText("💔 No default 'airqo' cohort found.");
          logger.warn(
            `💔 Default 'airqo' cohort not found in tenant: ${tenant}. Device will be created without default cohort.`
          );
        }
      } catch (cohortError) {
        logger.error(
          `🪲🪲 Error finding default cohort: ${cohortError.message}. Continuing with device creation.`
        );
        // Don't fail device creation if cohort lookup fails
      }

      const responseFromRegisterDevice = await DeviceModel(tenant).register(
        body,
        next
      );

      if (responseFromRegisterDevice.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          let deviceDataString = responseFromRegisterDevice.data
            ? JSON.stringify(responseFromRegisterDevice.data)
            : "";
          await kafkaProducer.send({
            topic: constants.DEVICES_TOPIC,
            messages: [
              {
                action: "create",
                value: deviceDataString,
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logObject("error on kafka", error);
        }

        return responseFromRegisterDevice;
      } else if (responseFromRegisterDevice.success === false) {
        return responseFromRegisterDevice;
      }
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createOnThingSpeak: async (request, next) => {
    try {
      const baseURL = constants.CREATE_THING_URL;
      const { body } = request;
      const { category } = body;
      let data = body;
      if (isEmpty(data.long_name) && !isEmpty(data.name)) {
        data.long_name = data.name;
      }
      const map = constants.DEVICE_THINGSPEAK_MAPPINGS;
      let context = {};
      if (category === "bam") {
        context = constants.BAM_THINGSPEAK_FIELD_DESCRIPTIONS;
      } else if (category === "gas") {
        context = constants.THINGSPEAK_GAS_FIELD_DESCRIPTIONS;
      } else {
        context = constants.THINGSPEAK_FIELD_DESCRIPTIONS;
      }

      // logger.info(`the context -- ${context}`);
      const responseFromTransformRequestBody = await deviceUtil.transform(
        {
          data,
          map,
          context,
        },
        next
      );
      // logger.info(
      //   `responseFromTransformRequestBody -- ${responseFromTransformRequestBody}`
      // );
      let transformedBody = responseFromTransformRequestBody.success
        ? responseFromTransformRequestBody.data
        : {};

      if (isEmpty(transformedBody)) {
        return {
          success: false,
          message: responseFromTransformRequestBody.message,
        };
      }
      return await axios
        .post(baseURL, transformedBody)
        .then((response) => {
          let writeKey = response.data.api_keys[0].write_flag
            ? response.data.api_keys[0].api_key
            : "";
          let readKey = !response.data.api_keys[1].write_flag
            ? response.data.api_keys[1].api_key
            : "";

          let newChannel = {
            device_number: `${response.data.id}`,
            writeKey: writeKey,
            readKey: readKey,
          };

          return {
            success: true,
            message: "successfully created the device on thingspeak",
            data: newChannel,
          };
        })
        .catch((error) => {
          if (error.response) {
            return {
              success: false,
              status: error.response.status
                ? error.response.status
                : parseInt(error.response.data.status),
              errors: {
                message: error.response.statusText
                  ? error.response.statusText
                  : error.response.data.error,
              },
            };
          } else {
            return {
              success: false,
              message: "Bad Gateway Error",
              status: httpStatus.BAD_GATEWAY,
              errors: {
                message:
                  "unable to create the device on thingspeak, crosscheck why",
              },
            };
          }
        });
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateOnThingspeak: async (request, next) => {
    try {
      // logger.info(`  updateOnThingspeak's request -- ${request}`);
      const { device_number } = request.query;
      logElement("device_number", device_number);
      const { body } = request;
      const config = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };
      const data = body;
      const map = constants.DEVICE_THINGSPEAK_MAPPINGS;
      const context = constants.THINGSPEAK_FIELD_DESCRIPTIONS;
      // logger.info(`the context -- ${context}`);
      const responseFromTransformRequestBody = await deviceUtil.transform(
        {
          data,
          map,
        },
        next
      );
      // logger.info(
      //   `responseFromTransformRequestBody -- ${responseFromTransformRequestBody}`
      // );
      let transformedBody = responseFromTransformRequestBody.success
        ? responseFromTransformRequestBody.data
        : {};

      // logger.info(`transformedBody -- ${transformedBody}`);

      const response = await axios.put(
        constants.UPDATE_THING(device_number),
        qs.stringify(transformedBody),
        config
      );

      // logger.info(`successfully updated the device on thingspeak`);
      return {
        success: true,
        message: "successfully updated the device on thingspeak",
        data: response.data,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateOnClarity: (request, next) => {
    return {
      success: false,
      message: "coming soon...",
      errors: { message: "coming soon" },
      status: httpStatus.NOT_IMPLEMENTED,
    };
  },
  updateOnPlatform: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { body } = request;
      const update = body;
      const filter = generateFilter.devices(request, next);

      // Find the device ID for logging before the update
      const device = await DeviceModel(tenant)
        .findOne(filter)
        .select("_id name")
        .lean();
      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      const trackingParams = {
        operation_type: "UPDATE",
        entity_type: "DEVICE",
        entity_id: device._id,
        tenant: tenant,
        source_function: "updateOnPlatform",
        metadata: {
          device_name: device.name,
          updated_fields: Object.keys(update),
        },
      };

      return await ActivityLogger.trackOperation(async () => {
        let opts = {};
        const responseFromModifyDevice = await DeviceModel(tenant).modify(
          {
            filter,
            update,
            opts,
          },
          next
        );
        return responseFromModifyDevice;
      }, trackingParams);
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateManyDevicesOnPlatform: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { deviceIds, updateData } = request.body;

      // Find existing devices
      const existingDevices = await DeviceModel(tenant)
        .find({
          _id: { $in: deviceIds },
        })
        .select("_id");

      // Create sets for comparison
      const existingDeviceIds = new Set(
        existingDevices.map((device) => device._id.toString())
      );
      const providedDeviceIds = new Set(deviceIds.map((id) => id.toString()));

      // Identify non-existent device IDs
      const nonExistentDeviceIds = deviceIds.filter(
        (id) => !existingDeviceIds.has(id.toString())
      );

      // If there are non-existent devices, prepare a detailed error
      if (nonExistentDeviceIds.length > 0) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "Some provided device IDs do not exist",
            nonExistentDeviceIds: nonExistentDeviceIds,
            existingDeviceIds: Array.from(existingDeviceIds),
            totalProvidedDeviceIds: deviceIds.length,
            existingDeviceCount: existingDevices.length,
          })
        );
      }

      // Prepare filter
      const filter = {
        _id: { $in: deviceIds },
      };

      // Additional filtering from generateFilter if needed
      const additionalFilter = generateFilter.devices(request, next);
      Object.assign(filter, additionalFilter);

      // Optimize options for bulk update
      const opts = {
        new: true,
        multi: true,
        runValidators: true,
        context: "query",
      };

      // Perform bulk update
      const responseFromBulkModifyDevices = await DeviceModel(
        tenant
      ).bulkModify(
        {
          filter,
          update: updateData,
          opts,
        },
        next
      );

      // Attach additional metadata to the response
      return {
        ...responseFromBulkModifyDevices,
        metadata: {
          totalDevicesUpdated: responseFromBulkModifyDevices.data.modifiedCount,
          requestedDeviceIds: deviceIds,
          existingDeviceIds: Array.from(existingDeviceIds),
        },
      };
    } catch (error) {
      logger.error(`🪲🪲 Bulk Update Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteOnThingspeak: async (request, next) => {
    try {
      let device_number = parseInt(request.query.device_number, 10);
      let response = await axios
        .delete(`${constants.DELETE_THING_URL(device_number)}`)
        .catch((e) => {
          logger.error(`error.response.data -- ${e.response.data}`);
          logger.error(`error.response.status -- ${e.response.status}`);
          logger.error(`error.response.headers -- ${e.response.headers}`);
          if (e.response) {
            next(
              new HttpError("Bad Request Error", e.response.data.status, {
                message:
                  "corresponding device_number does not exist on external system, consider SOFT delete",
                error: e.response.data.error,
              })
            );
          }
        });

      if (!isEmpty(response.success) && !response.success) {
        next(
          new HttpError(`${response.message}`, `${response.status}`, {
            message: "unable to complete operation",
            error: `${response.error}`,
          })
        );
      } else if (!isEmpty(response.data)) {
        return {
          success: true,
          message: "successfully deleted the device on thingspeak",
          data: response.data,
        };
      }
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteOnPlatform: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.devices(request, next);
      const responseFromRemoveDevice = await DeviceModel(tenant).remove(
        {
          filter,
        },
        next
      );
      return responseFromRemoveDevice;
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteOnclarity: (request, next) => {
    return {
      success: false,
      message: "coming soon",
      errors: { message: "coming soon..." },
      status: httpStatus.NOT_IMPLEMENTED,
    };
  },
  decryptManyKeys: (encryptedKeys, next) => {
    try {
      let results = [];
      function helper(helperInput) {
        if (helperInput.length === 0) {
          return;
        }
        const bytes = cryptoJS.AES.decrypt(
          helperInput[0].encrypted_key,
          constants.KEY_ENCRYPTION_KEY
        );
        const originalText = bytes.toString(cryptoJS.enc.Utf8);
        helperInput[0].decrypted_key = originalText;
        results.push(helperInput[0]);
        helper(helperInput.slice(1));
      }
      helper(encryptedKeys);
      return {
        success: true,
        message: "successfully decrypted the provided keys",
        data: results,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  decryptKey: (encryptedKey, next) => {
    try {
      let bytes = cryptoJS.AES.decrypt(
        encryptedKey,
        constants.KEY_ENCRYPTION_KEY
      );
      let originalText = bytes.toString(cryptoJS.enc.Utf8);
      let isKeyUnknown = isEmpty(originalText);
      if (isKeyUnknown) {
        return {
          success: false,
          status: httpStatus.NOT_FOUND,
          message: "the provided encrypted key is not recognizable",
          errors: { message: "the provided encrypted key is not recognizable" },
        };
      } else {
        return {
          success: true,
          message: "successfully decrypted the text",
          data: originalText,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  transform: ({ data = {}, map = {}, context = {} } = {}, next) => {
    try {
      const result = transform(data, map, context);
      if (!isEmpty(result)) {
        return {
          success: true,
          message: "successfully transformed the json request",
          data: result,
        };
      } else {
        logger.warn(
          `the request body for the external system is empty after transformation`
        );
        return {
          success: true,
          message:
            "the request body for the external system is empty after transformation",
          data: result,
        };
      }
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  refresh: async (request, next) => {
    try {
      return {
        success: false,
        message: "feature temporarily disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };

      let modifiedRequest = Object.assign({}, request);

      const filter = generateFilter.devices(request, next);
      const { tenant } = modifiedRequest.query;
      logObject("the filter being used to filter", filter);

      const responseFromListDevice = await DeviceModel(tenant).list(
        {
          filter,
        },
        next
      );

      if (responseFromListDevice.success === true) {
        let deviceDetails = { ...responseFromListDevice.data[0] };
        modifiedRequest["body"] = deviceDetails;
        delete modifiedRequest.body._id;
        delete modifiedRequest.body.sites;
      } else if (responseFromListDevice.success === false) {
        return responseFromListDevice;
      }

      if (
        !isEmpty(modifiedRequest["body"]["device_codes"]) &&
        modifiedRequest["body"]["device_codes"].length < 7
      ) {
        const deviceCodeValues = ["name_id", "name", "_id", "device_number"];

        for (const deviceCode of deviceCodeValues) {
          modifiedRequest["body"]["device_codes"].push(deviceCode);
          logObject("modifiedRequest is here baby", modifiedRequest);
        }
      }

      delete modifiedRequest["body"]["device_number"];

      const update = modifiedRequest["body"];
      const opts = {};

      const responseFromModifyDevice = await DeviceModel(tenant).modify(
        {
          filter,
          update,
          opts,
        },
        next
      );

      if (responseFromModifyDevice.success === true) {
        return {
          success: true,
          message: "Device Details Successfully Refreshed",
          data: responseFromModifyDevice.data,
        };
      } else if (responseFromModifyDevice.success === false) {
        return responseFromModifyDevice;
      }
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  claimDevice: async (request, next) => {
    try {
      const { device_name, claim_token, user_id, cohort_id } = request.body;
      const { tenant } = request.query;

      // Validate user_id
      if (!user_id || !isValidObjectId(user_id)) {
        throw new HttpError("Invalid user_id", httpStatus.BAD_REQUEST, {
          message: "user_id must be a valid MongoDB ObjectId",
        });
      }

      // Find unclaimed device
      const device = await DeviceModel(tenant).findOne({ name: device_name });

      if (!device) {
        throw new HttpError("Device not found", httpStatus.NOT_FOUND, {
          message: `Device ${device_name} does not exist`,
        });
      }

      // Validate device status for claiming
      if (device.claim_status !== "unclaimed") {
        throw new HttpError("Device already claimed", httpStatus.CONFLICT, {
          message: `Device ${device_name} is not available for claiming`,
        });
      }

      // Edge Case: Prevent claiming a device that is still considered deployed
      // MODIFICATION: Instead of throwing an error, we will now automatically recall the device.
      if (device.status === "deployed") {
        logText(
          `Device ${device_name} is currently deployed. Automatically recalling before claiming.`
        );
        await ActivityModel(tenant).create({
          activityType: "recall",
          device: device.name,
          device_id: device._id,
          date: new Date(),
          user_id: user_id, // The user initiating the claim is performing the recall
          description: "Device automatically recalled during claim operation.",
        });
        // Update the local device object to reflect the change for subsequent steps
        device.status = "recalled";
      }

      // Optional: Verify claim token if provided
      if (device.claim_token && device.claim_token !== claim_token) {
        throw new HttpError("Invalid claim token", httpStatus.FORBIDDEN, {
          message: "Claim token does not match",
        });
      }

      // Edge Case: Check for claim token expiry using moment-timezone
      // const timeZone = moment.tz.guess();
      // const now = moment.tz(timeZone).toDate();
      // Edge Case: Check for claim token expiry using UTC time for consistency
      const now = new Date();
      if (
        device.claim_token_expires_at &&
        now > device.claim_token_expires_at
      ) {
        throw new HttpError("Claim token has expired", httpStatus.GONE, {
          message:
            "This claim token has expired. Please contact support for a new one.",
        });
      }

      let targetCohort;

      if (cohort_id) {
        // Case A: A specific cohort is provided
        targetCohort = await CohortModel(tenant)
          .findById(cohort_id)
          .lean();

        if (!targetCohort) {
          throw new HttpError("Cohort not found", httpStatus.NOT_FOUND, {
            message: "The specified cohort does not exist",
          });
        }
      } else {
        // Case B: No cohort provided, use user's personal cohort
        const personalCohortName = `coh_user_${user_id.toString()}`;
        const safeNetwork = device.network || "airqo";

        targetCohort = await CohortModel(tenant).findOneAndUpdate(
          { name: personalCohortName },
          {
            $setOnInsert: {
              name: personalCohortName,
              description: `Personal cohort for user ${user_id.toString()}`,
              network: safeNetwork,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }

      // Atomically update the device, checking for race condition
      const updatedDevice = await DeviceModel(tenant).findOneAndUpdate(
        { _id: device._id, claim_status: "unclaimed" }, // Atomic check
        {
          $set: {
            owner_id: new ObjectId(user_id),
            claim_status: "claimed",
            claimed_at: new Date(),
            // Edge Case: Clean up previous deployment data on re-claim
            deployment_date: null,
            maintenance_date: null,
            recall_date: null,
          },
          $addToSet: { cohorts: targetCohort._id },
        },
        { new: true }
      );

      if (!updatedDevice) {
        throw new HttpError("Device already claimed", httpStatus.CONFLICT, {
          message: "Device may have been claimed by another user.",
        });
      }

      // Log the claim activity
      try {
        await ActivityModel(tenant).create({
          activityType: "claim",
          device: updatedDevice.name,
          device_id: updatedDevice._id,
          date: updatedDevice.claimed_at,
          user_id: updatedDevice.owner_id,
          description: `Device claimed by user ${user_id}`,
        });
      } catch (logError) {
        logger.error(`Failed to log claim activity: ${logError.message}`);
      }

      return {
        success: true,
        message: "Device claimed successfully!",
        data: updatedDevice,
        status: httpStatus.OK,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
      } else {
        logger.error(`🐛🐛 Claim Device Error ${error.message}`);
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      }
    }
  },
  bulkClaim: async (request, next) => {
    try {
      const { user_id, devices } = request.body;
      const { tenant } = request.query;

      if (!user_id || !isValidObjectId(user_id)) {
        throw new HttpError("Invalid user_id", httpStatus.BAD_REQUEST);
      }

      const results = {
        successful_claims: [],
        failed_claims: [],
      };

      // Batch fetch all devices by name to avoid N+1 queries
      const deviceNames = devices.map((d) => d.device_name);
      const deviceDocs = await DeviceModel(tenant).find({
        name: { $in: deviceNames },
      });
      const deviceMap = new Map(deviceDocs.map((d) => [d.name, d]));

      // Find or create the user's personal cohort once
      const firstDevice = deviceDocs[0];
      const personalCohortName = `coh_user_${user_id.toString()}`;
      const targetCohort = await CohortModel(tenant).findOneAndUpdate(
        { name: personalCohortName },
        {
          $setOnInsert: {
            name: personalCohortName,
            description: `Personal cohort for user ${user_id.toString()}`,
            network: firstDevice ? firstDevice.network || "airqo" : "airqo",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      for (const deviceToClaim of devices) {
        const { device_name, claim_token } = deviceToClaim;

        try {
          const device = deviceMap.get(device_name);

          if (!device) {
            throw new Error("Device not found");
          }

          if (device.claim_status !== "unclaimed") {
            throw new Error("Device already claimed or not available");
          }

          if (device.status === "deployed") {
            logText(
              `Device ${device_name} is currently deployed. Automatically recalling before bulk claiming.`
            );
            await ActivityModel(tenant).create({
              activityType: "recall",
              device: device.name,
              device_id: device._id,
              date: new Date(),
              user_id: user_id,
              description:
                "Device automatically recalled during bulk claim operation.",
            });
            device.status = "recalled"; // Update local state
          }

          if (device.claim_token && device.claim_token !== claim_token) {
            throw new Error("Invalid claim token");
          }

          const now = new Date();
          if (
            device.claim_token_expires_at &&
            now > device.claim_token_expires_at
          ) {
            throw new Error("Claim token has expired");
          }

          const updatedDevice = await DeviceModel(tenant).findOneAndUpdate(
            { _id: device._id, claim_status: "unclaimed" },
            {
              $set: {
                owner_id: new ObjectId(user_id),
                claim_status: "claimed",
                claimed_at: now,
                deployment_date: null,
                maintenance_date: null,
                recall_date: null,
              },
              $addToSet: { cohorts: targetCohort._id },
            },
            { new: true }
          );

          if (!updatedDevice) {
            throw new Error("Device may have been claimed by another user");
          }

          const successEntry = {
            device_name: updatedDevice.name,
            message: "Claimed successfully",
          };

          // Log activity for each successful claim (non-fatal on failure)
          try {
            await ActivityModel(tenant).create({
              activityType: "claim",
              device: updatedDevice.name,
              device_id: updatedDevice._id,
              date: updatedDevice.claimed_at,
              user_id: updatedDevice.owner_id,
              description: `Device claimed by user ${user_id} in bulk operation`,
            });
          } catch (logError) {
            logger.error(
              `Failed to log bulk claim activity for device ${updatedDevice.name}: ${logError.message}`
            );
            successEntry.logging_error = true;
          }

          results.successful_claims.push(successEntry);
        } catch (error) {
          results.failed_claims.push({
            device_name,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        message: "Bulk claim operation completed.",
        data: results,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Bulk Claim Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listOrphanedDevices: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, user_id } = query;

      if (!user_id) {
        return {
          success: false,
          message: "user_id is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id query parameter is missing" },
        };
      }

      if (!isValidObjectId(user_id)) {
        return {
          success: false,
          message: "Invalid user_id format",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id must be a valid MongoDB ObjectId" },
        };
      }

      const filter = {
        owner_id: new ObjectId(user_id),
        $or: [
          { cohorts: { $exists: true, $size: 0 } },
          { cohorts: { $exists: false } },
        ],
      };

      const responseFromListDevice = await DeviceModel(tenant).list(
        { filter },
        next
      );

      return responseFromListDevice;
    } catch (error) {
      logger.error(`🐛🐛 listOrphanedDevices Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  getIdFromName: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { name } = request.params;

      const device = await DeviceModel(tenant)
        .findOne({ name })
        .select("_id")
        .lean();

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Device with name '${name}' not found` },
        };
      }

      return {
        success: true,
        message: "Successfully retrieved device ID",
        data: { _id: device._id.toString() },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getNameFromId: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { id } = request.params;

      const device = await DeviceModel(tenant)
        .findById(id)
        .select("name")
        .lean();

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Device with ID '${id}' not found` },
        };
      }

      return {
        success: true,
        message: "Successfully retrieved device name",
        data: { name: device.name },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  suggestNames: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { name } = request.query;

      // STEP 1: Narrow the search space using an indexed-friendly query.
      // This finds names starting with the same first 3 characters.
      // NOTE: This is a pragmatic approach. For ultimate scalability,
      // consider a full-text search engine like Atlas Search.
      const searchRegex = new RegExp(`^${name.substring(0, 3)}`, "i");

      const candidateDevices = await DeviceModel(tenant)
        .find({ name: searchRegex })
        .select("name")
        .limit(500) // Protect against memory overload
        .lean();

      if (candidateDevices.length === 0) {
        return {
          success: true,
          message: "No similar device names found.",
          data: [],
          status: httpStatus.OK,
        };
      }

      const candidateNames = candidateDevices.map((device) => device.name);

      // STEP 2: Find the best match from the candidates using string similarity.
      const matches = stringSimilarity.findBestMatch(name, candidateNames);

      // Filter and sort the results to return the most relevant suggestions.
      const suggestions = matches.ratings
        .filter((match) => match.rating > 0.4) // Only include reasonably good matches
        .sort((a, b) => b.rating - a.rating) // Sort by best rating
        .slice(0, 5); // Return up to the top 5 suggestions

      return {
        success: true,
        message: "Successfully retrieved device name suggestions.",
        data: suggestions,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  getMyDevices: async (request, next) => {
    try {
      const { user_id, cohort_ids, group_ids } = request.query;
      const { tenant } = request.query;

      if (!user_id) {
        return {
          success: false,
          message: "user_id is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id parameter is missing" },
        };
      }

      if (!isValidObjectId(user_id)) {
        return {
          success: false,
          message: "Invalid user_id format",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id must be a valid MongoDB ObjectId" },
        };
      }

      const splitAndMapToObjectId = (ids) => {
        if (!ids) return { valid: true, data: [] };
        const idList = ids.split(",").map((id) => id.trim());
        const invalidId = idList.find((id) => !isValidObjectId(id));
        if (invalidId) {
          return {
            valid: false,
            message: `Invalid ID format: ${invalidId}`,
            status: httpStatus.BAD_REQUEST,
          };
        }
        return { valid: true, data: idList.map((id) => new ObjectId(id)) };
      };

      // 1. Get cohorts associated with the user's groups
      let groupCohorts = [];
      let groupObjectIds = [];
      if (group_ids) {
        const groupObjectIdsResult = splitAndMapToObjectId(group_ids);
        if (!groupObjectIdsResult.valid) {
          return { success: false, ...groupObjectIdsResult };
        }
        groupObjectIds = groupObjectIdsResult.data;
        const groups = await CohortModel(tenant)
          .find({ groups: { $in: groupObjectIds } })
          .select("_id")
          .lean();
        groupCohorts = groups.map((g) => g._id);
      }

      // 2. Combine all cohort IDs: direct user cohorts and group cohorts
      const directCohortIdsResult = splitAndMapToObjectId(cohort_ids);
      if (!directCohortIdsResult.valid) {
        return { success: false, ...directCohortIdsResult };
      }
      const directCohortIds = directCohortIdsResult.data;
      const allCohortIds = [...new Set([...directCohortIds, ...groupCohorts])];

      // 3. Build the comprehensive filter
      const filter = {
        $or: [
          // Devices directly owned by the user
          { owner_id: new ObjectId(user_id) },
        ],
      };

      if (allCohortIds.length > 0) {
        filter.$or.push({ cohorts: { $in: allCohortIds } });
      }

      // Deprecated: Also include devices assigned via the old organization model for backward compatibility
      if (group_ids) {
        filter.$or.push({ assigned_organization_id: { $in: groupObjectIds } });
        filter.$or.push({
          "assigned_organization.id": { $in: groupObjectIds },
        });
      }

      // Query devices with both organization fields
      const devices = await DeviceModel(tenant)
        .find(filter)
        .select(
          "name long_name status isActive deployment_date latitude longitude claim_status owner_id assigned_organization_id assigned_organization claimed_at"
        )
        .sort({ claimed_at: -1 })
        .lean();

      return {
        success: true,
        message: "Devices retrieved successfully",
        data: devices || [],
        status: httpStatus.OK,
        metadata: {
          note:
            "Device access is determined by direct ownership and cohort/group membership.",
        },
      };
    } catch (error) {
      logObject("Get My Devices Error Details:", error);
      logger.error(`🪲🪲 Get My Devices Error ${error.message}`);

      if (error.name === "CastError") {
        return {
          success: false,
          message: "Invalid ObjectId format",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "One or more IDs have invalid format" },
        };
      }

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  checkDeviceAvailability: async (request, next) => {
    try {
      const { deviceName } = request.params;
      const { tenant } = request.query;

      const device = await DeviceModel(tenant)
        .findOne({
          name: deviceName,
        })
        .select("claim_status owner_id");

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Device does not exist" },
        };
      }

      const isAvailable = device.claim_status === "unclaimed";

      return {
        success: true,
        message: isAvailable
          ? "Device available for claiming"
          : "Device already claimed",
        data: {
          available: isAvailable,
          status: device.claim_status,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Check Device Availability Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assignDeviceToOrganization: async (request, next) => {
    try {
      const {
        device_name,
        organization_id,
        user_id,
        organization_data,
      } = request.body;
      const { tenant } = request.query;

      if (!user_id || !isValidObjectId(user_id)) {
        return {
          success: false,
          message: "Invalid user_id",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id must be a valid MongoDB ObjectId" },
        };
      }

      if (!organization_id || !isValidObjectId(organization_id)) {
        return {
          success: false,
          message: "Invalid organization_id",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "organization_id must be a valid MongoDB ObjectId",
          },
        };
      }

      // Verify user owns the device
      const device = await DeviceModel(tenant).findOne({
        name: device_name,
        owner_id: new ObjectId(user_id),
      });

      if (!device) {
        return {
          success: false,
          message: "Device not found or not owned by user",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Cannot assign device you don't own" },
        };
      }

      // Update device with both organization fields
      const updateData = {
        assigned_organization_id: new ObjectId(organization_id),
        assigned_organization: {
          id: new ObjectId(organization_id),
          name: organization_data?.name || null,
          type: organization_data?.type || null,
          updated_at: new Date(),
        },
        organization_assigned_at: new Date(),
      };

      const updatedDevice = await DeviceModel(tenant).findOneAndUpdate(
        { name: device_name, owner_id: new ObjectId(user_id) },
        { $set: updateData },
        { new: true }
      );

      return {
        success: true,
        message: "Device assigned to organization successfully",
        data: {
          name: updatedDevice.name,
          assigned_organization_id: updatedDevice.assigned_organization_id,
          assigned_organization: updatedDevice.assigned_organization,
          organization_assigned_at: updatedDevice.organization_assigned_at,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Assign Device Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  generateClaimQRCode: async (request, next) => {
    try {
      const { deviceName } = request.params;
      const { tenant } = request.query;
      const { include_token = false } = request.query;

      // Verify device exists
      const device = await DeviceModel(tenant)
        .findOne({
          name: deviceName,
        })
        .select("name long_name claim_status claim_token");

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Device does not exist" },
        };
      }

      // Generate QR code data
      const baseUrl = constants.DEPLOYMENT_URL || "https://platform.airqo.net";
      const qrData = {
        device_id: device.name,
        device_name: device.long_name || device.name,
        claim_url: `${baseUrl}/claim-device?id=${device.name}`,
        platform: "AirQo",
        tenant: tenant,
        generated_at: new Date().toISOString(),
      };

      // Include claim token if requested and device has one
      if (include_token === "true" && device.claim_token) {
        qrData.token = device.claim_token;
        qrData.claim_url += `&token=${device.claim_token}`;
      }

      const qrDataString = JSON.stringify(qrData);

      // Generate QR code image buffer
      const qrImageBuffer = await QRCode.toBuffer(qrDataString, {
        type: "png",
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      return {
        success: true,
        message: "QR code generated successfully",
        data: {
          device_name: device.name,
          qr_code_data: qrData,
          qr_code_url: qrData.claim_url,
        },
        qr_image_buffer: qrImageBuffer,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Generate QR Code Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  migrateDevicesForClaiming: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { dry_run = false, batch_size = 100 } = request.body;

      logger.info(`Starting device migration for tenant: ${tenant}`);

      if (dry_run) {
        const devicesNeedingMigration = await DeviceModel(
          tenant
        ).countDocuments({
          claim_status: { $exists: false },
        });

        return {
          success: true,
          message: "Dry run completed",
          data: {
            devices_needing_migration: devicesNeedingMigration,
            would_be_updated: devicesNeedingMigration,
            dry_run: true,
          },
          status: httpStatus.OK,
        };
      }

      // Actual migration - clear both organization fields
      const migrationResult = await DeviceModel(tenant).updateMany(
        {
          claim_status: { $exists: false },
        },
        {
          $set: {
            claim_status: "unclaimed",
            owner_id: null,
            claimed_at: null,
            claim_token: null,
            assigned_organization_id: null,
            assigned_organization: null,
            organization_assigned_at: null,
          },
        }
      );

      // Rest of the migration logic remains the same...
      const { generate_tokens = false } = request.body;
      let tokenGenerationResult = null;

      if (generate_tokens) {
        const devicesNeedingTokens = await DeviceModel(tenant)
          .find({
            claim_token: null,
            claim_status: "unclaimed",
          })
          .limit(batch_size);

        let tokensGenerated = 0;
        for (const device of devicesNeedingTokens) {
          const claimToken = claimTokenUtil.generateClaimToken();
          await DeviceModel(tenant).updateOne(
            { _id: device._id },
            { $set: { claim_token: claimToken } }
          );
          tokensGenerated++;
        }

        tokenGenerationResult = {
          tokens_generated: tokensGenerated,
          batch_processed: devicesNeedingTokens.length,
        };
      }

      logger.info(
        `Migration completed. Updated ${migrationResult.modifiedCount} devices.`
      );

      return {
        success: true,
        message: "Device migration completed successfully",
        data: {
          devices_updated: migrationResult.modifiedCount,
          devices_matched: migrationResult.matchedCount,
          token_generation: tokenGenerationResult,
          tenant: tenant,
          migration_completed_at: new Date(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Migration Error ${error.message}`);
      next(
        new HttpError("Migration Failed", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
  switchOrganizationContext: async (request, next) => {
    try {
      const { organization_id } = request.params;
      const { user_id } = request.body;

      // Use organization utility for validation and context switching
      const result = await organizationUtil.switchOrganizationContext(
        {
          user_id,
          organization_id,
        },
        next
      );

      return result;
    } catch (error) {
      logger.error(`🪲🪲 Switch Context Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getUserOrganizations: async (request, next) => {
    try {
      const { user_id } = request.query;

      if (!user_id || !isValidObjectId(user_id)) {
        return {
          success: false,
          message: "Invalid user_id",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const result = await organizationUtil.getUserOrganizations(user_id);

      return {
        success: result.success,
        message: result.message,
        data: result.data,
        status: result.success ? httpStatus.OK : httpStatus.BAD_REQUEST,
      };
    } catch (error) {
      logger.error(`🪲🪲 Get User Organizations Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  prepareDeviceForShipping: async (request, next) => {
    try {
      const { device_name, token_type = "hex" } = request.body;
      const { tenant } = request.query;

      let deviceId;
      // Check if device exists
      const device = await DeviceModel(tenant).findOne({ name: device_name });

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Device ${device_name} does not exist` },
        };
      }
      deviceId = device._id;

      // Prevent preparing a device that is currently deployed
      if (device.status === "deployed") {
        return {
          success: false,
          message:
            "Device is currently deployed and cannot be prepared for shipping",
          status: httpStatus.CONFLICT,
          errors: {
            message: "Recall the device before preparing it for shipping.",
          },
        };
      }

      // Generate claim token based on type
      const claimToken =
        token_type === "readable"
          ? claimTokenUtil.generateReadableToken()
          : claimTokenUtil.generateClaimToken();

      // Update device with claim token and shipping status
      const updatedDevice = await DeviceModel(tenant).findOneAndUpdate(
        { name: device_name },
        {
          $set: {
            claim_status: "unclaimed",
            claim_token: claimToken,
            owner_id: null,
            claimed_at: null,
            shipping_prepared_at: new Date(),
          },
        },
        { new: true }
      );

      // Generate QR code data
      const qrCodeData = claimTokenUtil.generateQRCodeData(
        device_name,
        claimToken,
        constants.DEPLOYMENT_URL
      );

      // Generate QR code image
      const qrCodeImage = await QRCode.toDataURL(JSON.stringify(qrCodeData), {
        type: "image/png",
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      // Generate printable label data
      const labelData = claimTokenUtil.generateDeviceLabelData(
        device_name,
        claimToken,
        qrCodeData
      );

      return {
        success: true,
        message: "Device prepared for shipping successfully",
        data: {
          device_id: deviceId,
          device_name: device_name,
          claim_token: claimToken,
          token_type: token_type,
          qr_code_data: qrCodeData,
          qr_code_image: qrCodeImage,
          label_data: labelData,
          shipping_prepared_at: updatedDevice.shipping_prepared_at,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Prepare Device Shipping Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  prepareBulkDevicesForShipping: async (request, next) => {
    try {
      const { device_names, token_type = "hex", batch_name } = request.body;
      const { tenant } = request.query;

      if (!Array.isArray(device_names) || device_names.length === 0) {
        return {
          success: false,
          message: "device_names must be a non-empty array",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Provide array of device names to prepare" },
        };
      }

      const results = [];
      const successful = [];
      const failed = [];

      for (const deviceName of device_names) {
        try {
          // Prepare each device individually
          const deviceRequest = {
            body: { device_name: deviceName, token_type },
            query: { tenant },
          };

          const result = await deviceUtil.prepareDeviceForShipping(
            deviceRequest,
            next
          );

          if (result.success) {
            successful.push(result.data);
          } else {
            failed.push({
              device_name: deviceName,
              error: result.message || result.errors?.message,
            });
          }
        } catch (error) {
          failed.push({
            device_name: deviceName,
            error: error.message,
          });
        }
      }

      // If a batch_name is provided, create a shipping batch record
      if (batch_name && successful.length > 0) {
        const successfulDeviceIds = successful.map((d) => d.device_id);
        try {
          await ShippingBatchModel(tenant).create({
            batch_name,
            devices: successfulDeviceIds,
            device_names: successful.map((d) => d.device_name),
            tenant,
            // created_by: request.user._id // Assuming user is available in request
          });
          logText(`📦 Shipping batch '${batch_name}' created successfully.`);
        } catch (batchError) {
          logText(
            `❗ Failed to create shipping batch '${batch_name}': ${batchError.message}`
          );
          logObject("Batch creation error details", batchError);
        }
      }

      return {
        success: true,
        message: `Bulk preparation completed: ${successful.length} successful, ${failed.length} failed`,
        data: {
          successful_preparations: successful,
          failed_preparations: failed,
          summary: {
            total_requested: device_names.length,
            successful_count: successful.length,
            failed_count: failed.length,
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Bulk Prepare Devices Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listShippingBatches: async (request, next) => {
    try {
      const { tenant } = request.query;
      const MAX_LIMIT =
        Number(constants.DEFAULT_LIMIT_FOR_QUERYING_DEVICES) || 1000;
      const _skip = Math.max(0, parseInt(request.query.skip, 10) || 0);
      const _limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(request.query.limit, 10) || MAX_LIMIT)
      );

      const batches = await ShippingBatchModel(tenant)
        .find({})
        .sort({ createdAt: -1 })
        .skip(_skip)
        .limit(_limit)
        .lean();

      const total = await ShippingBatchModel(tenant).countDocuments({});

      const baseUrl =
        typeof request.protocol === "string" &&
        typeof request.get === "function" &&
        typeof request.originalUrl === "string"
          ? `${request.protocol}://${request.get("host")}${
              request.originalUrl.split("?")[0]
            }`
          : "";

      const meta = {
        total,
        limit: _limit, // Use sanitized value
        skip: _skip, // Use sanitized value
        page: Math.floor(_skip / _limit) + 1, // Correct page calculation
        totalPages: Math.ceil(total / _limit),
      };

      if (baseUrl) {
        const nextSkip = _skip + _limit;
        if (nextSkip < total) {
          meta.nextPage = `${baseUrl}?skip=${nextSkip}&limit=${_limit}`;
        }
      }

      return {
        success: true,
        message: "Shipping batches retrieved successfully",
        data: batches.map((batch) => {
          return {
            _id: batch._id,
            batch_name: batch.batch_name,
            device_count: Array.isArray(batch.devices)
              ? batch.devices.length
              : 0,
            createdAt: batch.createdAt,
            updatedAt: batch.updatedAt,
          };
        }),
        meta,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 List Shipping Batches Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getShippingBatchDetails: async (request, next) => {
    try {
      const { id } = request.params;
      const { tenant } = request.query;

      if (!isValidObjectId(id)) {
        return next(
          new HttpError("Invalid batch ID format", httpStatus.BAD_REQUEST)
        );
      }

      // Step 1: Fetch the batch document. Devices will be populated manually.
      const batch = await ShippingBatchModel(tenant)
        .findById(id)
        .lean();

      if (!batch) {
        return next(
          new HttpError("Shipping batch not found", httpStatus.NOT_FOUND)
        );
      }

      // Step 2: Manually "populate" the devices to preserve order and track missing ones.
      if (batch.devices && batch.devices.length > 0) {
        const requestedDeviceIds = batch.devices;

        const deviceDetails = await DeviceModel(tenant)
          .find({ _id: { $in: requestedDeviceIds } })
          .select("name long_name claim_status status claim_token createdAt")
          .lean();

        // Create a map for efficient, order-preserving lookup.
        const deviceMap = new Map(
          deviceDetails.map((d) => [d._id.toString(), d])
        );

        const orderedDevices = [];
        const missingDeviceIds = [];

        requestedDeviceIds.forEach((id) => {
          const device = deviceMap.get(id.toString());
          if (device) {
            orderedDevices.push(device);
          } else {
            missingDeviceIds.push(id.toString());
          }
        });

        // Step 3: Replace the array of ObjectIds with the ordered array of found device documents.
        batch.devices = orderedDevices;

        if (missingDeviceIds.length > 0) {
          logger.warn(
            `⚠️ Batch ${id}: ${missingDeviceIds.length} device references were not found in the database.`
          );
          batch.missing_device_count = missingDeviceIds.length;
          batch.missing_device_ids = missingDeviceIds;
        }
      }

      return {
        success: true,
        message: "Shipping batch details retrieved successfully",
        data: batch,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Get Shipping Batch Details Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  transferDevice: async (request, next) => {
    try {
      const {
        device_name,
        from_user_id,
        to_user_id,
        include_deployment_history = false,
      } = request.body;
      const { tenant } = request.query;

      // Step 1: Initial read to get device state for cohort and site history.
      const deviceToTransfer = await DeviceModel(tenant).findOne({
        name: device_name,
        owner_id: from_user_id,
      });

      if (!deviceToTransfer) {
        throw new HttpError(
          "Device not found or you are not the owner",
          httpStatus.FORBIDDEN
        );
      }

      // Step 2: Verify device is recalled (not actively deployed).
      if (deviceToTransfer.status === "deployed") {
        throw new HttpError(
          "Device must be recalled before transfer",
          httpStatus.CONFLICT
        );
      }

      // Step 3: Prepare cohort and activity data BEFORE the main update.
      const recipientCohortName = `coh_user_${to_user_id.toString()}`;
      const recipientCohort = await CohortModel(tenant).findOneAndUpdate(
        { name: recipientCohortName },
        {
          $setOnInsert: {
            name: recipientCohortName,
            description: `Personal cohort for user ${to_user_id.toString()}`,
            network: deviceToTransfer.network || "airqo",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const previousOwnerCohort = await CohortModel(tenant)
        .findOne({ name: `coh_user_${from_user_id.toString()}` })
        .select("_id")
        .lean();

      // Step 4: Create a 'pending' activity log.
      const pendingActivity = await ActivityModel(tenant).create({
        activityType: "transfer",
        device: device_name,
        device_id: deviceToTransfer._id,
        from_user_id,
        to_user_id,
        date: new Date(),
        description: `Pending transfer from user ${from_user_id} to user ${to_user_id}`,
        status: "pending", // Add a status field
      });

      // Step 5: Prepare the atomic device update operation.
      const updates = {
        $set: {
          owner_id: to_user_id,
          claimed_at: new Date(),
          transferred_at: new Date(),
          previous_owner: from_user_id,
        },
        $addToSet: { cohorts: recipientCohort._id },
      };

      if (previousOwnerCohort) {
        updates.$pull = { cohorts: previousOwnerCohort._id };
      }

      if (include_deployment_history === false) {
        updates.$unset = {
          deployment_date: "",
          maintenance_date: "",
          recall_date: "",
          previous_sites: "",
        };
        if (
          deviceToTransfer.previous_sites &&
          deviceToTransfer.previous_sites.length > 0
        ) {
          const existingArchived = deviceToTransfer.archived_sites || [];
          updates.$set.archived_sites = [
            ...existingArchived,
            ...deviceToTransfer.previous_sites,
          ];
        }
      }

      // Step 6: Execute the atomic device transfer. This is the critical step.
      const transferredDevice = await DeviceModel(tenant).findOneAndUpdate(
        { _id: deviceToTransfer._id, owner_id: from_user_id },
        updates,
        { new: true }
      );

      // Step 7: Handle the outcome of the critical step.
      if (!transferredDevice) {
        // If the transfer failed, attempt to clean up the pending activity log.
        await ActivityModel(tenant).deleteOne({ _id: pendingActivity._id });
        throw new HttpError(
          "Device transfer failed. Ownership may have changed during the operation.",
          httpStatus.CONFLICT
        );
      }

      // Step 8: Finalize the activity log.
      try {
        await ActivityModel(tenant).findByIdAndUpdate(pendingActivity._id, {
          $set: {
            status: "completed",
            description: `Device transferred from user ${from_user_id} to user ${to_user_id}`,
          },
        });
      } catch (logError) {
        // If this fails, the transfer is already done. Log this for manual review.
        logger.error(
          `CRITICAL: Device ${device_name} was transferred, but failed to update activity log ${pendingActivity._id} to 'completed'. Error: ${logError.message}`
        );
      }

      return {
        success: true,
        message: "Device transferred successfully",
        data: transferredDevice,
        status: httpStatus.OK,
      };
    } catch (error) {
      // Let the controller handle the error propagation.
      if (error instanceof HttpError) {
        throw error;
      }
      logger.error(`🪲🪲 Device Transfer Error: ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },

  /**
   * Get shipping preparation status for devices.
   *
   * This endpoint retrieves devices that have been prepared for shipping, supporting both
   * legacy devices (identified by claim_token) and new devices (identified by shipping_prepared_at).
   *
   * @param {Object} request - Express request object
   * @param {Object} request.query - Query parameters
   * @param {string|string[]} [request.query.device_names] - Optional device name(s) to query.
   *        Can be a single name, comma-separated string, or array of names.
   * @param {boolean|string} [request.query.include_qr=false] - Whether to generate QR codes.
   *        Accepts boolean or "true"/"false" string. QR generation is CPU-intensive.
   * @param {boolean|string} [request.query.include_labels=false] - Whether to generate label data.
   *        Accepts boolean or "true"/"false" string.
   * @param {string} [request.query.mode='all'] - Filter mode for device preparation status:
   *        - 'all' (default): Returns devices prepared by either method (recommended)
   *        - 'strict': Only devices with shipping_prepared_at field
   *        - 'legacy': Only devices with claim_token (old preparation method)
   * @param {string} request.query.tenant - Tenant identifier for multi-tenant data isolation
   * @param {Function} next - Express next middleware function
   *
   * @returns {Promise<Object>} Result object with structure:
   *   {
   *     success: boolean,
   *     message: string,
   *     data: {
   *       devices: Array<Device>,
   *       summary: { total_devices, prepared_for_shipping, claimed_devices, deployed_devices, legacy_devices },
   *       categorized: { prepared_for_shipping, claimed_devices, deployed_devices, legacy_devices },
   *       metadata: { query_timestamp, qr_codes_included, labels_included, query_mode, ... }
   *     },
   *     status: number
   *   }
   *
   * @example
   * // Get all prepared devices (fast, no QR generation)
   * GET /api/v2/devices/shipping-status?tenant=airqo
   *
   * @example
   * // Get specific devices with QR codes for printing
   * GET /api/v2/devices/shipping-status?device_names=device1,device2&include_qr=true&include_labels=true
   *
   * @example
   * // Get only legacy devices
   * GET /api/v2/devices/shipping-status?mode=legacy
   */
  getShippingPreparationStatus: async (request, next) => {
    try {
      const { device_names, include_qr, include_labels, mode } = request.query;
      const { tenant } = request.query;

      // Parse boolean flags with backward compatibility
      const shouldIncludeQR = include_qr === "true" || include_qr === true;
      const shouldIncludeLabels =
        include_labels === "true" || include_labels === true;
      const queryMode = mode || "all"; // "all", "strict", or "legacy"

      let filter = {};

      if (device_names) {
        // When specific devices are requested, filter by name only
        // NOTE: This returns devices regardless of preparation status to allow status checking
        const deviceNameArray = Array.isArray(device_names)
          ? device_names
          : device_names.split(",").map((name) => name.trim());

        if (deviceNameArray.length === 0) {
          return {
            success: false,
            message: "Invalid device_names parameter",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "device_names cannot be empty" },
          };
        }

        filter.name = { $in: deviceNameArray };
        logText(
          `🔍 [SHIPPING-STATUS] Querying specific devices: ${deviceNameArray.join(
            ", "
          )}`
        );
      } else {
        // When NO specific devices, use flexible preparation filters
        // This is the KEY FIX - use $or to handle both legacy and new devices

        switch (queryMode) {
          case "strict":
            // Only devices with shipping_prepared_at (new method)
            filter.shipping_prepared_at = { $exists: true, $ne: null };
            logText(
              "📦 [SHIPPING-STATUS] Query mode: STRICT - Only devices with shipping_prepared_at"
            );
            break;

          case "legacy":
            // Only devices with claim_token (old method)
            filter.claim_token = { $exists: true, $ne: null };
            filter.claim_status = "unclaimed";
            logText(
              "📦 [SHIPPING-STATUS] Query mode: LEGACY - Only devices with claim_token"
            );
            break;

          case "all":
          default:
            // ✅ BEST PRACTICE: Accept devices prepared by EITHER method
            filter.$or = [
              // New method: Has shipping_prepared_at
              { shipping_prepared_at: { $exists: true, $ne: null } },
              // Legacy method: Has claim_token and is unclaimed
              {
                claim_token: { $exists: true, $ne: null },
                claim_status: "unclaimed",
              },
            ];
            logText(
              "📦 [SHIPPING-STATUS] Query mode: ALL - Devices prepared by any method (recommended)"
            );
            break;
        }
      }

      logObject("🔍 [SHIPPING-STATUS] Final filter:", filter);

      // Fetch devices from database
      // Note: Sort will be done after legacy device inference for accuracy
      const devices = await DeviceModel(tenant)
        .find(filter)
        .select(
          "name long_name claim_status claim_token shipping_prepared_at owner_id claimed_at status createdAt tenant"
        )
        .lean()
        .exec();

      logText(
        `📦 [SHIPPING-STATUS] Found ${devices.length} devices matching filter`
      );

      // Early return if no devices found
      if (devices.length === 0) {
        return {
          success: true,
          message: device_names
            ? "Specified devices not found"
            : "No devices found prepared for shipping",
          data: {
            devices: [],
            summary: {
              total_devices: 0,
              prepared_for_shipping: 0,
              claimed_devices: 0,
              deployed_devices: 0,
              legacy_devices: 0,
            },
            categorized: {
              prepared_for_shipping: [],
              claimed_devices: [],
              deployed_devices: [],
              legacy_devices: [],
            },
            metadata: {
              query_timestamp: new Date().toISOString(),
              query_mode: queryMode,
              specific_devices_requested: !!device_names,
              qr_codes_included: shouldIncludeQR,
              labels_included: shouldIncludeLabels,
              tenant: tenant,
            },
          },
          status: httpStatus.OK,
        };
      }

      // ✅ ENHANCEMENT: Infer shipping_prepared_at for legacy devices
      // NOTE: This is for display purposes only - not persisted to database
      // The inferred date helps with sorting and display consistency
      devices.forEach((device) => {
        if (!device.shipping_prepared_at && device.claim_token) {
          // For legacy devices, infer preparation date from createdAt
          device.shipping_prepared_at = device.createdAt || new Date();
          device.is_legacy_device = true; // Changed from _is_legacy_device (no underscore prefix)
          device.preparation_date_inferred = true; // Explicit flag that this is derived
          logText(
            `ℹ️  [SHIPPING-STATUS] Legacy device detected: ${device.name} (inferred preparation date from createdAt)`
          );
        }
      });

      // ✅ IMPROVEMENT: Sort AFTER inference for accurate ordering
      // This ensures legacy devices with inferred dates sort correctly
      devices.sort((a, b) => {
        const aDate = a.shipping_prepared_at
          ? new Date(a.shipping_prepared_at)
          : a.createdAt
          ? new Date(a.createdAt)
          : new Date(0);
        const bDate = b.shipping_prepared_at
          ? new Date(b.shipping_prepared_at)
          : b.createdAt
          ? new Date(b.createdAt)
          : new Date(0);
        return bDate - aDate; // Descending order (newest first)
      });

      // ✅ OPTIMIZATION: Only generate QR/labels if requested
      let enhancedDevices = devices;
      const enhancementErrors = [];
      const enhancementSkipped = [];

      if (shouldIncludeQR || shouldIncludeLabels) {
        logText(
          `🎨 [SHIPPING-STATUS] Generating ${
            shouldIncludeQR ? "QR codes" : ""
          } ${shouldIncludeLabels ? "labels" : ""} for ${
            devices.length
          } devices...`
        );

        // Native batch processing to control concurrency without external libraries
        const BATCH_SIZE = 10;
        for (let i = 0; i < devices.length; i += BATCH_SIZE) {
          const batch = devices.slice(i, i + BATCH_SIZE);
          const processedBatch = await Promise.all(
            batch.map(async (device) => {
              try {
                // Validate claim_token exists
                if (!device.claim_token) {
                  const skipInfo = {
                    device_name: device.name,
                    reason: "No claim token available",
                  };
                  enhancementSkipped.push(skipInfo);
                  logText(
                    `⚠️  [SHIPPING-STATUS] Device ${device.name} has no claim_token, skipping enhancement`
                  );
                  return {
                    ...device,
                    qr_generation_skipped: true,
                    qr_generation_reason: "No claim token available",
                  };
                }

                const enhancedDevice = { ...device };

                // Generate QR code data (needed for both QR and labels)
                const qrCodeData = claimTokenUtil.generateQRCodeData(
                  device.name,
                  device.claim_token,
                  constants.DEPLOYMENT_URL
                );

                // Generate QR code image if requested
                if (shouldIncludeQR) {
                  const qrCodeImage = await QRCode.toDataURL(
                    JSON.stringify(qrCodeData),
                    {
                      type: "image/png",
                      width: 256,
                      margin: 2,
                      color: {
                        dark: "#000000",
                        light: "#FFFFFF",
                      },
                      errorCorrectionLevel: "M",
                    }
                  );
                  enhancedDevice.qr_code_image = qrCodeImage;
                  enhancedDevice.qr_code_data = qrCodeData;
                }

                // Generate label data if requested
                if (shouldIncludeLabels) {
                  const labelData = claimTokenUtil.generateDeviceLabelData(
                    device.name,
                    device.claim_token,
                    qrCodeData
                  );
                  enhancedDevice.label_data = labelData;
                }

                return enhancedDevice;
              } catch (error) {
                // ✅ RESILIENCE: Don't fail entire request if one device fails
                const errorInfo = {
                  device_name: device.name,
                  error: error.message,
                };
                enhancementErrors.push(errorInfo);
                logger.error(
                  `❌ [SHIPPING-STATUS] Error enhancing device ${device.name}: ${error.message}`
                );
                return {
                  ...device,
                  qr_generation_failed: true,
                  qr_generation_error: error.message,
                };
              }
            })
          );
          enhancedDevices.push(...processedBatch);
        }

        logText(
          `✅ [SHIPPING-STATUS] Successfully processed ${enhancedDevices.length} devices`
        );
      }

      // Categorize devices by status
      const prepared = enhancedDevices.filter(
        (d) => d.claim_status === "unclaimed" && d.claim_token
      );
      const claimed = enhancedDevices.filter(
        (d) => d.claim_status === "claimed"
      );
      const deployed = enhancedDevices.filter((d) => d.status === "deployed");
      const legacy = enhancedDevices.filter((d) => d.is_legacy_device);

      // ✅ ENHANCEMENT: Response metadata with error tracking
      const responseMetadata = {
        query_timestamp: new Date().toISOString(),
        qr_codes_included: shouldIncludeQR,
        labels_included: shouldIncludeLabels,
        filter_applied: device_names
          ? "specific_devices"
          : "all_prepared_devices",
        query_mode: queryMode,
        legacy_devices_count: legacy.length,
        tenant: tenant,
        // ✅ ERROR TRACKING: Statistics for QR/label generation issues
        qr_generation_errors: enhancementErrors.length,
        qr_generation_skipped: enhancementSkipped.length,
        note:
          legacy.length > 0
            ? "Some devices use legacy preparation method (claim_token only). Their preparation dates are inferred from createdAt."
            : "All devices use current preparation method",
      };

      // Include error details if any failures occurred
      if (enhancementErrors.length > 0) {
        responseMetadata.enhancement_errors = enhancementErrors;
        logText(
          `⚠️  [SHIPPING-STATUS] ${enhancementErrors.length} devices failed QR/label generation`
        );
      }

      if (enhancementSkipped.length > 0) {
        responseMetadata.enhancement_skipped = enhancementSkipped;
        logText(
          `ℹ️  [SHIPPING-STATUS] ${enhancementSkipped.length} devices skipped (no claim token)`
        );
      }

      return {
        success: true,
        message: "Shipping preparation status retrieved successfully",
        data: {
          devices: enhancedDevices,
          summary: {
            total_devices: enhancedDevices.length,
            prepared_for_shipping: prepared.length,
            claimed_devices: claimed.length,
            deployed_devices: deployed.length,
            legacy_devices: legacy.length,
          },
          categorized: {
            prepared_for_shipping: prepared,
            claimed_devices: claimed,
            deployed_devices: deployed,
            legacy_devices: legacy, // ✅ Include legacy devices array for consistency
          },
          metadata: responseMetadata,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛 [SHIPPING-STATUS] Internal error: ${error.message}`);
      logObject("[SHIPPING-STATUS] Error details:", error);

      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
            context: "getShippingPreparationStatus",
            timestamp: new Date().toISOString(),
          }
        )
      );
    }
  },
  generateShippingLabels: async (request, next) => {
    try {
      const { device_names } = request.body;
      const { tenant } = request.query;

      const devices = await DeviceModel(tenant)
        .find({
          name: { $in: device_names },
          claim_token: { $exists: true, $ne: null },
        })
        .select("name long_name claim_token")
        .lean();

      if (devices.length === 0) {
        return {
          success: false,
          message: "No prepared devices found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Devices not found or not prepared for shipping" },
        };
      }

      const labels = [];

      for (const device of devices) {
        const qrCodeData = claimTokenUtil.generateQRCodeData(
          device.name,
          device.claim_token,
          constants.DEPLOYMENT_URL
        );

        const labelData = claimTokenUtil.generateDeviceLabelData(
          device.name,
          device.claim_token,
          qrCodeData
        );

        // Generate QR code image for printing
        const qrCodeImage = await QRCode.toDataURL(JSON.stringify(qrCodeData), {
          width: 200,
          margin: 1,
        });

        labels.push({
          ...labelData,
          qr_code_image: qrCodeImage,
          device_long_name: device.long_name,
        });
      }

      return {
        success: true,
        message: "Shipping labels generated successfully",
        data: {
          labels: labels,
          total_labels: labels.length,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Generate Shipping Labels Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getMobileDevicesMetadataAnalysis: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;

      // Get all devices (both mobile and static) for comprehensive analysis
      const allDevices = await DeviceModel(tenant).aggregate([
        {
          $lookup: {
            from: "activities",
            let: { deviceName: "$name" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$device", "$$deviceName"] },
                      { $eq: ["$activityType", "deployment"] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "latest_deployment",
          },
        },
        {
          $lookup: {
            from: "sites",
            localField: "site_id",
            foreignField: "_id",
            as: "site",
          },
        },
        {
          $lookup: {
            from: "grids",
            localField: "grid_id",
            foreignField: "_id",
            as: "grid",
          },
        },
      ]);

      // Analyze for conflicts with enhanced business rules
      const conflictingDevices = [];
      const validMobileDevices = [];
      const validStaticDevices = [];

      allDevices.forEach((device) => {
        const conflicts = [];
        const deviceType = device.deployment_type || "static";

        // MOBILE DEVICE VALIDATIONS
        if (deviceType === "mobile" || device.mobility === true) {
          // Mobile must have vehicle mount
          if (device.mountType && device.mountType !== "vehicle") {
            conflicts.push({
              type: "mobile_mount_type_invalid",
              message: `Mobile device has invalid mountType '${device.mountType}', should be 'vehicle'`,
              current_value: {
                mountType: device.mountType,
                deployment_type: deviceType,
              },
              suggested_fix: { mountType: "vehicle" },
            });
          }

          // Mobile must have alternator power
          if (device.powerType && device.powerType !== "alternator") {
            conflicts.push({
              type: "mobile_power_type_invalid",
              message: `Mobile device has invalid powerType '${device.powerType}', should be 'alternator'`,
              current_value: {
                powerType: device.powerType,
                deployment_type: deviceType,
              },
              suggested_fix: { powerType: "alternator" },
            });
          }

          // Mobile must have grid_id, not site_id
          if (device.site_id && !device.grid_id) {
            conflicts.push({
              type: "mobile_with_site_not_grid",
              message: "Mobile device has site_id but should have grid_id",
              current_value: {
                site_id: device.site_id,
                grid_id: device.grid_id,
              },
              suggested_fix: { site_id: null, grid_id: "NEEDS_ASSIGNMENT" },
            });
          }

          // Mobile must have mobility true
          if (device.mobility !== true) {
            conflicts.push({
              type: "mobile_mobility_false",
              message: "Mobile device has mobility set to false",
              current_value: {
                mobility: device.mobility,
                deployment_type: deviceType,
              },
              suggested_fix: { mobility: true },
            });
          }
        }

        // STATIC DEVICE VALIDATIONS
        if (deviceType === "static" || device.mobility === false) {
          // Static cannot have vehicle mount
          if (device.mountType === "vehicle") {
            conflicts.push({
              type: "static_vehicle_mount",
              message: "Static device cannot have mountType 'vehicle'",
              current_value: {
                mountType: device.mountType,
                deployment_type: deviceType,
              },
              suggested_fix: {
                deployment_type: "mobile",
                mobility: true,
                powerType: "alternator",
              },
            });
          }

          // Static should not have alternator power
          if (device.powerType === "alternator") {
            conflicts.push({
              type: "static_alternator_power",
              message: "Static device should not have powerType 'alternator'",
              current_value: {
                powerType: device.powerType,
                deployment_type: deviceType,
              },
              suggested_fix: { powerType: "solar" },
            });
          }

          // Static must have site_id, not grid_id
          if (device.grid_id && !device.site_id) {
            conflicts.push({
              type: "static_with_grid_not_site",
              message: "Static device has grid_id but should have site_id",
              current_value: {
                site_id: device.site_id,
                grid_id: device.grid_id,
              },
              suggested_fix: { grid_id: null, site_id: "NEEDS_ASSIGNMENT" },
            });
          }

          // Static must have mobility false
          if (device.mobility !== false) {
            conflicts.push({
              type: "static_mobility_true",
              message: "Static device has mobility set to true",
              current_value: {
                mobility: device.mobility,
                deployment_type: deviceType,
              },
              suggested_fix: { mobility: false },
            });
          }
        }

        // CROSS-VALIDATION CONFLICTS
        // Vehicle mount must be mobile
        if (device.mountType === "vehicle" && deviceType !== "mobile") {
          conflicts.push({
            type: "vehicle_mount_not_mobile",
            message: "Vehicle-mounted device must be mobile deployment",
            current_value: {
              mountType: device.mountType,
              deployment_type: deviceType,
            },
            suggested_fix: {
              deployment_type: "mobile",
              mobility: true,
              powerType: "alternator",
            },
          });
        }

        // Pole mount must be static
        if (
          device.mountType === "pole" &&
          (deviceType !== "static" || device.mobility === true)
        ) {
          conflicts.push({
            type: "pole_mount_not_static",
            message: "Pole-mounted device must be static deployment",
            current_value: {
              mountType: device.mountType,
              deployment_type: deviceType,
              mobility: device.mobility,
            },
            suggested_fix: {
              deployment_type: "static",
              mobility: false,
              grid_id: null,
            },
          });
        }

        // Alternator power must be mobile
        if (device.powerType === "alternator" && deviceType !== "mobile") {
          conflicts.push({
            type: "alternator_power_not_mobile",
            message: "Alternator-powered device must be mobile deployment",
            current_value: {
              powerType: device.powerType,
              deployment_type: deviceType,
            },
            suggested_fix: {
              deployment_type: "mobile",
              mobility: true,
              mountType: "vehicle",
            },
          });
        }

        // Both site_id and grid_id present
        if (device.site_id && device.grid_id) {
          conflicts.push({
            type: "both_site_and_grid",
            message: "Device cannot have both site_id and grid_id",
            current_value: { site_id: device.site_id, grid_id: device.grid_id },
            suggested_fix:
              deviceType === "mobile" ? { site_id: null } : { grid_id: null },
          });
        }

        // Categorize devices
        if (conflicts.length > 0) {
          conflictingDevices.push({
            ...device,
            conflicts: conflicts,
            severity: conflicts.some((c) =>
              [
                "vehicle_mount_not_mobile",
                "pole_mount_not_static",
                "alternator_power_not_mobile",
              ].includes(c.type)
            )
              ? "high"
              : "medium",
          });
        } else {
          if (deviceType === "mobile") {
            validMobileDevices.push(device);
          } else {
            validStaticDevices.push(device);
          }
        }
      });

      // Enhanced analysis with business rule insights
      const analysis = {
        total_devices: allDevices.length,
        valid_mobile_devices: validMobileDevices.length,
        valid_static_devices: validStaticDevices.length,
        conflicting_devices: conflictingDevices.length,
        high_severity_conflicts: conflictingDevices.filter(
          (d) => d.severity === "high"
        ).length,

        conflict_breakdown: {
          mobile_issues: {
            invalid_mount_type: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "mobile_mount_type_invalid")
            ).length,
            invalid_power_type: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "mobile_power_type_invalid")
            ).length,
            has_site_not_grid: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "mobile_with_site_not_grid")
            ).length,
            mobility_false: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "mobile_mobility_false")
            ).length,
          },

          static_issues: {
            vehicle_mount: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "static_vehicle_mount")
            ).length,
            alternator_power: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "static_alternator_power")
            ).length,
            has_grid_not_site: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "static_with_grid_not_site")
            ).length,
            mobility_true: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "static_mobility_true")
            ).length,
          },

          cross_validation_issues: {
            vehicle_mount_not_mobile: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "vehicle_mount_not_mobile")
            ).length,
            pole_mount_not_static: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "pole_mount_not_static")
            ).length,
            alternator_power_not_mobile: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "alternator_power_not_mobile")
            ).length,
            both_site_and_grid: conflictingDevices.filter((d) =>
              d.conflicts.some((c) => c.type === "both_site_and_grid")
            ).length,
          },
        },

        business_rules_summary: {
          expected_mobile_attributes: {
            mountType: "vehicle",
            powerType: "alternator",
            mobility: true,
            location_reference: "grid_id",
          },
          expected_static_attributes: {
            mountType: "pole|wall|faceboard|rooftop|suspended",
            powerType: "solar|mains",
            mobility: false,
            location_reference: "site_id",
          },
        },
      };

      return {
        success: true,
        message: "Comprehensive device metadata analysis completed",
        data: {
          valid_mobile_devices: validMobileDevices,
          valid_static_devices: validStaticDevices,
          conflicting_devices: conflictingDevices,
          analysis: analysis,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Enhanced Metadata Analysis Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  fixMetadataConflicts: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const {
        dry_run = false,
        fix_types = ["all"],
        auto_assign_locations = false,
      } = body;

      // Get conflicting devices first
      const analysisResult = await deviceUtil.getMobileDevicesMetadataAnalysis(
        request,
        next
      );

      if (!analysisResult.success) {
        return analysisResult;
      }

      const conflictingDevices = analysisResult.data.conflicting_devices;
      const fixedDevices = [];
      const failedFixes = [];
      const manualReviewRequired = [];

      for (const device of conflictingDevices) {
        try {
          const fixes = [];
          let updateData = {};
          let requiresManualReview = false;

          device.conflicts.forEach((conflict) => {
            switch (conflict.type) {
              // MOBILE DEVICE FIXES
              case "mobile_mount_type_invalid":
                updateData.mountType = "vehicle";
                fixes.push("Set mountType to 'vehicle' for mobile device");
                break;

              case "mobile_power_type_invalid":
                updateData.powerType = "alternator";
                fixes.push("Set powerType to 'alternator' for mobile device");
                break;

              case "mobile_with_site_not_grid":
                updateData.site_id = null;
                if (!auto_assign_locations) {
                  requiresManualReview = true;
                  fixes.push(
                    "Cleared site_id - MANUAL: Assign appropriate grid_id"
                  );
                }
                break;

              case "mobile_mobility_false":
                updateData.mobility = true;
                fixes.push("Set mobility to true for mobile device");
                break;

              // STATIC DEVICE FIXES
              case "static_vehicle_mount":
                // This is ambiguous - could fix by making mobile OR changing mount
                requiresManualReview = true;
                fixes.push(
                  "MANUAL REVIEW: Vehicle-mounted device marked as static"
                );
                break;

              case "static_alternator_power":
                updateData.powerType = "solar"; // Default to solar for static
                fixes.push(
                  "Changed powerType from 'alternator' to 'solar' for static device"
                );
                break;

              case "static_with_grid_not_site":
                updateData.grid_id = null;
                if (!auto_assign_locations) {
                  requiresManualReview = true;
                  fixes.push(
                    "Cleared grid_id - MANUAL: Assign appropriate site_id"
                  );
                }
                break;

              case "static_mobility_true":
                updateData.mobility = false;
                fixes.push("Set mobility to false for static device");
                break;

              // CROSS-VALIDATION FIXES
              case "vehicle_mount_not_mobile":
                // Convert to mobile since vehicle mount strongly indicates mobile
                updateData.deployment_type = "mobile";
                updateData.mobility = true;
                updateData.powerType = "alternator";
                updateData.site_id = null;
                fixes.push(
                  "Converted to mobile deployment (vehicle mount detected)"
                );
                if (!device.grid_id && !auto_assign_locations) {
                  requiresManualReview = true;
                  fixes.push("MANUAL: Assign grid_id for mobile device");
                }
                break;

              case "pole_mount_not_static":
                // Convert to static since pole mount strongly indicates static
                updateData.deployment_type = "static";
                updateData.mobility = false;
                updateData.grid_id = null;
                if (device.powerType === "alternator") {
                  updateData.powerType = "solar";
                }
                fixes.push(
                  "Converted to static deployment (pole mount detected)"
                );
                if (!device.site_id && !auto_assign_locations) {
                  requiresManualReview = true;
                  fixes.push("MANUAL: Assign site_id for static device");
                }
                break;

              case "alternator_power_not_mobile":
                // Convert to mobile since alternator strongly indicates mobile
                updateData.deployment_type = "mobile";
                updateData.mobility = true;
                updateData.mountType = "vehicle";
                updateData.site_id = null;
                fixes.push(
                  "Converted to mobile deployment (alternator power detected)"
                );
                if (!device.grid_id && !auto_assign_locations) {
                  requiresManualReview = true;
                  fixes.push("MANUAL: Assign grid_id for mobile device");
                }
                break;

              case "both_site_and_grid":
                // Decide based on deployment type
                if (
                  device.deployment_type === "mobile" ||
                  device.mobility === true
                ) {
                  updateData.site_id = null;
                  fixes.push(
                    "Removed site_id (kept grid_id for mobile device)"
                  );
                } else {
                  updateData.grid_id = null;
                  fixes.push(
                    "Removed grid_id (kept site_id for static device)"
                  );
                }
                break;
            }
          });

          // Apply fixes or mark for manual review
          if (requiresManualReview) {
            manualReviewRequired.push({
              device_id: device._id,
              device_name: device.name,
              conflicts: device.conflicts,
              suggested_fixes: fixes,
              partial_update_data: updateData,
              status: "requires_manual_review",
            });
          } else if (Object.keys(updateData).length > 0) {
            if (!dry_run) {
              await DeviceModel(tenant).findOneAndUpdate(
                { _id: device._id },
                { $set: updateData }
              );
            }

            fixedDevices.push({
              device_id: device._id,
              device_name: device.name,
              conflicts_detected: device.conflicts.length,
              fixes_applied: fixes,
              update_data: updateData,
              status: dry_run ? "would_be_fixed" : "fixed",
            });
          }
        } catch (error) {
          failedFixes.push({
            device_id: device._id,
            device_name: device.name,
            error: error.message,
          });
        }
      }

      const summary = {
        total_conflicting_devices: conflictingDevices.length,
        automatically_fixed: fixedDevices.length,
        requires_manual_review: manualReviewRequired.length,
        failed_fixes: failedFixes.length,
        dry_run: dry_run,
        timestamp: new Date(),
        business_rules_applied: {
          mobile_requirements:
            "mountType=vehicle, powerType=alternator, mobility=true, grid_id required",
          static_requirements:
            "mountType≠vehicle, powerType≠alternator, mobility=false, site_id required",
        },
      };

      return {
        success: true,
        message: dry_run
          ? "Dry run completed - no changes made"
          : "Enhanced metadata cleanup completed",
        data: {
          fixed_devices: fixedDevices,
          manual_review_required: manualReviewRequired,
          failed_fixes: failedFixes,
          summary: summary,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🪲🪲 Enhanced Fix Metadata Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = {
  ...deviceUtil,
  getDeviceCategoriesAddFieldsStage,
};
