const GridSchema = require("@models/Grid");
const SiteSchema = require("@models/Site");
const DeviceSchema = require("@models/Device");
const AdminLevelSchema = require("@models/AdminLevel");
const { getModelByTenant } = require("@config/database");
const geolib = require("geolib");
const geohash = require("ngeohash");
const { Transform } = require("stream");
const shapefile = require("shapefile");
const AdmZip = require("adm-zip");
const { logObject, logElement, logText } = require("./log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-grid-util`);
const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { Kafka } = require("kafkajs");
const fs = require("fs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const GridModel = (tenant) => {
  try {
    const grids = mongoose.model("grids");
    return grids;
  } catch (error) {
    // logObject("error", error);
    const grids = getModelByTenant(tenant, "grid", GridSchema);
    return grids;
  }
};
const SiteModel = (tenant) => {
  try {
    const sites = mongoose.model("sites");
    return sites;
  } catch (error) {
    const sites = getModelByTenant(tenant, "site", SiteSchema);
    return sites;
  }
};
const AdminLevelModel = (tenant) => {
  try {
    const adminlevels = mongoose.model("adminlevels");
    return adminlevels;
  } catch (error) {
    const adminlevels = getModelByTenant(
      tenant,
      "adminlevel",
      AdminLevelSchema
    );
    return adminlevels;
  }
};

const DeviceModel = (tenant) => {
  try {
    const devices = mongoose.model("devices");
    return devices;
  } catch (error) {
    const devices = getModelByTenant(tenant, "device", DeviceSchema);
    return devices;
  }
};

class GridTransformStream extends Transform {
  constructor(centers, options) {
    super({ objectMode: true, ...options });
    this.centers = centers;
  }

  _transform(chunk, encoding, callback) {
    try {
      // Perform any necessary transformations on 'chunk' before creating a Grid Model
      const gridModel = new GridModel({
        // Use the 'chunk' data and the 'centers' as needed
        // Example: grid_id: chunk.grid_id, centers: this.centers
        // Modify the code according to your specific requirements
      });
      this.push(gridModel);
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

const generateGeoHash = (latitude, longitude, precision = 9) => {
  try {
    // Calculate the boundaries for a radius of 1 kilometer around the target location
    const radius = 1000; // 1 kilometer
    const bounds = geolib.getBoundsOfDistance({ latitude, longitude }, radius);

    // Get the bounding coordinates
    const { maxLat, minLat, maxLng, minLng } = bounds;

    // Calculate the center point of the bounding box
    const centerLat = (maxLat + minLat) / 2;
    const centerLng = (maxLng + minLng) / 2;

    // Generate the GeoHash string for the center point
    const geoHash = geohash.encode(centerLat, centerLng, precision);

    return geoHash;
  } catch (error) {
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const createGrid = {
  batchCreate: async (request) => {
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
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  streamCreate: async (request) => {
    try {
      /****************START stream processing ********** */
      // const { data } = request.body; // Assuming the input data is passed in the request body as 'data' field
      const { shape } = request.body;
      const { type, coordinates } = shape;
      // Create a Readable stream from the input data
      const readableStream = new Readable({
        objectMode: true,
        read() {
          // Push each data item into the stream
          coordinates.forEach((item) => this.push(item));
          this.push(null); // Signal the end of the stream
        },
      });

      const centerResponse = await calculateGeographicalCenter(request);
      if (!centerResponse.success) {
        // Handle the error or return an appropriate response
      }
      const centers = centerResponse.data;

      // Create a custom Transform stream for processing and transforming the data
      const transformStream = new GridTransformStream(centers);

      // Create a Writable stream to save the processed data using GridModel.create()
      const writableStream = new Writable({
        objectMode: true,
        write(gridModel, encoding, callback) {
          GridModel(tenant).create(gridModel, (error) => {
            if (error) {
              callback(error);
            } else {
              callback();
            }
          });
        },
      });

      // Connect the streams together using stream.pipeline() or a similar method
      stream.pipeline(
        readableStream,
        transformStream,
        writableStream,
        (error) => {
          if (error) {
            console.error("Error during streaming processing:", error);
            res.status(500).json({
              success: false,
              message: "Error during streaming processing",
            });
          } else {
            res.status(200).json({
              success: true,
              message: "Streaming processing completed",
            });
          }
        }
      );

      /******************* END stream processing ***************/
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  create: async (request) => {
    try {
      const { tenant } = request.query;
      let modifiedBody = request.body;
      const responseFromCalculateGeographicalCenter = await createGrid.calculateGeographicalCenter(
        request
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
          modifiedBody
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
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  update: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const update = body;
      const filter = generateFilter.grids(request);
      if (filter.success && filter.success === "false") {
        return filter;
      } else {
        const responseFromModifyGrid = await GridModel(tenant).modify({
          filter,
          update,
        });
        return responseFromModifyGrid;
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.grids(request);
      if (filter.success && filter.success === "false") {
        return filter;
      } else {
        const responseFromRemoveGrid = await GridModel(tenant).remove({
          filter,
        });
        return responseFromRemoveGrid;
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "unable to delete airqloud",
        errors: error.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  refresh: async (request) => {
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
        grid.shape
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
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  calculateGeographicalCenter: async (request) => {
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
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  findSites: async (request, shape) => {
    try {
      logText("we are now finding Sites................");
      const { query } = request;
      const { tenant } = query;

      const filter = generateFilter.grids(request);
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
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      const limit = 1000;
      const skip = parseInt(query.skip) || 0;

      const filter = generateFilter.grids(request);

      if (filter.success && filter.success === "false") {
        return filter;
      }

      const responseFromListGrid = await GridModel(tenant).list({
        filter,
        limit,
        skip,
      });
      return responseFromListGrid;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /************* admin levels **************************************/
  listAdminLevels: async (request) => {
    try {
      const { tenant, limit, skip } = request.query;
      const filter = generateFilter.admin_levels(request);
      if (filter.success && filter.success === "false") {
        return filter;
      }
      const responseFromListAdminLevels = await AdminLevelModel(tenant).list({
        filter,
        limit,
        skip,
      });
      return responseFromListAdminLevels;
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateAdminLevel: async (request) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.admin_levels(request);
      if (filter.success && filter.success === "false") {
        return filter;
      }
      logObject("filter", filter);
      const update = request.body;
      const responseFromUpdateAdminLevel = await AdminLevelModel(tenant).modify(
        {
          filter,
          update,
        }
      );
      logObject("responseFromUpdateAdminLevel", responseFromUpdateAdminLevel);
      return responseFromUpdateAdminLevel;
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteAdminLevel: async (request) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.admin_levels(request);
      if (filter.success && filter.success === "false") {
        return filter;
      }
      const responseFromDeleteAdminLevel = await AdminLevelModel(tenant).remove(
        {
          filter,
        }
      );
      return responseFromDeleteAdminLevel;
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  createAdminLevel: async (request) => {
    try {
      const { tenant } = request.query;
      const responseFromCreateAdminLevel = await AdminLevelModel(
        tenant
      ).register(request.body);
      return responseFromCreateAdminLevel;
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /********************* manage grids **********************************  */

  findGridUsingGPSCoordinates: async (request) => {
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
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  createGridFromShapefile: async (request) => {
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
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  listAvailableSites: async (request) => {
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

      const sites = await createGrid.findSites(request, grid.shape);

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
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  listAssignedSites: async (request) => {
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
      logElement("Internal Server Error", error.message);
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
};

module.exports = createGrid;
