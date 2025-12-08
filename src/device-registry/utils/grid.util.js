const GridModel = require("@models/Grid");
const SiteModel = require("@models/Site");
const CohortModel = require("@models/Cohort");
const qs = require("qs");
const DeviceModel = require("@models/Device");
const AdminLevelModel = require("@models/AdminLevel");
const geolib = require("geolib");
const shapefile = require("shapefile");
const AdmZip = require("adm-zip");
const { logObject, logText, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { generateFilter, stringify } = require("@utils/common");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-grid-util`);
const eventUtil = require("@utils/event.util");
const { Kafka } = require("kafkajs");
const fs = require("fs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

function filterOutPrivateIDs(privateIds, randomIds) {
  // Create a Set from the privateIds array
  const privateIdSet = new Set(privateIds);

  // Check if privateIds array is empty
  if (privateIdSet.size === 0) {
    return randomIds;
  }

  // Filter randomIds array to exclude privateIds
  const filteredIds = randomIds.filter(
    (randomId) => !privateIdSet.has(randomId)
  );

  return filteredIds;
}

const createGrid = {
  batchCreate: async (request, next) => {
    try {
      const { shape } = request.body; // Assuming the input data is passed in the request body as 'data' field
      const { coordinates, type } = shape;
      const batchSize = 100; // Define the size of each batch
      const totalBatches = Math.ceil(data.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, coordinates.length);
        const batchData = coordinates.slice(startIdx, endIdx);

        // Process the batch of data using the Grid Schema
        const gridModels = batchData.map((item) => {
          // Perform any necessary transformations on 'item' before creating a Grid Model
          return new GridModel(tenant)(item);
        });

        // Bulk insert the gridModels using your preferred method (e.g., mongoose insertMany)
        await GridModel(tenant).insertMany(gridModels);
      }

      /************* END batch processing ************ */
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
      const { tenant } = request.query;
      let modifiedBody = request.body;
      const responseFromCalculateGeographicalCenter = await createGrid.calculateGeographicalCenter(
        request,
        next
      );
      logObject(
        "responseFromCalculateGeographicalCenter",
        responseFromCalculateGeographicalCenter
      );
      if (responseFromCalculateGeographicalCenter.success === false) {
        return responseFromCalculateGeographicalCenter;
      } else {
        modifiedBody["centers"] = responseFromCalculateGeographicalCenter.data;

        if (
          modifiedBody.admin_level &&
          modifiedBody.admin_level.toLowerCase() === "country"
        ) {
          modifiedBody.flag_url = constants.getFlagUrl(modifiedBody.name);
        }
        // logObject("modifiedBody", modifiedBody);

        const responseFromRegisterGrid = await GridModel(tenant).register(
          modifiedBody,
          next
        );

        // logObject("responseFromRegisterGrid in UTIL", responseFromRegisterGrid);

        if (responseFromRegisterGrid.success === true) {
          try {
            const kafkaProducer = kafka.producer({
              groupId: constants.UNIQUE_PRODUCER_GROUP,
            });
            await kafkaProducer.connect();
            await kafkaProducer.send({
              topic: constants.GRID_TOPIC,
              messages: [
                {
                  action: "create",
                  value: stringify(responseFromRegisterGrid.data),
                },
              ],
            });
            await kafkaProducer.disconnect();
          } catch (error) {
            logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
          }
          return responseFromRegisterGrid;
        } else if (responseFromRegisterGrid.success === false) {
          return responseFromRegisterGrid;
        }
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
      const { query, body } = request;
      const { tenant } = query;

      const update = body;
      const filter = generateFilter.grids(request, next);
      if (filter.success && filter.success === "false") {
        return filter;
      } else {
        const responseFromModifyGrid = await GridModel(tenant).modify(
          {
            filter,
            update,
          },
          next
        );
        return responseFromModifyGrid;
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
  delete: async (request, next) => {
    try {
      return {
        success: false,
        message: "feature temporarily disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.grids(request, next);
      if (filter.success && filter.success === "false") {
        return filter;
      } else {
        const responseFromRemoveGrid = await GridModel(tenant).remove(
          {
            filter,
          },
          next
        );
        return responseFromRemoveGrid;
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
  refresh: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { grid_id } = request.params;
      const BATCH_SIZE = 50;

      if (isEmpty(grid_id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "the Grid Object ID is required",
          })
        );
        return;
      }

      const grid = await GridModel(tenant).findById(grid_id);
      logObject("grid", grid);

      if (!grid) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid grid ID ${grid_id}, please crosscheck`,
          })
        );
        return;
      }

      const responseFromFindSites = await createGrid.findSites(
        request,
        grid.shape,
        next
      );

      if (responseFromFindSites.success === false) {
        return responseFromFindSites;
      } else if (isEmpty(responseFromFindSites.data)) {
        return {
          success: true,
          message: `Refresh successful but NO active sites yet for Grid ${grid_id.toString()}`,
          status: httpStatus.OK,
        };
      }

      const site_ids = responseFromFindSites.data.map(({ _id }) =>
        _id.toString()
      );

      // Create an array to hold all operations
      const operations = [];

      // Process the  active site_ids in batches
      for (let i = 0; i < site_ids.length; i += BATCH_SIZE) {
        const batchSiteIds = site_ids.slice(i, i + BATCH_SIZE);
        // Add new grid_id to sites
        operations.push({
          updateMany: {
            filter: {
              _id: { $in: batchSiteIds },
              grids: { $ne: grid_id.toString() },
            },
            update: {
              $addToSet: { grids: grid_id.toString() },
            },
          },
        });
      }

      // Execute the bulk operation
      const addToSetResponse = await SiteModel(tenant).bulkWrite(operations);
      logObject("addToSetResponse", addToSetResponse);

      // Check if addToSet operation was successful
      if (!addToSetResponse.ok) {
        logger.error(
          `🐛🐛 Internal Server Error -- Some associated sites may not have been updated during Grid refresh`
        );
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Only ${addToSetResponse.nModified} out of ${site_ids.length} sites were updated`,
            }
          )
        );
        return;
      }

      try {
        // Remove the Grid from INACTIVE Sites
        const pullResponse = await SiteModel(tenant).updateMany(
          {
            _id: { $nin: site_ids }, // select INACTIVE sites
            grids: { $in: [grid_id.toString()] }, // Select sites that contain the grid_id
          },
          {
            $pull: { grids: grid_id.toString() }, // Remove grid_id from the selected sites
          }
        );

        logObject("pullResponse", pullResponse);

        // Check if pull operation was successful
        if (!pullResponse.ok) {
          logger.error(
            `🐛🐛 Internal Server Error -- Some associated sites may not have been updated during Grid refresh`
          );
        }
      } catch (error) {
        logger.error(
          `🐛🐛 Internal Server Error -- grid refresh -- Remove the Grid from INACTIVE Sites -- ${stringify(
            error
          )}`
        );
      }

      return {
        success: true,
        message: `The Refresh for Grid ${grid_id.toString()} has been successful`,
        status: httpStatus.OK,
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
      return;
    }
  },
  calculateGeographicalCenter: async (request, next) => {
    try {
      const { coordinates, type } = request.body.shape;
      logObject("coordinates", coordinates);
      logObject("type", type);

      if (isEmpty(coordinates)) {
        return {
          success: false,
          message: "Missing coordinates to calculate the center of the grid",
          errors: { message: "Missing coordinates" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      let centers = [];
      if (type === "Polygon") {
        const flattenedPolygon = coordinates.flat();
        centers = [geolib.getCenter(flattenedPolygon)];
      } else if (type === "MultiPolygon") {
        const flattenedPolygons = coordinates.map((polygon) => polygon.flat());
        centers = flattenedPolygons.map((polygon) => geolib.getCenter(polygon));
      }

      return {
        success: true,
        message: "Successfully calculated the centers",
        data: centers,
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
  findSites: async (request, shape, next) => {
    try {
      logText("we are now finding Sites................");
      const { query } = request;
      const { tenant } = query;

      const filter = generateFilter.grids(request, next);
      if (filter.success && filter.success === false) {
        return filter;
      }

      if (isEmpty(filter)) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: { message: "Getting an empty filter object for grids" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      const grid = await GridModel(tenant)
        .findOne(filter)
        .lean();

      logObject("the grid in findSites", grid);

      if (isEmpty(grid)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Unable to find the provided grid model" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      let gridPolygon = [];
      const { type, coordinates } = shape;

      if (type === "Polygon") {
        gridPolygon = coordinates[0].map(([longitude, latitude]) => ({
          longitude,
          latitude,
        }));
      } else if (type === "MultiPolygon") {
        coordinates.forEach((polygon) => {
          const polygonPoints = polygon[0].map(([longitude, latitude]) => ({
            longitude,
            latitude,
          }));
          gridPolygon.push(...polygonPoints);
        });
      }

      const sitesWithDeployedDevices = await DeviceModel(tenant).distinct(
        "site_id"
      );

      // logObject("sitesWithDeployedDevices", sitesWithDeployedDevices);

      // Calculate the bounding box of the grid polygon
      const minLongitude = Math.min(
        ...gridPolygon.map((point) => point.longitude)
      );
      const maxLongitude = Math.max(
        ...gridPolygon.map((point) => point.longitude)
      );
      const minLatitude = Math.min(
        ...gridPolygon.map((point) => point.latitude)
      );
      const maxLatitude = Math.max(
        ...gridPolygon.map((point) => point.latitude)
      );

      // Fetch only sites within the bounding box
      const sites = await SiteModel(tenant)
        .find({
          _id: { $in: sitesWithDeployedDevices },
          longitude: { $gte: minLongitude, $lte: maxLongitude },
          latitude: { $gte: minLatitude, $lte: maxLatitude },
        })
        .lean();

      const site_ids = sites
        .filter(
          ({ latitude, longitude }) => !isEmpty(latitude) && !isEmpty(longitude)
        )
        .filter(({ latitude, longitude }) =>
          geolib.isPointInPolygon({ latitude, longitude }, gridPolygon)
        )
        .map(({ _id }) => _id);

      const successMessage = isEmpty(site_ids)
        ? "No associated Sites found"
        : "Successfully searched for the associated Sites";

      return {
        success: true,
        message: successMessage,
        data: site_ids,
        status: httpStatus.OK,
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
      return;
    }
  },
  // Replace the existing 'list' function with this one:

  list: async (request, next) => {
    try {
      const {
        tenant,
        limit,
        skip,
        detailLevel = "full",
        sortBy,
        order,
      } = request.query;
      const { cohort_id } = request.query;
      const filter = generateFilter.grids(request, next);

      const _skip = Math.max(0, parseInt(skip, 10) || 0);
      const _limit = Math.max(1, Math.min(parseInt(limit, 10) || 30, 80));
      const sortOrder = order === "asc" ? 1 : -1;
      const sortField = sortBy ? sortBy : "createdAt";

      let cohortSiteIds = [];
      if (cohort_id) {
        // We need to get devices for the cohort, then sites for those devices
        const cohortDevicesResponse = await eventUtil.getDevicesFromCohort({
          tenant,
          cohort_id,
        });
        if (cohortDevicesResponse.success) {
          const deviceIds = cohortDevicesResponse.data
            .split(",")
            .map((id) => ObjectId(id));
          const devices = await DeviceModel(tenant).find(
            { _id: { $in: deviceIds } },
            "site_id"
          );
          cohortSiteIds = devices.map((d) => d.site_id).filter(Boolean);
        }
      }

      // Optimized query to get all private site IDs in one go
      const privateSiteIdsResponse = await CohortModel(tenant).aggregate([
        { $match: { visibility: false } },
        {
          $lookup: {
            from: "devices",
            localField: "_id",
            foreignField: "cohorts",
            as: "devices",
          },
        },
        { $unwind: "$devices" },
        { $match: { "devices.site_id": { $ne: null } } },
        { $group: { _id: null, site_ids: { $addToSet: "$devices.site_id" } } },
      ]);

      const privateSiteIds =
        privateSiteIdsResponse.length > 0
          ? privateSiteIdsResponse[0].site_ids
          : [];

      const exclusionProjection = constants.GRIDS_EXCLUSION_PROJECTION(
        detailLevel
      );
      let pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "sites",
            localField: "_id",
            foreignField: "grids",
            as: "sites",
          },
        },
        {
          $addFields: {
            sites: {
              $filter: {
                input: "$sites",
                as: "site",
                cond: { $not: { $in: ["$$site._id", privateSiteIds] } },
              },
            },
            // If cohort_id is provided, further filter the sites
            sites: cohort_id
              ? {
                  $filter: {
                    input: "$sites",
                    as: "site",
                    cond: {
                      $in: ["$$site._id", cohortSiteIds],
                    },
                  },
                }
              : "$sites",
          },
        },
      ];

      if (detailLevel === "full") {
        pipeline.push({
          $lookup: {
            from: "devices",
            localField: "activeMobileDevices.device_id",
            foreignField: "_id",
            as: "mobileDevices",
          },
        });
      }

      pipeline.push(
        { $project: constants.GRIDS_INCLUSION_PROJECTION },
        { $project: exclusionProjection }
      );

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

      const results = await GridModel(tenant)
        .aggregate(facetPipeline)
        .allowDiskUse(true);

      const agg =
        Array.isArray(results) && results[0]
          ? results[0]
          : { paginatedResults: [], totalCount: [] };
      const paginatedResults = agg.paginatedResults || [];
      const total =
        Array.isArray(agg.totalCount) && agg.totalCount[0]
          ? agg.totalCount[0].count
          : 0;

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
        limit: _limit,
        skip: _skip,
        page: Math.floor(_skip / _limit) + 1,
        totalPages: Math.ceil(total / _limit),
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
        message: "Successfully retrieved grids",
        data: paginatedResults,
        status: httpStatus.OK,
        meta,
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

  updateShape: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { shape, update_reason } = body;

      const filter = generateFilter.grids(request, next);
      if (filter.success && filter.success === "false") {
        return filter;
      }

      // First, get the existing grid to validate it exists
      const existingGrid = await GridModel(tenant)
        .findOne(filter)
        .lean();
      if (!existingGrid) {
        return {
          success: false,
          message: "Grid not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "The specified grid does not exist" },
        };
      }

      // Calculate new centers for the updated shape
      const modifiedRequest = {
        ...request,
        body: { shape },
      };

      const responseFromCalculateGeographicalCenter = await createGrid.calculateGeographicalCenter(
        modifiedRequest,
        next
      );

      if (responseFromCalculateGeographicalCenter.success === false) {
        return responseFromCalculateGeographicalCenter;
      }

      const newCenters = responseFromCalculateGeographicalCenter.data;

      // Prepare the update object with shape and recalculated centers
      const update = {
        shape,
        centers: newCenters,
        $push: {
          shape_update_history: {
            updated_at: new Date(),
            reason: update_reason,
            previous_shape: existingGrid.shape,
            previous_centers: existingGrid.centers,
          },
        },
      };

      const responseFromUpdateGridShape = await GridModel(tenant).modifyShape(
        {
          filter,
          update,
        },
        next
      );

      if (responseFromUpdateGridShape.success === true) {
        // Refresh the grid to update associated sites with new boundaries
        try {
          const refreshRequest = {
            ...request,
            params: { grid_id: existingGrid._id.toString() },
          };
          await createGrid.refresh(refreshRequest, next);
        } catch (refreshError) {
          logger.error(
            `Grid shape updated but refresh failed: ${refreshError.message}`
          );
        }
      }

      return responseFromUpdateGridShape;
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

  /************* admin levels **************************************/
  listAdminLevels: async (request, next) => {
    try {
      const { tenant, limit, skip } = request.query;
      const filter = generateFilter.admin_levels(request, next);
      const _skip = Math.max(0, parseInt(skip, 10) || 0);
      const _limit = Math.max(1, Math.min(parseInt(limit, 10) || 30, 80));

      const responseFromListAdminLevels = await AdminLevelModel(tenant).list(
        {
          filter,
          limit: _limit,
          skip: _skip,
        },
        next
      );
      return responseFromListAdminLevels;
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
  updateAdminLevel: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.admin_levels(request, next);

      logObject("filter", filter);
      const update = request.body;
      const responseFromUpdateAdminLevel = await AdminLevelModel(tenant).modify(
        {
          filter,
          update,
        },
        next
      );
      logObject("responseFromUpdateAdminLevel", responseFromUpdateAdminLevel);
      return responseFromUpdateAdminLevel;
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
  deleteAdminLevel: async (request, next) => {
    try {
      return {
        success: false,
        message: "feature temporarily disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      const { tenant } = request.query;
      const filter = generateFilter.admin_levels(request, next);

      const responseFromDeleteAdminLevel = await AdminLevelModel(tenant).remove(
        {
          filter,
        },
        next
      );
      return responseFromDeleteAdminLevel;
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
  createAdminLevel: async (request, next) => {
    try {
      const { tenant } = request.query;
      const responseFromCreateAdminLevel = await AdminLevelModel(
        tenant
      ).register(request.body, next);
      return responseFromCreateAdminLevel;
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

  /********************* manage grids **********************************  */
  findGridUsingGPSCoordinates: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { latitude, longitude } = body;

      const grids = await GridModel(tenant)
        .find()
        .lean();

      const matchingGrid = grids.find((grid) => {
        const { type, coordinates } = grid.shape;
        if (type === "Polygon") {
          const polygon = coordinates[0].map(([longitude, latitude]) => ({
            latitude,
            longitude,
          }));
          return geolib.isPointInPolygon({ latitude, longitude }, polygon);
        } else if (type === "MultiPolygon") {
          const polygons = coordinates.map((polygon) =>
            polygon[0].map(([longitude, latitude]) => ({
              latitude,
              longitude,
            }))
          );
          return polygons.some((polygon) =>
            geolib.isPointInPolygon({ latitude, longitude }, polygon)
          );
        }
        return false;
      });

      if (!matchingGrid) {
        return {
          success: true,
          message: "No Grid found for the provided coordinates",
          status: httpStatus.OK,
          data: [],
        };
      }

      return {
        success: true,
        message: "Grid found",
        data: matchingGrid,
        status: httpStatus.OK,
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
  createGridFromShapefile: async (request, next) => {
    const uploadedFile = request.file;
    const shapefilePath = uploadedFile.path;
    try {
      const zip = new AdmZip(uploadedFile.path);
      zip.extractAllTo("uploads/", true);
      logObject("uploadedFile", uploadedFile);
      logObject("shapefilePath", shapefilePath);
      const file = await shapefile.open(shapefilePath);
      const source = await file.source();

      // Read all features from the shapefile
      const features = [];
      while (true) {
        const result = await source.read();
        if (result.done) break;
        features.push(result.value);
      }

      const coordinates = features[0].geometry.coordinates;
      const shapeType = features[0].geometry.type;

      const gridData = {
        shape: {
          type: shapeType,
          coordinates: coordinates,
        },
      };
      fs.unlinkSync(shapefilePath);
      return {
        success: true,
        data: gridData,
        message: "Successfully retrieved the Grid format",
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("error", error);
      if (fs.existsSync(shapefilePath)) {
        fs.unlinkSync(shapefilePath);
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
  listAvailableSites: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { grid_id } = request.params;

      const grid = await GridModel(tenant).findById(grid_id);

      if (!grid) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid grid ID ${grid_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const assignedSiteIds = await DeviceModel(tenant)
        .distinct("site_id", { site_id: { $exists: true } })
        .lean();

      const sites = await createGrid.findSites(request, grid.shape, next);

      const availableSites = Array.isArray(sites)
        ? sites.filter(({ _id }) => !assignedSiteIds.includes(_id.toString()))
        : [];

      return {
        success: true,
        message: `Retrieved all available sites for grid ${grid_id}`,
        data: availableSites,
        status: httpStatus.OK,
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
  listAssignedSites: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { grid_id } = request.params;
      const grid = await GridModel(tenant).findById(grid_id);
      if (!grid) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid grid ID ${grid_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromListAssignedSites = await SiteModel(tenant)
        .aggregate([
          {
            $match: {
              grids: { $in: [grid_id] },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              long_name: 1,
              description: 1,
              generated_name: 1,
              country: 1,
              district: 1,
              region: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
            },
          },
        ])
        .exec();

      logObject("responseFromListAssignedSites", responseFromListAssignedSites);

      return {
        success: true,
        message: `retrieved all assigned sites for grid ${grid_id}`,
        data: responseFromListAssignedSites,
        status: httpStatus.OK,
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
  getSiteAndDeviceIds: async (request, next) => {
    try {
      const { grid_id, tenant } = { ...request.query, ...request.params };
      const gridDetails = await GridModel(tenant).findById(grid_id);
      if (isEmpty(gridDetails)) {
        return {
          success: false,
          message: "Bad Request Errors",
          errors: { message: "This Grid does not exist" },
          status: httpStatus.BAD_REQUEST,
        };
      }
      // Fetch sites based on the provided Grid ID
      const sites = await SiteModel(tenant).find({ grids: grid_id });

      // Extract site IDs from the fetched sites
      const site_ids = sites.map((site) => site._id);

      // Fetch devices for each site concurrently
      const device_ids_promises = site_ids.map(async (siteId) => {
        const devices = await DeviceModel(tenant).find({ site_id: siteId });
        return devices.map((device) => device._id);
      });

      const device_ids = await Promise.all(device_ids_promises).then((ids) =>
        ids.flat()
      );

      logObject("site_ids:", site_ids);
      logObject("device_ids:", device_ids);

      return {
        success: true,
        message: "Successfully returned the Site IDs and the Device IDs",
        status: httpStatus.OK,
        data: { site_ids, device_ids },
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
  filterOutPrivateSites: async (request, next) => {
    try {
      const { tenant, sites, site_ids, site_names } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const privateGrids = await GridModel(tenant)
        .find({
          visibility: false,
        })
        .select("_id")
        .lean();

      const privateGridIds = privateGrids.map((grid) => grid._id);
      const privateSites = await SiteModel(tenant).find({
        grids: { $in: privateGridIds },
      });

      const privateSiteIds = privateSites.map((site) => site._id.toString());
      const privateSiteNames = privateSites.map((site) => site.generated_name);

      let idsForSites, siteIds, siteNames;

      if (sites || site_ids) {
        idsForSites = sites ? sites : site_ids || [];
        siteIds = idsForSites.map((site) => site.toString());
      } else if (site_names) {
        siteNames = site_names;
      }

      let publicSites;
      if (siteIds) {
        publicSites = filterOutPrivateIDs(privateSiteIds, siteIds);
      } else if (siteNames) {
        publicSites = filterOutPrivateIDs(privateSiteNames, siteNames);
      }

      return {
        success: true,
        status: httpStatus.OK,
        data: publicSites,
        message: "operation successful",
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
  findNearestCountry: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { latitude, longitude } = body;
      const { limit = 1 } = query; // Default to returning just 1 nearest country

      // Validate the inputs
      if (!latitude || !longitude) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Both latitude and longitude are required" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Find grids where admin_level is 'country'
      const countryGrids = await GridModel(tenant)
        .find({ admin_level: "country" })
        .lean();

      if (isEmpty(countryGrids)) {
        return {
          success: true,
          message: "No country grids found in the database",
          status: httpStatus.OK,
          data: [],
        };
      }

      // Calculate distance to each country's center point
      const countriesWithDistances = countryGrids.map((grid) => {
        // Use the first center point of the grid
        if (isEmpty(grid.centers) || isEmpty(grid.centers[0])) {
          return {
            ...grid,
            distance: Number.MAX_VALUE, // If no center point, set to max distance
          };
        }

        const center = grid.centers[0];
        const distance = geolib.getDistance(
          { latitude, longitude },
          { latitude: center.latitude, longitude: center.longitude }
        );

        return {
          ...grid,
          distance,
        };
      });

      // Sort by distance (ascending)
      const sortedCountries = countriesWithDistances.sort(
        (a, b) => a.distance - b.distance
      );

      // Return the nearest country(ies) based on the limit
      const nearestCountries = sortedCountries.slice(0, Number(limit));

      return {
        success: true,
        message: "Successfully found nearest country(ies)",
        data: nearestCountries,
        status: httpStatus.OK,
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
  listCountries: async (request, next) => {
    try {
      const { tenant } = request.query;
      // Optimized query to get all private site IDs in one go
      const privateSiteIdsResponse = await CohortModel(tenant).aggregate([
        { $match: { visibility: false } },
        {
          $lookup: {
            from: "devices",
            localField: "_id",
            foreignField: "cohorts",
            as: "devices",
          },
        },
        { $unwind: "$devices" },
        { $match: { "devices.site_id": { $ne: null } } },
        { $group: { _id: null, site_ids: { $addToSet: "$devices.site_id" } } },
      ]);

      const privateSiteIds =
        privateSiteIdsResponse.length > 0
          ? privateSiteIdsResponse[0].site_ids
          : [];
      const pipeline = [
        {
          $match: { admin_level: "country" },
        },
        {
          $lookup: {
            from: "sites",
            localField: "_id",
            foreignField: "grids",
            as: "sites",
          },
        },
        {
          $addFields: {
            sites: {
              $filter: {
                input: "$sites",
                as: "site",
                cond: { $not: { $in: ["$$site._id", privateSiteIds] } },
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            country: { $toLower: "$name" },
            sites: { $size: "$sites" },
          },
        },
        {
          $sort: {
            country: 1,
          },
        },
      ];

      const results = await GridModel(tenant).aggregate(pipeline);

      const countriesWithFlags = results.map((countryData) => {
        // Safely handle null or undefined country names
        const rawCountryName =
          typeof countryData.country === "string" ? countryData.country : "";

        // Normalize name: handle underscores, hyphens, apostrophes, and extra spaces
        // before converting to a standardized Title Case format.
        const formattedCountryName = rawCountryName
          .replace(/_/g, " ")
          .split(/(\s+|-|')/) // Split by spaces, hyphens, or apostrophes, keeping delimiters
          .filter(Boolean) // Remove empty strings from the result
          .map((part) => {
            // Only capitalize word parts, not delimiters
            if (part.match(/^[a-zA-Z0-9]+$/)) {
              return (
                part.charAt(0).toLocaleUpperCase() + part.slice(1).toLowerCase()
              );
            }
            return part; // Return delimiters as is
          })
          .join("")
          .trim();

        return {
          ...countryData,
          flag_url: constants.getFlagUrl(formattedCountryName),
        };
      });

      return {
        success: true,
        message: "Successfully retrieved countries and site counts.",
        data: countriesWithFlags,
        status: httpStatus.OK,
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

module.exports = createGrid;
