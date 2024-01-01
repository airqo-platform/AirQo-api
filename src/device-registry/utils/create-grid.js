const GridModel = require("@models/Grid");
const SiteModel = require("@models/Site");
const DeviceModel = require("@models/Device");
const AdminLevelModel = require("@models/AdminLevel");
const { HttpError } = require("@utils/errors");
const geolib = require("geolib");
const shapefile = require("shapefile");
const AdmZip = require("adm-zip");
const { logObject, logText } = require("./log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-grid-util`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
                  value: JSON.stringify(responseFromRegisterGrid.data),
                },
              ],
            });
            await kafkaProducer.disconnect();
          } catch (error) {
            logger.error(`Internal Server Error -- ${error.message}`);
          }
          return responseFromRegisterGrid;
        } else if (responseFromRegisterGrid.success === false) {
          return responseFromRegisterGrid;
        }
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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

      if (isEmpty(grid_id)) {
        return {
          success: false,
          message: "Bad Request",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "the Grid Object ID is required" },
        };
      }

      const grid = await GridModel(tenant).findById(grid_id);
      logObject("grid", grid);

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

      const responseFromFindSites = await createGrid.findSites(
        request,
        grid.shape,
        next
      );

      logObject("responseFromFindSites", responseFromFindSites);

      if (responseFromFindSites.success === false) {
        return responseFromFindSites;
      }

      const site_ids = responseFromFindSites.data.map(({ _id }) =>
        _id.toString()
      );

      // Add new grid_id to sites
      const addToSetResponse = await SiteModel(tenant).updateMany(
        {
          _id: { $in: site_ids },
          grids: { $ne: grid_id.toString() },
        },
        {
          $addToSet: { grids: grid_id.toString() },
        }
      );

      logObject("addToSetResponse", addToSetResponse);

      // Remove old grid_ids from sites
      const pullResponse = await SiteModel(tenant).updateMany(
        {
          _id: { $in: site_ids },
          grids: { $ne: grid_id.toString() },
        },
        {
          $pull: { grids: { $ne: grid_id.toString() } },
        }
      );

      logObject("pullResponse", pullResponse);

      if (addToSetResponse.ok && pullResponse.ok) {
        return {
          success: true,
          message: `The Refresh for Grid ${grid_id.toString()} has been successful`,
          status: httpStatus.OK,
        };
      } else {
        logger.error(
          "Internal Server Error -- Some associated sites may not have been updated during Grid refresh"
        );
        return {
          success: false,
          message: "Some associated sites may not have been updated.",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message: `Only ${pullResponse.nModified} out of ${site_ids.length} sites were updated`,
          },
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
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
      logger.error(`Internal Server Error ${error.message}`);
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

      logObject("sitesWithDeployedDevices", sitesWithDeployedDevices);

      const sites = await SiteModel(tenant).find({
        _id: { $in: sitesWithDeployedDevices },
      });

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
      logger.error(`Internal Server Error ${error.message}`);
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
      const { tenant, limit, skip } = request.query;
      const filter = generateFilter.grids(request, next);
      const responseFromListGrid = await GridModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListGrid;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      const responseFromListAdminLevels = await AdminLevelModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListAdminLevels;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      const { tenant, sites } = {
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
      // Fetch sites based on the private Grid IDs
      const privateSites = await SiteModel(tenant).find({
        grids: { $in: privateGridIds },
      });

      // Extract site IDs from the fetched sites
      const privateSiteIds = privateSites.map((site) => site._id.toString());
      const siteIds = sites.map((site) => site.toString());
      const publicSites = filterOutPrivateIDs(privateSiteIds, siteIds);

      return {
        success: true,
        status: httpStatus.OK,
        data: publicSites,
        message: "operation successful",
      };
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
