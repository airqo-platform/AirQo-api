const AirQloudModel = require("@models/Airqloud");
const SiteModel = require("@models/Site");
const CohortModel = require("@models/Cohort");
const GridModel = require("@models/Grid");
const geolib = require("geolib");
const { logObject } = require("./log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const generateFilter = require("./generate-filter");
const createLocationUtil = require("./create-location");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-airqloud-util`
);
const { Kafka } = require("kafkajs");
const httpStatus = require("http-status");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const siteFieldsToExclude = constants.SITE_FIELDS_TO_EXCLUDE;
const deviceFieldsToExclude = constants.DEVICE_FIELDS_TO_EXCLUDE;
const gridShapeFieldsToExclude = constants.GRID_SHAPE_FIELDS_TO_EXCLUDE;
const gridsInclusionProjection = constants.GRIDS_INCLUSION_PROJECTION;
const cohortsInclusionProjection = constants.COHORTS_INCLUSION_PROJECTION;

const sitesExclusionProjection = siteFieldsToExclude.reduce(
  (projection, fieldName) => {
    projection[`sites.${fieldName}`] = 0;
    return projection;
  },
  {}
);
const devicesExclusionProjection = deviceFieldsToExclude.reduce(
  (projection, fieldName) => {
    projection[`devices.${fieldName}`] = 0;
    return projection;
  },
  {}
);
const gridShapeExclusionProjection = gridShapeFieldsToExclude.reduce(
  (projection, fieldName) => {
    projection[`shape.${fieldName}`] = 0;
    return projection;
  },
  {}
);

const getDocumentsByNetworkId = async (tenantId, network, category) => {
  try {
    if (category === "summary") {
      //make modifications to the exclusion projection
    }
    if (category === "dashboard") {
      //make modifications to the exclusion projection
    }
    const cohortsQuery = CohortModel(tenantId).aggregate([
      {
        $match: { network },
      },
      {
        $lookup: {
          from: "devices",
          localField: "_id",
          foreignField: "cohorts",
          as: "devices",
        },
      },
      {
        $project: cohortsInclusionProjection,
      },
      {
        $project: devicesExclusionProjection,
      },
    ]);

    const gridsQuery = GridModel(tenantId).aggregate([
      {
        $match: { network },
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
        $project: gridsInclusionProjection,
      },
      {
        $project: sitesExclusionProjection,
      },
      {
        $project: gridShapeExclusionProjection,
      },
    ]);

    const [cohorts, grids] = await Promise.all([
      cohortsQuery.exec(),
      gridsQuery.exec(),
    ]);

    return { cohorts, grids };
  } catch (error) {
    logger.error(`internal server error -- ${JSON.stringify(error)}`);
    return {
      success: false,
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: { message: error.message },
      message: "Internal Server Error",
    };
  }
};
const createAirqloud = {
  initialIsCapital: (word) => {
    return word[0] !== word[0].toLowerCase();
  },
  hasNoWhiteSpace: (word) => {
    try {
      const hasWhiteSpace = word.indexOf(" ") >= 0;
      return !hasWhiteSpace;
    } catch (e) {
      logger.error(`internal server error -- hasNoWhiteSpace -- ${e.message}`);
    }
  },
  retrieveCoordinates: async (request, entity) => {
    try {
      let entityInstance = {};
      if (entity === "location") {
        entityInstance = createLocationUtil;
      } else if (entity === "airqloud") {
        entityInstance = createAirqloud;
      }
      const responseFromListAirQloud = await entityInstance.list(request);

      if (responseFromListAirQloud.success === true) {
        if (isEmpty(responseFromListAirQloud.data)) {
          return {
            success: false,
            message: "unable to retrieve location details",
            status: httpStatus.NOT_FOUND,
            errors: {
              message: "no record exists for this location_id",
            },
          };
        }
        if (responseFromListAirQloud.data.length === 1) {
          const data = responseFromListAirQloud.data[0];
          return {
            data: data.location,
            success: true,
            message: "retrieved the location",
            status: httpStatus.OK,
          };
        }
        if (responseFromListAirQloud.data.length > 1) {
          return {
            success: false,
            message: "unable to retrieve location details",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message: "requested for one record but received many",
            },
          };
        }
      }

      if (responseFromListAirQloud.success === false) {
        return {
          success: false,
          message: "unable to retrieve details from the provided location_id",
          errors: responseFromListAirQloud.errors,
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
      const { location_id } = body;
      logObject("body", body);
      let modifiedBody = body;
      if (!isEmpty(location_id)) {
        let requestForCoordinateRetrieval = {};
        requestForCoordinateRetrieval["query"] = {};
        requestForCoordinateRetrieval["query"]["id"] = body.location_id;
        requestForCoordinateRetrieval["query"]["tenant"] = tenant;

        let responseFromRetrieveCoordinates = await createAirqloud.retrieveCoordinates(
          requestForCoordinateRetrieval,
          "location"
        );

        if (responseFromRetrieveCoordinates.success === true) {
          modifiedBody["location"] = responseFromRetrieveCoordinates.data;
        } else if (responseFromRetrieveCoordinates.success === false) {
          return responseFromRetrieveCoordinates;
        }
      }

      let requestForCalucaltionAirQloudCenter = {};
      requestForCalucaltionAirQloudCenter["body"] = {};
      requestForCalucaltionAirQloudCenter["query"] = {};
      if (
        !isEmpty(modifiedBody.location) &&
        !isEmpty(modifiedBody.location.coordinates[0])
      ) {
        requestForCalucaltionAirQloudCenter["body"]["coordinates"] =
          modifiedBody.location.coordinates[0];
      }

      const responseFromCalculateGeographicalCenter = await createAirqloud.calculateGeographicalCenter(
        requestForCalucaltionAirQloudCenter
      );
      logObject(
        "responseFromCalculateGeographicalCenter",
        responseFromCalculateGeographicalCenter
      );
      if (responseFromCalculateGeographicalCenter.success === true) {
        modifiedBody["center_point"] =
          responseFromCalculateGeographicalCenter.data;
      } else if (responseFromCalculateGeographicalCenter.success === false) {
        return responseFromCalculateGeographicalCenter;
      }

      const responseFromRegisterAirQloud = await AirQloudModel(tenant).register(
        modifiedBody
      );

      logObject("responseFromRegisterAirQloud", responseFromRegisterAirQloud);

      if (responseFromRegisterAirQloud.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.AIRQLOUDS_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(responseFromRegisterAirQloud.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return responseFromRegisterAirQloud;
      } else if (responseFromRegisterAirQloud.success === false) {
        return responseFromRegisterAirQloud;
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
      let { query, body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.airqlouds(request);

      let responseFromModifyAirQloud = await AirQloudModel(tenant).modify({
        filter,
        update,
      });
      return responseFromModifyAirQloud;
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
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.airqlouds(request);
      let responseFromRemoveAirQloud = await AirQloudModel(tenant).remove({
        filter,
      });

      return responseFromRemoveAirQloud;
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
      const { query, body } = request;
      const { tenant, id, name, admin_level } = query;

      let requestForUpdateAirQloud = request;
      requestForUpdateAirQloud["body"] = {};
      requestForUpdateAirQloud["body"]["location"] = {};

      let requestForCoordinateRetrieval = {};
      requestForCoordinateRetrieval["query"] = {};
      requestForCoordinateRetrieval["query"]["id"] = id;
      requestForCoordinateRetrieval["query"]["tenant"] = tenant;

      let responseFromRetrieveCoordinates = await createAirqloud.retrieveCoordinates(
        requestForCoordinateRetrieval,
        "airqloud"
      );

      if (responseFromRetrieveCoordinates.success === true) {
        requestForUpdateAirQloud["body"]["location"]["coordinates"] =
          responseFromRetrieveCoordinates.data.coordinates[0];
      } else if (responseFromRetrieveCoordinates.success === false) {
        return responseFromRetrieveCoordinates;
      }

      const responseFromFindSites = await createAirqloud.findSites(request);
      if (responseFromFindSites.success === true) {
        const sites = responseFromFindSites.data;
        requestForUpdateAirQloud["body"]["sites"] = sites;
      } else if (responseFromFindSites.success === false) {
        return responseFromFindSites;
      }

      let requestForCalucaltionAirQloudCenter = {};
      requestForCalucaltionAirQloudCenter["body"] = {};
      requestForCalucaltionAirQloudCenter["query"] = {};
      requestForCalucaltionAirQloudCenter["body"]["coordinates"] =
        requestForUpdateAirQloud.body.location.coordinates;

      const responseFromCalculateGeographicalCenter = await createAirqloud.calculateGeographicalCenter(
        requestForCalucaltionAirQloudCenter
      );

      if (responseFromCalculateGeographicalCenter.success === true) {
        requestForUpdateAirQloud["body"]["center_point"] =
          responseFromCalculateGeographicalCenter.data;
      } else if (responseFromCalculateGeographicalCenter.success === false) {
        return responseFromCalculateGeographicalCenter;
      }

      const responseFromUpdateAirQloud = await createAirqloud.update(
        requestForUpdateAirQloud
      );
      if (responseFromUpdateAirQloud.success === true) {
        return {
          success: true,
          message: "successfully refreshed the AirQloud",
          status: httpStatus.OK,
          data: responseFromUpdateAirQloud.data,
        };
      } else if (responseFromUpdateAirQloud.success === false) {
        return responseFromUpdateAirQloud;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
      const { body, query } = request;
      const { coordinates } = body;
      const { id } = query;
      let coordinatesForCalculatingCenter = [];

      if (!isEmpty(id)) {
        const responseFromListAirQloud = await createAirqloud.list(request);
        if (responseFromListAirQloud.success === true) {
          if (responseFromListAirQloud.data.length === 1) {
            coordinatesForCalculatingCenter =
              responseFromListAirQloud.data[0].location.coordinates[0];
          } else {
            return {
              success: false,
              message: `unable to find the provided airqloud: ${id}`,
              status: responseFromListAirQloud.status,
              errors: { message: "" },
            };
          }
        } else if (responseFromListAirQloud.success === false) {
          return responseFromListAirQloud;
        }
      }
      if (!isEmpty(coordinates)) {
        coordinatesForCalculatingCenter = coordinates;
      }

      const centerPoint = geolib.getCenter(coordinatesForCalculatingCenter);

      if (!isEmpty(centerPoint)) {
        return {
          success: true,
          message: "Successfully calculated the AirQloud's center point",
          data: centerPoint,
        };
      } else {
        return {
          success: false,
          message: "unable to calculate the geographical center",
        };
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  findSites: async (request) => {
    try {
      const { query, body } = request;
      const { id, tenant, name, admin_level } = query;
      let filter = {};
      let site_ids = [];
      filter["_id"] = id;
      let requestForAirQlouds = {};
      requestForAirQlouds["query"] = {};
      requestForAirQlouds["query"]["id"] = id;
      requestForAirQlouds["query"]["admin_level"] = admin_level;
      requestForAirQlouds["query"]["name"] = name;
      requestForAirQlouds["query"]["tenant"] = tenant;
      const responseFromListAirQlouds = await createAirqloud.list(
        requestForAirQlouds
      );

      if (responseFromListAirQlouds.success === true) {
        let airqloud = {};
        let data = responseFromListAirQlouds.data;
        if (data.length > 1 || data.length === 0) {
          return {
            success: false,
            message: "unable to find one match for this airqloud id",
            status: httpStatus.NOT_FOUND,
          };
        } else if (data.length === 1) {
          airqloud = responseFromListAirQlouds.data[0];
          delete airqloud.sites;
        }

        let airqloudArrayOfCoordinates = airqloud.location.coordinates[0];

        let airqloudPolygon = airqloudArrayOfCoordinates.map(function(x) {
          return {
            longitude: x[0],
            latitude: x[1],
          };
        });

        filter = {};

        let responseFromListSites = await SiteModel(tenant).list({
          filter,
        });

        if (responseFromListSites.success === true) {
          const sites = responseFromListSites.data;
          for (const site of sites) {
            const { latitude, longitude, _id, description } = site;
            if (!isEmpty(latitude) && !isEmpty(longitude)) {
              const isSiteInAirQloud = geolib.isPointInPolygon(
                { latitude, longitude },
                airqloudPolygon
              );
              if (isSiteInAirQloud === true) {
                site_ids.push(site._id);
              } else if (isSiteInAirQloud === false) {
                // logger.info(
                //   `Site ${site._id} does not belong to this AirQloud`
                // );
              } else {
                // logger.info(`unable to categorise this Site ${site._id} `);
              }
            } else {
              logger.error(
                `missing GPS coordinates for site id -- ${_id} and description -- ${description}`
              );
            }
          }

          if (!isEmpty(site_ids)) {
            return {
              success: true,
              message: "successfully searched for the associated Sites",
              data: site_ids,
              status: httpStatus.OK,
            };
          } else if (isEmpty(site_ids)) {
            return {
              success: true,
              message: "no associated Sites found",
              data: site_ids,
              status: httpStatus.OK,
            };
          }
        } else if (responseFromListSites.success === false) {
          return {
            success: false,
            message: responseFromListSites.message,
            status: responseFromListSites.status,
          };
        }
      } else if (responseFromListAirQlouds.success === false) {
        return responseFromListAirQlouds;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  list: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      const limit = 1000;
      const skip = parseInt(query.skip) || 0;
      let filter = generateFilter.airqlouds(request);

      let responseFromListAirQloud = await AirQloudModel(tenant).list({
        filter,
        limit,
        skip,
      });

      return responseFromListAirQloud;
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
  listCohortsAndGrids: async (request) => {
    try {
      const { params } = request;
      const network = params.net_id;
      const { tenant, category } = request.query;
      return await getDocumentsByNetworkId(tenant, network, category)
        .then(({ cohorts, grids }) => {
          return {
            success: true,
            message: `Successfully returned the AirQlouds for network ${network}`,
            data: { cohorts, grids },
            status: httpStatus.OK,
          };
        })
        .catch((error) => {
          return {
            success: false,
            message: "Internal Server Error",
            errors: { message: error.message },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        });
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createAirqloud;
