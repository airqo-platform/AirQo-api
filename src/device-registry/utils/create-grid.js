const GridSchema = require("@models/Grid");
const SiteSchema = require("@models/Site");
const AdminLevelSchema = require("@models/AdminLevel");
const { getModelByTenant } = require("@config/database");
const geolib = require("geolib");
const geohash = require("ngeohash");
const { Transform } = require("stream");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const shapefile = require("shapefile");
const AdmZip = require("adm-zip");
const { logObject, logElement, logText } = require("./log");

const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-grid-util`);
// const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});
const commonUtil = require("@utils/common");

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

class GridTransformStream extends Transform {
  constructor(options) {
    super({ objectMode: true, ...options });
  }

  _transform(chunk, encoding, callback) {
    try {
      // Perform any necessary transformations on 'chunk' before creating a Grid Model
      const gridModel = GridModel(tenant)(chunk);
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
  retrieveCoordinates: async (request) => {
    try {
      const { tenant } = request.query;
      if (isEmpty(request.query.id)) {
        return {
          success: false,
          message: "Bad Request",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "the Grid Object ID is required" },
        };
      }
      const responseFromFindGrid = await GridModel(tenant)
        .findById(ObjectId(request.query.id))
        .lean();

      if (isEmpty(responseFromFindGrid)) {
        return {
          success: false,
          message: "unable to retrieve grid details",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "no record exists for this grid_id",
          },
        };
      }

      return {
        data: responseFromFindGrid.shape,
        success: true,
        message: "retrieved the coordinates",
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
      // const { data } = req.body; // Assuming the input data is passed in the request body as 'data' field
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

      // Create a custom Transform stream for processing and transforming the data
      const transformStream = new GridTransformStream();

      // Create a Writable stream to save the processed data using GridModel.create()
      const writableStream = new Writable({
        objectMode: true,
        write(gridModel, encoding, callback) {
          gridModel.save((error) => {
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
      const { query } = request;
      const { tenant, id } = query;

      const updateBodyForGrid = {
        body: {
          shape: {},
        },
      };

      const responseFromRetrieveCoordinates = await createGrid.retrieveCoordinates(
        request
      );
      if (!responseFromRetrieveCoordinates.success) {
        return responseFromRetrieveCoordinates;
      } else {
        updateBodyForGrid.body.shape.coordinates =
          responseFromRetrieveCoordinates.data.coordinates[0];
      }

      const responseFromFindSites = await createGrid.findSites(request);
      if (!responseFromFindSites.success) {
        return responseFromFindSites;
      } else {
        updateBodyForGrid.body.sites = responseFromFindSites.data || [];
      }

      const requestForCalucaltionGridCenter = {
        body: {
          coordinates: updateBodyForGrid.body.shape.coordinates,
        },
      };

      const responseFromCalculateGeographicalCenter = await createGrid.calculateGeographicalCenter(
        requestForCalucaltionGridCenter
      );

      if (!responseFromCalculateGeographicalCenter.success) {
        return responseFromCalculateGeographicalCenter;
      } else {
        updateBodyForGrid.body.center_point =
          responseFromCalculateGeographicalCenter.data;
      }

      const updateResponse = await GridModel(tenant).findByIdAndUpdate(
        ObjectId(id),
        updateBodyForGrid
      );

      if (updateResponse) {
        return {
          success: true,
          message: "successfully refreshed the Grid",
          status: httpStatus.OK,
          data: updateResponse,
        };
      } else {
        return {
          success: false,
          message: "Internal Server Error",
          errors: { message: "Unable to update Grid" },
          status: httpStatus.BAD_REQUEST,
        };
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

  findSites: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const filter = generateFilter.grids(request);
      if (!filter.success) {
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
      if (isEmpty(grid)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Unable to find the provided grid model" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const gridPolygon = grid.shape.coordinates[0].map(
        ([longitude, latitude]) => ({
          longitude,
          latitude,
        })
      );

      const sites = await SiteModel(tenant).find({});

      const site_ids = sites
        .filter(
          ({ latitude, longitude }) => !isEmpty(latitude) && !isEmpty(longitude)
        )
        .filter(({ latitude, longitude }) =>
          geolib.isPointInPolygon({ latitude, longitude }, gridPolygon)
        )
        .map(({ _id }) => _id);

      const successMessage = isEmpty(site_ids)
        ? "no associated Sites found"
        : "successfully searched for the associated Sites";

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
      const update = request.body;
      const responseFromUpdateAdminLevel = await AdminLevelModel(tenant).modify(
        {
          filter,
          update,
        }
      );
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
      const targetGeoHash = generateGeoHash(latitude, longitude);
      if (targetGeoHash.success && targetGeoHash.success === false) {
        return targetGeoHash;
      }
      const nearbyGrids = await GridModel(tenant).find({
        geoHash: { $regex: `^${targetGeoHash}` },
      });
      return {
        success: true,
        message: "successfully retrieved the nearest Grids",
        data: nearbyGrids,
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
    try {
      const uploadedFile = request.file;
      const zip = new AdmZip(uploadedFile.path);
      zip.extractAllTo("uploads/", true);

      const shapefilePath = request.file.path;
      logObject("request.file", request.file);
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

      // Extract the coordinates and shape type from the first feature
      const coordinates = features[0].geometry.coordinates;
      const shapeType = features[0].geometry.type;

      // Create the Grid data object
      const gridData = {
        shape: {
          type: shapeType,
          coordinates: coordinates,
        },
      };
      return {
        success: true,
        data: gridData,
        status: httpStatus.OK,
        message: "successfully retrieved the Grid format",
      };
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

      const responseFromListAvailableSites = await SiteModel(tenant)
        .aggregate([
          {
            $match: {
              grids: { $nin: [grid_id] },
            },
          },
          {
            $project: {
              _id: 1,
              long_name: 1,
              name: 1,
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

      logObject(
        "responseFromListAvailableSites",
        responseFromListAvailableSites
      );

      return {
        success: true,
        message: `retrieved all available devices for grid ${grid_id}`,
        data: responseFromListAvailableSites,
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
  assignManySitesToGrid: async (request) => {
    try {
      const { grid_id } = request.params;
      const { site_ids } = request.body;
      const { tenant } = request.query;

      const grid = await GridModel(tenant).findById(grid_id);

      if (!grid) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Invalid grid ID ${grid_id}` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      for (const site_id of site_ids) {
        const site = await SiteModel(tenant)
          .findById(ObjectId(site_id))
          .lean();

        if (!site) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Invalid Site ID ${site_id}, please crosscheck`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (site.grids && site.grids.includes(grid_id.toString())) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Grid ${grid_id} is already assigned to the site ${site_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      const totalSites = site_ids.length;
      const { nModified, n } = await SiteModel(tenant).updateMany(
        { _id: { $in: site_ids } },
        { $addToSet: { grids: grid_id } }
      );

      const notFoundCount = totalSites - nModified;
      if (nModified === 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "No matching Site found in the system" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (notFoundCount > 0) {
        return {
          success: true,
          message: `Operation partially successful some ${notFoundCount} of the provided sites were not found in the system`,
          status: httpStatus.OK,
        };
      }

      return {
        success: true,
        message: "successfully assigned all the provided sites to the Grid",
        status: httpStatus.OK,
        data: [],
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
  unAssignManySitesFromGrid: async (request) => {
    try {
      const { site_ids } = request.body;
      const { grid_id } = request.params;
      const { tenant } = request.query;

      // Check if grid exists
      const grid = await GridModel(tenant).findById(grid_id);
      if (!grid) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Grid not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check of all these provided sites actually do exist?
      const existingSites = await SiteModel(tenant).find(
        { _id: { $in: site_ids } },
        "_id"
      );

      if (existingSites.length !== site_ids.length) {
        const nonExistentSites = site_ids.filter(
          (site_id) => !existingSites.find((site) => site._id.equals(site_id))
        );

        return {
          success: false,
          message: `Bad Request Error`,
          errors: {
            message: `The following sites do not exist: ${nonExistentSites}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check if all the provided site_ids have the grid_id in their grid's field?

      const sites = await SiteModel(tenant).find({
        _id: { $in: site_ids },
        grids: { $all: [grid_id] },
      });

      if (sites.length !== site_ids.length) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Some of the provided Site IDs are not assigned to this grid ${grid_id}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //remove the grid_id from all the site's grid field

      try {
        const totalSites = site_ids.length;
        const { nModified, n } = await SiteModel(tenant).updateMany(
          { _id: { $in: site_ids }, grids: { $in: [grid_id] } },
          { $pull: { grids: grid_id } },
          { multi: true }
        );

        const notFoundCount = totalSites - nModified;
        if (nModified === 0) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: { message: "No matching Site found in the system" },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (notFoundCount > 0) {
          return {
            success: true,
            message: `Operation partially successful since ${notFoundCount} of the provided sites were not found in the system`,
            status: httpStatus.OK,
          };
        }
      } catch (error) {
        logger.error(`Internal Server Error ${error.message}`);
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: error.message },
        };
      }

      return {
        success: true,
        message: `successfully unassigned all the provided  sites from the grid ${grid_id}`,
        status: httpStatus.OK,
        data: [],
      };
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  assignOneSiteToGrid: async (request) => {
    try {
      const { grid_id, site_id } = request.params;
      const { tenant } = request.query;

      const siteExists = await SiteModel(tenant).exists({ _id: site_id });
      const gridExists = await GridModel(tenant).exists({
        _id: grid_id,
      });

      if (!siteExists || !gridExists) {
        return {
          success: false,
          message: "Site or Grid not found",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Site or Grid not found" },
        };
      }

      const site = await SiteModel(tenant)
        .findById(site_id)
        .lean();

      logObject("site", site);

      if (site.grids && site.grids.includes(grid_id.toString())) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Grid already assigned to Site" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updatedSite = await SiteModel(tenant).findByIdAndUpdate(
        site_id,
        { $addToSet: { grids: grid_id } },
        { new: true }
      );

      return {
        success: true,
        message: "Site assigned to the Grid",
        data: updatedSite,
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
  unAssignOneSiteFromGrid: async (request) => {
    try {
      const { grid_id, site_id } = request.params;
      const { tenant } = request.query;

      // Check if the grid exists
      const grid = await GridModel(tenant).findById(grid_id);
      if (!grid) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Grid not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Check if the site exists
      const site = await SiteModel(tenant).findById(site_id);
      if (!site) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Bad Request Error",
          errors: { message: "Site not found" },
        };
      }

      // Check if the grid is part of the site's grids
      const isGridInSite = site.grids.some(
        (gridId) => gridId.toString() === grid_id.toString()
      );
      if (!isGridInSite) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Grid ${grid_id.toString()} is not part of the site's grids`,
          },
        };
      }

      // Remove the grid from the site
      const updatedSite = await SiteModel(tenant).findByIdAndUpdate(
        site_id,
        { $pull: { grids: grid_id } },
        { new: true }
      );

      return {
        success: true,
        message: "Successfully unassigned Site from the Grid",
        data: updatedSite,
        status: httpStatus.OK,
      };
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
};

module.exports = createGrid;
