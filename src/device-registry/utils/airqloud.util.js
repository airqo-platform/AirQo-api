const AirQloudModel = require("@models/Airqloud");
const SiteModel = require("@models/Site");
const CohortModel = require("@models/Cohort");
const GridModel = require("@models/Grid");
const geolib = require("geolib");
const { logObject, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { generateFilter } = require("@utils/common");
const createLocationUtil = require("@utils/location.util");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- airqloud-util`
);
const { Kafka } = require("kafkajs");
const httpStatus = require("http-status");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const getDocumentsByNetworkId = async (tenantId, network, detailLevel) => {
  try {
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
        $project: constants.COHORTS_INCLUSION_PROJECTION,
      },
      {
        $project: constants.COHORTS_EXCLUSION_PROJECTION(detailLevel),
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
        $project: constants.GRIDS_INCLUSION_PROJECTION,
      },
      {
        $project: constants.GRIDS_EXCLUSION_PROJECTION(detailLevel),
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
const getDocumentsByGroupId = async (tenantId, groupId, detailLevel) => {
  try {
    const cohortsQuery = CohortModel(tenantId).aggregate([
      {
        $match: { group: groupId }, // Match with group instead of network
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
        $project: constants.COHORTS_INCLUSION_PROJECTION,
      },
      {
        $project: constants.COHORTS_EXCLUSION_PROJECTION(detailLevel),
      },
    ]);

    const gridsQuery = GridModel(tenantId).aggregate([
      {
        $match: { group: groupId }, // Match with group instead of network
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
        $project: constants.GRIDS_INCLUSION_PROJECTION,
      },
      {
        $project: constants.GRIDS_EXCLUSION_PROJECTION(detailLevel),
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
  hasNoWhiteSpace: (word, next) => {
    try {
      const hasWhiteSpace = word.indexOf(" ") >= 0;
      return !hasWhiteSpace;
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
  retrieveCoordinates: async (request, entity, next) => {
    try {
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message: "Please use Grids or Cohorts, AirQlouds are deprecated",
        },
      };
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
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message: "Please use Grids or Cohorts, AirQlouds are deprecated",
        },
      };
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
          "location",
          next
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
        requestForCalucaltionAirQloudCenter,
        next
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
        modifiedBody,
        next
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
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message: "Please use Grids or Cohorts, AirQlouds are deprecated",
        },
      };
      let { query, body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.airqlouds(request, next);

      let responseFromModifyAirQloud = await AirQloudModel(tenant).modify(
        {
          filter,
          update,
        },
        next
      );
      return responseFromModifyAirQloud;
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
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message: "Please use Grids or Cohorts, AirQlouds are deprecated",
        },
      };
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.airqlouds(request, next);
      let responseFromRemoveAirQloud = await AirQloudModel(tenant).remove(
        {
          filter,
        },
        next
      );

      return responseFromRemoveAirQloud;
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
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message: "Please use Grids or Cohorts, AirQlouds are deprecated",
        },
      };
      const { query, body } = request;
      const { tenant, id, name, admin_level } = query;

      let requestForUpdateAirQloud = request;
      requestForUpdateAirQloud["body"] = {};
      requestForUpdateAirQloud["body"]["location"] = {};

      let requestForCoordinateRetrieval = {};
      requestForCoordinateRetrieval["query"] = {};
      requestForCoordinateRetrieval["query"]["id"] = id;
      requestForCoordinateRetrieval["query"]["tenant"] = tenant;

      const responseFromRetrieveCoordinates = await createAirqloud.retrieveCoordinates(
        requestForCoordinateRetrieval,
        "airqloud",
        next
      );

      if (responseFromRetrieveCoordinates.success === true) {
        requestForUpdateAirQloud["body"]["location"]["coordinates"] =
          responseFromRetrieveCoordinates.data.coordinates[0];
      } else if (responseFromRetrieveCoordinates.success === false) {
        return responseFromRetrieveCoordinates;
      }

      const responseFromFindSites = await createAirqloud.findSites(
        request,
        next
      );
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
        requestForCalucaltionAirQloudCenter,
        next
      );

      if (responseFromCalculateGeographicalCenter.success === true) {
        requestForUpdateAirQloud["body"]["center_point"] =
          responseFromCalculateGeographicalCenter.data;
      } else if (responseFromCalculateGeographicalCenter.success === false) {
        return responseFromCalculateGeographicalCenter;
      }

      const responseFromUpdateAirQloud = await createAirqloud.update(
        requestForUpdateAirQloud,
        next
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
  calculateGeographicalCenter: async (request, next) => {
    try {
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message: "Please use Grids or Cohorts, AirQlouds are deprecated",
        },
      };
      const { body, query } = request;
      const { coordinates } = body;
      const { id } = query;
      let coordinatesForCalculatingCenter = [];

      if (!isEmpty(id)) {
        const responseFromListAirQloud = await createAirqloud.list(
          request,
          next
        );
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
  findSites: async (request, next) => {
    try {
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message: "Please use Grids or Cohorts, AirQlouds are deprecated",
        },
      };
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
        requestForAirQlouds,
        next
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

        let responseFromListSites = await SiteModel(tenant).list(
          {
            filter,
          },
          next
        );

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
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message: "Please use Grids or Cohorts, AirQlouds are deprecated",
        },
      };
      const { tenant, limit, skip, page, detailLevel } = request.query;
      const filter = generateFilter.airqlouds(request, next);
      const data = await AirQloudModel(tenant).list(
        {
          filter,
          limit,
          skip,
          page,
          projection: constants.AIRQLOUDS_EXCLUSION_PROJECTION(detailLevel),
        },
        next
      );
      return data;
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

  listCohortsAndGrids: async (request, next) => {
    try {
      const { params, query } = request;
      const groupId = params.group_id;
      const networkId = params.net_id;
      const { tenant, detailLevel } = query;

      if (groupId) {
        return await getDocumentsByGroupId(tenant, groupId, detailLevel)
          .then(({ cohorts, grids }) => {
            return {
              success: true,
              message: `Successfully returned the Cohorts and Grids for group ${groupId}`,
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
      } else if (networkId) {
        return await getDocumentsByNetworkId(tenant, networkId, detailLevel)
          .then(({ cohorts, grids }) => {
            return {
              success: true,
              message: `Successfully returned the Cohorts and Grids for network ${networkId}`,
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
      } else {
        return {
          success: false,
          message: "Bad Request",
          errors: {
            message:
              "Invalid request parameters. Specify either 'group_id' or 'net_id'.",
          },
          status: httpStatus.BAD_REQUEST,
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
};

module.exports = createAirqloud;
