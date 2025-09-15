const SiteModel = require("@models/Site");
const ActivityModel = require("@models/Activity");
const UniqueIdentifierCounterModel = require("@models/UniqueIdentifierCounter");
const constants = require("@config/constants");
const { logObject, logText, logElement, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const axios = require("axios");
const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});
const axiosInstance = () => {
  return axios.create();
};
const { generateFilter, stringify, distance } = require("@utils/common");
const httpStatus = require("http-status");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- site-util`
);

const createAirqloudUtil = require("@utils/airqloud.util");
const geolib = require("geolib");
const {
  generateDateFormatWithoutHrs,
  monthsInfront,
} = require("@utils/common");
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createSite = {
  getSiteById: async (req, next) => {
    try {
      const { id } = req.params;
      const {
        tenant,
        maxActivities = 500,
        includeActivities = "true",
        includeRelations = "true",
        useCache = "true",
        detailLevel = "full", // 'minimal', 'summary', 'full'
      } = req.query;

      // Determine projection based on detail level
      let projection = {};
      if (detailLevel === "minimal") {
        projection = {
          _id: 1,
          name: 1,
          generated_name: 1,
          status: 1,
          network: 1,
          createdAt: 1,
        };
      } else if (detailLevel === "summary") {
        projection = {
          _id: 1,
          name: 1,
          generated_name: 1,
          status: 1,
          network: 1,
          latitude: 1,
          longitude: 1,
          country: 1,
          district: 1,
          createdAt: 1,
          cached_total_devices: 1,
          cached_total_activities: 1,
          cached_activities_by_type: 1,
        };
      }

      // Build aggregation pipeline
      let pipeline = [{ $match: { _id: id } }];

      // Add projection early if specified
      if (Object.keys(projection).length > 0) {
        pipeline.push({ $project: projection });
      }

      // Conditional lookups based on detail level and parameters
      if (detailLevel === "full") {
        if (includeRelations === "true") {
          pipeline.push(
            {
              $lookup: {
                from: "devices",
                localField: "_id",
                foreignField: "site_id",
                as: "devices",
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      name: 1,
                      long_name: 1,
                      status: 1,
                      category: 1,
                      isActive: 1,
                    },
                  },
                ],
              },
            },
            {
              $lookup: {
                from: "grids",
                localField: "grids",
                foreignField: "_id",
                as: "grids",
              },
            },
            {
              $lookup: {
                from: "airqlouds",
                localField: "airqlouds",
                foreignField: "_id",
                as: "airqlouds",
              },
            }
          );
        }

        // Handle activities based on cache preference
        if (includeActivities === "true") {
          if (useCache === "true") {
            pipeline.push({
              $addFields: {
                activities_by_type: {
                  $ifNull: ["$cached_activities_by_type", {}],
                },
                latest_activities_by_type: {
                  $ifNull: ["$cached_latest_activities_by_type", {}],
                },
                total_activities: {
                  $ifNull: ["$cached_total_activities", 0],
                },
                device_activity_summary: {
                  $ifNull: ["$cached_device_activity_summary", []],
                },
                latest_deployment_activity:
                  "$cached_latest_deployment_activity",
                latest_maintenance_activity:
                  "$cached_latest_maintenance_activity",
                latest_recall_activity: "$cached_latest_recall_activity",
                site_creation_activity: "$cached_site_creation_activity",
                activities_from_cache: {
                  $cond: [
                    { $gt: [{ $ifNull: ["$cached_total_activities", 0] }, 0] },
                    true,
                    false,
                  ],
                },
              },
            });
          } else {
            pipeline.push({
              $lookup: {
                from: "activities",
                let: { siteId: "$_id" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$site_id", "$$siteId"] } } },
                  { $sort: { createdAt: -1 } },
                  {
                    $project: {
                      _id: 1,
                      activityType: 1,
                      date: 1,
                      description: 1,
                      maintenanceType: 1,
                      recallType: 1,
                      nextMaintenance: 1,
                      createdAt: 1,
                      tags: 1,
                      device: 1,
                      device_id: 1,
                      site_id: 1,
                    },
                  },
                  ...(maxActivities
                    ? [{ $limit: parseInt(maxActivities) }]
                    : []),
                ],
                as: "activities",
              },
            });
          }
        }

        // Add computed fields
        pipeline.push({
          $addFields: {
            total_activities: {
              $cond: [
                {
                  $and: [
                    { $isArray: "$activities" },
                    { $ne: [includeActivities, "false"] },
                  ],
                },
                { $size: "$activities" },
                { $ifNull: ["$cached_total_activities", 0] },
              ],
            },
            total_devices: {
              $cond: [{ $isArray: "$devices" }, { $size: "$devices" }, 0],
            },
          },
        });
      }

      const sitePipeline = await SiteModel(tenant.toLowerCase()).aggregate(
        pipeline
      );

      if (!sitePipeline || sitePipeline.length === 0) {
        throw new HttpError("Site not found", httpStatus.NOT_FOUND);
      }

      const site = sitePipeline[0];

      // Process activities only if not using cache and activities are included
      if (
        detailLevel === "full" &&
        includeActivities === "true" &&
        useCache === "false" &&
        site.activities
      ) {
        const activitiesByType = {};
        const latestActivitiesByType = {};

        site.activities.forEach((activity) => {
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

        site.activities_by_type = activitiesByType;
        site.latest_activities_by_type = latestActivitiesByType;
        site.latest_deployment_activity =
          latestActivitiesByType.deployment || null;
        site.latest_maintenance_activity =
          latestActivitiesByType.maintenance || null;
        site.latest_recall_activity =
          latestActivitiesByType.recall ||
          latestActivitiesByType.recallment ||
          null;
        site.site_creation_activity =
          latestActivitiesByType["site-creation"] || null;

        const deviceActivitySummary = site.devices.map((device) => {
          const deviceActivities = site.activities.filter(
            (activity) =>
              activity.device === device.name ||
              (activity.device_id &&
                activity.device_id.toString() === device._id.toString())
          );
          return {
            device_id: device._id,
            device_name: device.name,
            activity_count: deviceActivities.length,
          };
        });
        site.device_activity_summary = deviceActivitySummary;
      }

      // Set default values for missing cache data
      if (detailLevel !== "minimal") {
        if (!site.activities_by_type) site.activities_by_type = {};
        if (!site.latest_activities_by_type)
          site.latest_activities_by_type = {};
        if (!site.device_activity_summary) site.device_activity_summary = [];
      }

      return {
        success: true,
        message:
          "Site details with activities and devices fetched successfully",
        data: site,
        status: httpStatus.OK,
        meta: {
          detailLevel,
          usedCache: useCache === "true" && !!site.activities_from_cache,
          includeActivities: includeActivities === "true",
          includeRelations: includeRelations === "true",
        },
      };
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
        return;
      }
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  fetchSiteDetails: async (tenant, req, next) => {
    const filter = generateFilter.sites(req, next);
    logObject("the filter being used to filter", filter);

    const responseFromListSite = await SiteModel(tenant).list({ filter }, next);

    if (!responseFromListSite.success) return responseFromListSite;

    if (isEmpty(responseFromListSite.data[0])) {
      return {
        success: false,
        message: "Site Not Found",
        status: httpStatus.BAD_REQUEST,
        errors: { message: "Site Not Found, Crosschek Query Parameters" },
      };
    }

    return responseFromListSite;
  },
  prepareSiteRequestBody: (siteDetails, tenant, next) => {
    let request = { ...siteDetails };
    delete request._id;
    delete request.devices;

    let { name, parish, county, district, latitude, longitude } = request;

    if (!name) {
      const siteNames = { name, parish, county, district };
      const availableName = createSite.pickAvailableValue(siteNames, next);
      const isNameValid = createSite.validateSiteName(availableName, next);

      request.name = isNameValid
        ? availableName
        : createSite.sanitiseName(availableName, next);
    }

    request.lat_long = createSite.generateLatLong(latitude, longitude);

    if (isEmpty(request.generated_name)) {
      const responseFromGenerateName = createSite.generateName(tenant, next);

      if (responseFromGenerateName.success) {
        request.generated_name = responseFromGenerateName.data;
      } else {
        throw responseFromGenerateName;
      }
    }

    return request;
  },
  fetchAdditionalSiteDetails: async (tenant, id, next) => {
    const baseQuery = { query: { tenant, id } };
    const additionalDetails = {};

    const [airQloudsResponse, weatherStationResponse] = await Promise.all([
      createSite.findAirQlouds(baseQuery, next),
      createSite.findNearestWeatherStation(baseQuery, next),
    ]);

    if (airQloudsResponse.success) {
      additionalDetails.airqlouds = airQloudsResponse.data;
    }

    if (weatherStationResponse.success) {
      const station = weatherStationResponse.data;
      const cleanedStation = createSite.cleanWeatherStationData(station);
      additionalDetails.nearest_tahmo_station = cleanedStation;
    }

    return additionalDetails;
  },

  cleanWeatherStationData: (station) => {
    const fieldsToRemove = [
      "elevation",
      "countrycode",
      "timezoneoffset",
      "name",
      "type",
    ];

    return Object.keys(station)
      .filter((key) => !fieldsToRemove.includes(key))
      .reduce((acc, key) => {
        acc[key] = station[key];
        return acc;
      }, {});
  },
  hasWhiteSpace: (name, next) => {
    try {
      if (!name || typeof name !== "string") {
        return false;
      }
      return name.indexOf(" ") >= 0;
    } catch (error) {
      logger.error(
        `create site util server error -- hasWhiteSpace -- ${error.message}`
      );
    }
  },
  checkStringLength: (name, next) => {
    try {
      if (!name || typeof name !== "string") {
        return false;
      }
      //check if name has only white spaces
      name = name.trim();
      let length = name.length;
      if (length >= 5 && length <= 50) {
        return true;
      }
      return false;
    } catch (error) {
      logger.error(
        `internal server error -- check string length -- ${error.message}`
      );
    }
  },
  findAirQlouds: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const responseFromListSites = await createSite.list(request, next);
      if (responseFromListSites.success === true) {
        let data = responseFromListSites.data;
        if (data.length > 1 || data.length === 0) {
          return {
            success: false,
            message: "unable to find one match for this site",
            status: httpStatus.NOT_FOUND,
            errors: { message: "unable to find one match for this site" },
          };
        }
        const { latitude, longitude } = data[0];
        const requestForAirQlouds = {
          query: { tenant },
        };
        const responseFromListAirQlouds = await createAirqloudUtil.list(
          requestForAirQlouds,
          next
        );
        if (responseFromListAirQlouds.success === true) {
          const airqlouds = responseFromListAirQlouds.data;
          let airqloud_ids = [];
          for (const airqloud of airqlouds) {
            delete airqlouds.sites;
            let airqloudArrayOfCoordinates = airqloud.location.coordinates[0];
            let airqloudPolygon = airqloudArrayOfCoordinates.map(function(x) {
              return {
                longitude: x[0],
                latitude: x[1],
              };
            });
            const isSiteInAirQloud = geolib.isPointInPolygon(
              { latitude, longitude },
              airqloudPolygon
            );

            if (isSiteInAirQloud === true) {
              airqloud_ids.push(airqloud._id);
            }
          }
          if (!isEmpty(airqloud_ids)) {
            return {
              success: true,
              message: "successfully searched for the associated AirQlouds",
              data: airqloud_ids,
              status: httpStatus.OK,
            };
          } else if (isEmpty(airqloud_ids)) {
            return {
              success: true,
              message: "no associated AirQlouds found",
              data: airqloud_ids,
              status: httpStatus.OK,
            };
          }
        } else if (responseFromListAirQlouds.success === false) {
          return responseFromListAirQlouds;
        }
      } else if (responseFromListSites.success === false) {
        return responseFromListSites;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  findNearestWeatherStation: async (request, next) => {
    try {
      const responseFromListSites = await createSite.list(request, next);
      if (responseFromListSites.success === true) {
        let data = responseFromListSites.data;
        if (data.length > 1 || data.length === 0) {
          return {
            success: false,
            message: "unable to find one match for this site",
            status: httpStatus.NOT_FOUND,
          };
        }
        const { latitude, longitude } = data[0];
        const responseFromListWeatherStations = await createSite.listWeatherStations(
          next
        );
        if (responseFromListWeatherStations.success === true) {
          const nearestWeatherStation = geolib.findNearest(
            { latitude, longitude },
            responseFromListWeatherStations.data
          );
          return {
            success: true,
            message: "successfully returned the nearest weather station",
            data: nearestWeatherStation,
            status: httpStatus.OK,
          };
        } else if (responseFromListWeatherStations.success === false) {
          return responseFromListWeatherStations;
        }
      } else if (responseFromListSites.success === false) {
        return responseFromListSites;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listWeatherStations: async (next) => {
    try {
      const url = constants.TAHMO_API_GET_STATIONS_URL;
      return await axios
        .get(url, {
          auth: {
            username: constants.TAHMO_API_CREDENTIALS_USERNAME,
            password: constants.TAHMO_API_CREDENTIALS_PASSWORD,
          },
        })
        .then((res) => {
          let responseJSON = res.data;
          if (!isEmpty(responseJSON)) {
            data = responseJSON.data;
            let outputs = [];
            data.forEach((element) => {
              let output = {};
              output["id"] = element.id;
              output["code"] = element.code;
              output["latitude"] = element.location.latitude;
              output["longitude"] = element.location.longitude;
              output["elevation"] = element.location.elevationmsl;
              output["countrycode"] = element.location.countrycode;
              output["timezone"] = element.location.timezone;
              output["timezoneoffset"] = element.location.timezoneoffset;
              output["name"] = element.location.name;
              output["type"] = element.location.type;
              outputs.push(output);
            });

            return {
              success: true,
              message: "successfully retrieved all the stations",
              status: httpStatus.OK,
              data: outputs,
            };
          }
          if (isEmpty(responseJSON.data)) {
            logElement("Unable to list stations, List of stations is empty.");
            return {
              success: false,
              message: "List of stations is empty",
              status: httpStatus.NOT_FOUND,
              errors: { message: "unable to list stations" },
              data: [],
            };
          }
        })
        .catch((error) => {
          try {
            logger.error(`internal server error -- ${JSON.stringify(error)}`);
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
          return {
            success: false,
            errors: { message: error },
            message: "Bad Gateway Error",
            status: httpStatus.BAD_GATEWAY,
          };
        });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  validateSiteName: (name, next) => {
    try {
      // let nameHasWhiteSpace = createSite.hasWhiteSpace(name,next);
      let isValidStringLength = createSite.checkStringLength(name, next);
      if (isValidStringLength) {
        return true;
      }
      return false;
    } catch (error) {
      logger.error(
        `internal server error -- validate site name -- ${error.message}`
      );
    }
  },
  generateName: async (tenant, next) => {
    try {
      let filter = {
        NAME: "site_0",
      };

      let update = {
        $inc: { COUNT: 1 },
      };

      const responseFromModifyUniqueIdentifierCounter = await UniqueIdentifierCounterModel(
        tenant.toLowerCase()
      ).modify(
        {
          filter,
          update,
        },
        next
      );

      if (responseFromModifyUniqueIdentifierCounter.success === false) {
        logger.error(
          `unable to find the counter document, please first create it`
        );
        return {
          success: false,
          message:
            "unable to generate unique name for this site, contact support",
          errors: responseFromModifyUniqueIdentifierCounter.errors
            ? responseFromModifyUniqueIdentifierCounter.errors
            : { message: "" },
          status: responseFromModifyUniqueIdentifierCounter.status
            ? responseFromModifyUniqueIdentifierCounter.status
            : httpStatus.BAD_REQUEST,
        };
      } else if (responseFromModifyUniqueIdentifierCounter.success === true) {
        const count = responseFromModifyUniqueIdentifierCounter.data.COUNT;
        const siteName = `site_${count}`;
        return {
          success: true,
          message: "unique name generated for this site",
          data: siteName,
          status: responseFromModifyUniqueIdentifierCounter.status
            ? responseFromModifyUniqueIdentifierCounter.status
            : httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;

      const {
        name,
        latitude,
        longitude,
        approximate_distance_in_km,
        network,
        userName,
        lastName,
        firstName,
        user_id,
        group,
      } = body;

      const responseFromApproximateCoordinates = createSite.createApproximateCoordinates(
        { latitude, longitude, approximate_distance_in_km },
        next
      );

      if (responseFromApproximateCoordinates.success === true) {
        const {
          approximate_latitude,
          approximate_longitude,
          bearing_in_radians,
          approximate_distance_in_km,
        } = responseFromApproximateCoordinates.data;
        request["body"]["approximate_latitude"] = approximate_latitude;
        request["body"]["approximate_longitude"] = approximate_longitude;
        request["body"]["bearing_in_radians"] = bearing_in_radians;
        request["body"][
          "approximate_distance_in_km"
        ] = approximate_distance_in_km;
      } else if (responseFromApproximateCoordinates.success === false) {
        return responseFromApproximateCoordinates;
      }

      let generated_name = null;
      let requestBodyForCreatingSite = {};

      let isNameValid = createSite.validateSiteName(name, next);
      if (!isNameValid) {
        return {
          success: false,
          message: "site name is invalid, please check documentation",
        };
      }

      let lat_long = createSite.generateLatLong(latitude, longitude);
      request["body"]["lat_long"] = lat_long;

      let responseFromGenerateName = await createSite.generateName(
        tenant,
        next
      );
      logObject("responseFromGenerateName", responseFromGenerateName);
      if (responseFromGenerateName.success === true) {
        generated_name = responseFromGenerateName.data;
        request["body"]["generated_name"] = generated_name;
      } else if (responseFromGenerateName.success === false) {
        return responseFromGenerateName;
      }

      const responseFromGenerateMetadata = await createSite.generateMetadata(
        request,
        next
      );
      logObject("responseFromGenerateMetadata", responseFromGenerateMetadata);
      if (responseFromGenerateMetadata.success === true) {
        requestBodyForCreatingSite = responseFromGenerateMetadata.data;
      } else if (responseFromGenerateMetadata.success === false) {
        return responseFromGenerateMetadata;
      }

      const responseFromCreateSite = await SiteModel(tenant).register(
        requestBodyForCreatingSite,
        next
      );

      logObject("responseFromCreateSite in the util", responseFromCreateSite);

      if (responseFromCreateSite.success === true) {
        const createdSite = responseFromCreateSite.data;
        try {
          const siteActivityBody = {
            date: new Date(),
            description: "site created",
            activityType: "site-creation",
            site_id: createdSite._id,
            ...(network && { network }),
            ...(userName && { userName }),
            ...(lastName && { lastName }),
            ...(firstName && { firstName }),
            ...(user_id && { user_id }),
            ...(group && { group }),
          };

          const responseFromRegisterActivity = await ActivityModel(
            tenant
          ).register(siteActivityBody, next);
          if (responseFromRegisterActivity.success === false) {
            logger.error(
              "Unable to store the site activity for this operation."
            );
          }
        } catch (error) {
          logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        }

        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.SITES_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify({
                  ...createdSite,
                  groupId: group,
                  tenant: request.query.tenant,
                }),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logObject("error", error);
          logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
        }

        return responseFromCreateSite;
      } else if (responseFromCreateSite.success === false) {
        return responseFromCreateSite;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
      const filter = generateFilter.sites(request, next);
      const { tenant } = request.query;
      const update = request.body;
      const responseFromModifySite = await SiteModel(tenant).modify(
        {
          filter,
          update,
        },
        next
      );

      return responseFromModifySite;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateManySites: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { siteIds, updateData } = request.body;

      // Find existing sites
      const existingSites = await SiteModel(tenant)
        .find({
          _id: { $in: siteIds },
        })
        .select("_id");

      // Create sets for comparison
      const existingSiteIds = new Set(
        existingSites.map((site) => site._id.toString())
      );
      const providedSiteIds = new Set(siteIds.map((id) => id.toString()));

      // Identify non-existent site IDs
      const nonExistentSiteIds = siteIds.filter(
        (id) => !existingSiteIds.has(id.toString())
      );

      // If there are non-existent sites, prepare a detailed error
      if (nonExistentSiteIds.length > 0) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "Some provided site IDs do not exist",
            nonExistentSiteIds: nonExistentSiteIds,
            existingSiteIds: Array.from(existingSiteIds),
            totalProvidedSiteIds: siteIds.length,
            existingSiteCount: existingSites.length,
          })
        );
      }

      // Prepare filter
      const filter = {
        _id: { $in: Array.from(providedSiteIds) },
      };

      // Additional filtering from generateFilter if needed
      const additionalFilter = generateFilter.sites(request, next);
      Object.assign(filter, additionalFilter);

      // Optimize options for bulk update
      const opts = {
        new: true,
        multi: true,
        runValidators: true,
        context: "query",
      };

      // Perform bulk update
      const responseFromBulkModifySites = await SiteModel(tenant).bulkModify(
        {
          filter,
          update: updateData,
          opts,
        },
        next
      );

      // Attach additional metadata to the response
      return {
        ...responseFromBulkModifySites,
        metadata: {
          totalSitesUpdated: responseFromBulkModifySites.data.modifiedCount,
          requestedSiteIds: Array.from(providedSiteIds),
          existingSiteIds: Array.from(existingSiteIds),
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Bulk Update Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  sanitiseName: (name, next) => {
    try {
      if (!name || typeof name !== "string") {
        return "";
      }
      let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
      let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
      let trimmedName = shortenedName.trim();
      return trimmedName.toLowerCase();
    } catch (error) {
      logger.error(`internal server error -- sanitiseName-- ${error.message}`);
    }
  },
  getRoadMetadata: async (latitude, longitude, next) => {
    try {
      let response = {};
      let promises = [];
      const today = monthsInfront(0);
      const oneMonthAgo = monthsInfront(-1);
      const endDate = generateDateFormatWithoutHrs(today);
      const startDate = generateDateFormatWithoutHrs(oneMonthAgo);
      const paths = constants.GET_ROAD_METADATA_PATHS;
      const arrayOfPaths = Object.entries(paths);
      for (const [key, path] of arrayOfPaths) {
        const url = constants.GET_ROAD_METADATA({
          path,
          latitude,
          longitude,
          startDate,
          endDate,
        });
        promises.push(
          axios
            .get(url)
            .then((res) => {
              let responseJSON = res.data;
              if (!isEmpty(responseJSON.data)) {
                let data = responseJSON.data;
                response[key] = data;
              }
              if (isEmpty(responseJSON.data)) {
                logElement("unable to get the information for", key);
              }
            })
            .catch((error) => {
              try {
                logger.error(
                  `internal server error -- ${JSON.stringify(error)}`
                );
              } catch (error) {
                logger.error(`internal server error -- ${error.message}`);
              }
              return {
                success: false,
                errors: { message: error },
                message: "Internal Server Error",
                status: httpStatus.INTERNAL_SERVER_ERROR,
              };
            })
        );
      }

      return await Promise.all(promises).then(() => {
        if (!isEmpty(response)) {
          return {
            success: true,
            message: "successfully retrieved the road metadata",
            status: httpStatus.OK,
            data: response,
          };
        } else if (isEmpty(response)) {
          return {
            success: false,
            message: "unable to retrieve any road metadata",
            status: httpStatus.NOT_FOUND,
            errors: { message: "unable to retrieve any road metadata" },
          };
        }
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  generateMetadata: async (req, next) => {
    try {
      let { query, body } = req;
      let { latitude, longitude } = body;
      let { tenant, id } = query;
      let roadResponseData = {};
      let altitudeResponseData = {};
      let reverseGeoCodeResponseData = {};

      let responseFromGetAltitude = await createSite.getAltitude(
        latitude,
        longitude,
        next
      );

      if (responseFromGetAltitude.success === true) {
        altitudeResponseData["altitude"] = responseFromGetAltitude.data;
      } else if (responseFromGetAltitude.success === false) {
        let errors = responseFromGetAltitude.errors
          ? responseFromGetAltitude.errors
          : { message: "" };
        try {
          logger.error(
            `unable to retrieve the altitude for this site, ${
              responseFromGetAltitude.message
            } and ${JSON.stringify(errors)}`
          );
        } catch (error) {
          logger.error(`internal server error ${error.message}`);
        }
      }

      // let responseFromGetRoadMetadata = await createSite.getRoadMetadata(
      //   latitude,
      //   longitude,
      //   next
      // );

      // logObject("responseFromGetRoadMetadata", responseFromGetRoadMetadata);

      // if (responseFromGetRoadMetadata.success === true) {
      //   roadResponseData = responseFromGetRoadMetadata.data;
      // } else if (responseFromGetRoadMetadata.success === false) {
      //   let errors = responseFromGetRoadMetadata.errors
      //     ? responseFromGetRoadMetadata.errors
      //     : {message:""};
      //   try {
      //     logger.error(
      //       `unable to retrieve the road metadata, ${
      //         responseFromGetRoadMetadata.message
      //       } and ${JSON.stringify(errors)} `
      //     );
      //   } catch (error) {
      //     logger.error(`internal server error -- ${error.message}`);
      //   }
      // }

      let responseFromReverseGeoCode = await createSite.reverseGeoCode(
        latitude,
        longitude,
        next
      );

      if (responseFromReverseGeoCode.success === true) {
        reverseGeoCodeResponseData = responseFromReverseGeoCode.data;
        let google_site_tags = responseFromReverseGeoCode.data.site_tags;
        let existing_site_tags = body.site_tags ? body.site_tags : [];
        let merged_site_tags = [...google_site_tags, ...existing_site_tags];
        body["site_tags"] = merged_site_tags;
        let finalResponseBody = {
          ...reverseGeoCodeResponseData,
          ...body,
          ...roadResponseData,
          ...altitudeResponseData,
          data_provider: constants.DATA_PROVIDER_MAPPINGS(body.network),
        };
        let status = responseFromReverseGeoCode.status
          ? responseFromReverseGeoCode.status
          : "";
        return {
          success: true,
          message: "successfully generated the metadata",
          data: finalResponseBody,
          status,
        };
      } else if (responseFromReverseGeoCode.success === false) {
        return responseFromReverseGeoCode;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  pickAvailableValue: (valuesInObject, next) => {
    let arrayOfSiteNames = Object.values(valuesInObject);
    let availableName = arrayOfSiteNames.find(Boolean);
    return availableName;
  },
  refresh: async (req, next) => {
    try {
      logObject("the req coming in...", req);
      const { tenant, id } = req.query;

      const siteDetails = await createSite.fetchSiteDetails(tenant, req, next);
      if (!siteDetails.success) return siteDetails;

      const requestBody = createSite.prepareSiteRequestBody(
        siteDetails.data[0],
        tenant,
        next
      );

      const airQloudsAndWeatherStations = await createSite.fetchAdditionalSiteDetails(
        tenant,
        id,
        next
      );
      Object.assign(requestBody, airQloudsAndWeatherStations);

      const metadataResponse = await createSite.generateMetadata(
        { query: { tenant }, body: requestBody },
        next
      );

      if (!metadataResponse.success) return metadataResponse;

      const updateRequest = {
        ...req,
        body: { ...metadataResponse.data },
      };

      const updateResponse = await createSite.update(updateRequest, next);

      return updateResponse.success
        ? {
            success: true,
            message: "Site details successfully refreshed",
            data: updateResponse.data,
          }
        : updateResponse;
    } catch (error) {
      logObject("util errors", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
        message: "feature temporarity disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      const { tenant } = request.query;
      let filter = generateFilter.sites(request, next);
      logObject("filter", filter);
      const responseFromRemoveSite = await SiteModel(tenant).remove(
        {
          filter,
        },
        next
      );

      return responseFromRemoveSite;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
        skip,
        limit,
        tenant,
        path,
        useCache = "true",
        detailLevel = "summary",
      } = request.query;
      const filter = generateFilter.sites(request, next);
      if (!isEmpty(path)) {
        filter.path = path;
      }

      let pipeline = [];

      // Base match
      pipeline.push({ $match: filter });

      if (detailLevel === "minimal") {
        pipeline.push({
          $project: {
            _id: 1,
            name: 1,
            generated_name: 1,
            latitude: 1,
            longitude: 1,
            network: 1,
            createdAt: 1,
          },
        });
      } else if (detailLevel === "summary") {
        pipeline.push(
          {
            $addFields: {
              total_devices: { $ifNull: ["$cached_total_devices", 0] },
              total_activities: { $ifNull: ["$cached_total_activities", 0] },
              activities_by_type: {
                $ifNull: ["$cached_activities_by_type", {}],
              },
              latest_deployment_activity: "$cached_latest_deployment_activity",
            },
          },
          {
            $project: {
              // Exclude heavy fields for summary
              geometry: 0,
              site_tags: 0,
              weather_stations: 0,
              images: 0,
              share_links: 0,
            },
          }
        );
      } else {
        // Full detail level
        pipeline.push(
          {
            $lookup: {
              from: "devices",
              localField: "_id",
              foreignField: "site_id",
              as: "devices",
            },
          },
          {
            $lookup: {
              from: "grids",
              localField: "grids",
              foreignField: "_id",
              as: "grids",
            },
          },
          {
            $lookup: {
              from: "airqlouds",
              localField: "airqlouds",
              foreignField: "_id",
              as: "airqlouds",
            },
          }
        );

        if (useCache === "true") {
          pipeline.push({
            $addFields: {
              total_activities: { $ifNull: ["$cached_total_activities", 0] },
              activities_by_type: {
                $ifNull: ["$cached_activities_by_type", {}],
              },
              latest_activities_by_type: {
                $ifNull: ["$cached_latest_activities_by_type", {}],
              },
              latest_deployment_activity: "$cached_latest_deployment_activity",
              latest_maintenance_activity:
                "$cached_latest_maintenance_activity",
              latest_recall_activity: "$cached_latest_recall_activity",
              site_creation_activity: "$cached_site_creation_activity",
            },
          });
        } else {
          // Real-time aggregation (expensive)
          pipeline.push({
            $lookup: {
              from: "activities",
              localField: "_id",
              foreignField: "site_id",
              as: "activities",
            },
          });
        }
      }

      // Common sorting and pagination
      pipeline.push(
        { $sort: { createdAt: -1 } },
        { $skip: skip || 0 },
        { $limit: limit || 1000 }
      );

      const response = await SiteModel(tenant)
        .aggregate(pipeline)
        .allowDiskUse(true);

      // Post-processing for non-cached full detail
      if (
        !isEmpty(response) &&
        detailLevel === "full" &&
        useCache === "false"
      ) {
        response.forEach((site) => {
          if (site.activities && site.activities.length > 0) {
            const activitiesByType = {};
            const latestActivitiesByType = {};
            site.activities.forEach((activity) => {
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
            site.activities_by_type = activitiesByType;
            site.latest_activities_by_type = latestActivitiesByType;
          } else {
            site.activities_by_type = {};
            site.latest_activities_by_type = {};
          }
        });
      }

      const filteredResponse = response.filter((obj) => obj.lat_long !== "4_4");

      return {
        success: true,
        message: "successfully retrieved the site details",
        data: filteredResponse,
        status: httpStatus.OK,
        meta: {
          detailLevel,
          usedCache: useCache === "true",
          totalResults: filteredResponse.length,
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAirQoActive: async (request, next) => {
    try {
      const { skip, limit, tenant } = request.query;
      const filter = generateFilter.sites(request, next);
      const responseFromListSite = await SiteModel(tenant).listAirQoActive(
        {
          filter,
          limit,
          skip,
        },
        next
      );

      if (responseFromListSite.success === false) {
        return responseFromListSite;
      }

      const modifiedResponseFromListSite = {
        ...responseFromListSite,
        data: responseFromListSite.data.filter((obj) => obj.lat_long !== "4_4"),
      };

      return modifiedResponseFromListSite;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  formatSiteName: (name, next) => {
    try {
      let nameWithoutWhiteSpace = name.replace(/\s/g, "");
      return nameWithoutWhiteSpace.toLowerCase();
    } catch (error) {
      logElement("server error", { message: error.message });
    }
  },
  retrieveInformationFromAddress: (address, next) => {
    try {
      let results = address.results[0];
      let address_components = results.address_components;
      let formatted_name = results.formatted_address;
      let geometry = results.geometry;
      let google_place_id = results.place_id;
      let types = results.types;
      let retrievedAddress = {};
      address_components.forEach((object) => {
        if (object.types.includes("locality", "administrative_area_level_3")) {
          retrievedAddress.town = object.long_name;
          retrievedAddress.city = object.long_name;
        }
        if (object.types.includes("administrative_area_level_2")) {
          retrievedAddress.district = object.long_name;
          retrievedAddress.county = object.long_name;
        }
        if (object.types.includes("administrative_area_level_1")) {
          retrievedAddress.region = object.long_name;
        }
        if (object.types.includes("route")) {
          retrievedAddress.street = object.long_name;
        }
        if (object.types.includes("country")) {
          retrievedAddress.country = object.long_name;
        }
        if (object.types.includes("sublocality", "sublocality_level_1")) {
          retrievedAddress.parish = object.long_name;
          retrievedAddress.division = object.long_name;
          retrievedAddress.village = object.long_name;
          retrievedAddress.sub_county = object.long_name;
          retrievedAddress.search_name = object.long_name;
        }
        retrievedAddress.formatted_name = formatted_name;
        retrievedAddress.geometry = geometry;
        retrievedAddress.site_tags = types;
        retrievedAddress.google_place_id = google_place_id;
        retrievedAddress.location_name =
          retrievedAddress.country !== "Uganda"
            ? `${retrievedAddress.region}, ${retrievedAddress.country}`
            : `${retrievedAddress.district}, ${retrievedAddress.country}`;
        if (!retrievedAddress.search_name) {
          retrievedAddress.search_name = retrievedAddress.town
            ? retrievedAddress.town
            : retrievedAddress.street
            ? retrievedAddress.street
            : retrievedAddress.city
            ? retrievedAddress.city
            : retrievedAddress.district;
        }
      });
      return {
        success: true,
        message: "retrieved the Google address details of this site",
        data: retrievedAddress,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  reverseGeoCode: async (latitude, longitude, next) => {
    try {
      logText("reverseGeoCode...........");
      let url = constants.GET_ADDRESS_URL(latitude, longitude);
      return await axios
        .get(url)
        .then(async (response) => {
          let responseJSON = response.data;
          if (!isEmpty(responseJSON.results)) {
            const responseFromTransformAddress = createSite.retrieveInformationFromAddress(
              responseJSON,
              next
            );
            return responseFromTransformAddress;
          } else {
            return {
              success: false,
              message: "unable to get the site address details",
              status: httpStatus.NOT_FOUND,
              errors: {
                message:
                  "review the GPS coordinates provided, we cannot get corresponding metadata",
              },
            };
          }
        })
        .catch((error) => {
          logObject("error in the reverse Geocode util", error);
          try {
            logger.error(`internal server error -- ${JSON.stringify(error)}`);
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
          return {
            success: false,
            errors: { message: error },
            message: "constants server side error",
          };
        });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getAltitude: (lat, long, next) => {
    try {
      return client
        .elevation(
          {
            params: {
              locations: [{ lat: lat, lng: long }],
              key: process.env.GOOGLE_MAPS_API_KEY,
            },
            timeout: 1000, // milliseconds
          },
          axiosInstance()
        )
        .then((r) => {
          return {
            success: true,
            message: "successfully retrieved the altitude details",
            data: r.data.results[0].elevation,
            status: httpStatus.OK,
          };
        })
        .catch((e) => {
          try {
            logger.error(`internal server error -- ${JSON.stringify(e)}`);
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
          return {
            success: false,
            message: "get altitude server error",
            errors: { message: e },
            status: httpStatus.BAD_GATEWAY,
          };
        });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  generateLatLong: (lat, long) => {
    try {
      return `${lat}_${long}`;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
    }
  },
  findNearestSitesByCoordinates: async (request, next) => {
    try {
      let { radius, latitude, longitude, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const responseFromListSites = await createSite.listAirQoActive(
        request,
        next
      );

      if (responseFromListSites.success === true) {
        let sites = responseFromListSites.data;
        let status = responseFromListSites.status
          ? responseFromListSites.status
          : "";
        let nearest_sites = [];
        sites.forEach((site) => {
          if ("latitude" in site && "longitude" in site) {
            const distanceBetweenTwoPoints = distance.distanceBtnTwoPoints(
              {
                latitude1: latitude,
                longitude1: longitude,
                latitude2: site["latitude"],
                longitude2: site["longitude"],
              },
              next
            );

            if (distanceBetweenTwoPoints < radius) {
              site["distance"] = distanceBetweenTwoPoints;
              nearest_sites.push(site);
            }
          }
        });

        logObject("nearest_sites", nearest_sites);

        return {
          success: true,
          data: nearest_sites,
          message: "successfully retrieved the nearest sites",
          status,
        };
      } else if (responseFromListSites.success === false) {
        return responseFromListSites;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createApproximateCoordinates: (
    { latitude, longitude, approximate_distance_in_km, bearing },
    next
  ) => {
    try {
      const responseFromDistanceUtil = distance.createApproximateCoordinates(
        {
          latitude,
          longitude,
          approximate_distance_in_km,
          bearing,
        },
        next
      );

      return {
        success: true,
        data: responseFromDistanceUtil,
        message: "successfully approximated the GPS coordinates",
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

module.exports = createSite;
