const GridSchema = require("@models/Grid");
const SiteSchema = require("@models/Site");
const AdminLevelSchema = require("@models/AdminLevel");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("@config/database");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-grid-util`);
const geolib = require("geolib");
const geohash = require("ngeohash");
const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});
const { Transform } = require("stream");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const shapefile = require("shapefile");

const GridModel = (tenant) => {
  try {
    const grids = mongoose.model("grids");
    return grids;
  } catch (error) {
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
      const gridModel = new GridModel(tenant)(chunk);
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
  generateGeoHashFromCoordinates: (coordinates) => {
    // Flatten the coordinates array to handle both Polygon and MultiPolygon
    const flattenedCoordinates = [].concat(...coordinates);
    // Calculate the center point of the coordinates
    const centerPoint = geolib.getCenter(flattenedCoordinates);
    // Generate the GeoHash using the center point
    const geoHash = geolib.getGeoHash(
      centerPoint.latitude,
      centerPoint.longitude
    );
    return geoHash;
  },
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
  create: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      let modifiedBody = body;
      let requestForCalucaltionGridCenter = {};
      requestForCalucaltionGridCenter["body"] = {};
      requestForCalucaltionGridCenter["body"]["coordinates"] = body.shape;

      const responseFromCalculateGeographicalCenter = await createGrid.calculateGeographicalCenter(
        requestForCalucaltionGridCenter
      );
      logObject(
        "responseFromCalculateGeographicalCenter",
        responseFromCalculateGeographicalCenter
      );
      if (responseFromCalculateGeographicalCenter.success === false) {
        return responseFromCalculateGeographicalCenter;
      } else {
        modifiedBody["center_point"] =
          responseFromCalculateGeographicalCenter.data;

        /**********
         * using batching mechanism for storage********* */

        const { data } = req.body; // Assuming the input data is passed in the request body as 'data' field
        const batchSize = 100; // Define the size of each batch
        const totalBatches = Math.ceil(data.length / batchSize);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const startIdx = batchIndex * batchSize;
          const endIdx = Math.min(startIdx + batchSize, data.length);
          const batchData = data.slice(startIdx, endIdx);

          // Process the batch of data using the Grid Schema
          const gridModels = batchData.map((item) => {
            // Perform any necessary transformations on 'item' before creating a Grid Model
            return new GridModel(item);
          });

          // Bulk insert the gridModels using your preferred method (e.g., mongoose insertMany)
          await GridModel(tenant).insertMany(gridModels);
        }

        /************* END batch processing ************ */

        /****************START stream processing ********** */
        // const { data } = req.body; // Assuming the input data is passed in the request body as 'data' field

        // Create a Readable stream from the input data
        const readableStream = new Readable({
          objectMode: true,
          read() {
            // Push each data item into the stream
            data.forEach((item) => this.push(item));
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

        const responseFromRegisterGrid = await GridModel(tenant).register(
          modifiedBody
        );

        logObject("responseFromRegisterGrid", responseFromRegisterGrid);

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
            logger.error(`internal server error -- ${error.message}`);
          }

          return responseFromRegisterGrid;
        } else if (responseFromRegisterGrid.success === false) {
          return responseFromRegisterGrid;
        }
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: err.message },
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
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
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
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to delete airqloud",
        errors: err.message,
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
      const { coordinates } = request.body;

      if (isEmpty(coordinates)) {
        return {
          success: false,
          message: "Missing coordinates to calculate the center of the grid",
          errors: { message: "Missing coordinates" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const centerPoint = geolib.getCenter(coordinates);

      if (isEmpty(centerPoint)) {
        return {
          success: false,
          message: "Unable to calculate the Grid's center",
          status: httpStatus.BAD_REQUEST,
        };
      }

      return {
        success: true,
        message: "Successfully calculated the Grid's center point",
        data: centerPoint,
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
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to list airqloud",
        errors: err.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /************* admin levels ************* */
  listAdminLevels: async (req, res) => {
    try {
    } catch (error) {}
  },
  updateAdminLevel: async (req, res) => {
    try {
    } catch (error) {}
  },
  deleteAdminLevel: async (req, res) => {
    try {
    } catch (error) {}
  },
  createAdminLevel: async (req, res) => {
    try {
    } catch (error) {}
  },

  /********************* manage grids ********************** */

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
      const shapefilePath = request.file.path;
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

      // Generate the GeoHash from the extracted coordinates
      const geoHash = createGrid.generateGeoHashFromCoordinates(coordinates);

      // Create the Grid data object
      const gridData = {
        shape: {
          type: shapeType,
          coordinates: coordinates,
        },
        geoHash,
      };
      return {
        success: true,
        data: gridData,
        status: httpStatus.OK,
        message: "successfully retrieved the Grid format",
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

  listAvailableSites: async (request) => {
    try {
    } catch (error) {}
  },
  listAssignedSites: async (request) => {
    try {
    } catch (error) {}
  },
  assignManySitesToGrid: async (request) => {
    try {
    } catch (error) {}
  },
  unAssignManySitesFromGrid: async (request) => {
    try {
    } catch (error) {}
  },
  assignOneSiteToGrid: async (request) => {
    try {
    } catch (error) {}
  },
  unAssignOneSiteFromGrid: async (request) => {
    try {
    } catch (error) {}
  },
};

module.exports = createGrid;
