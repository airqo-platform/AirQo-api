const HTTPStatus = require("http-status");
const PhotoModel = require("@models/Photo");
const isEmpty = require("is-empty");
const axios = require("axios");
const constants = require("@config/constants");
const cloudinary = require("@config/cloudinary");
const { logObject, logElement, logText } = require("./log");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-photo-util`
);

const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createPhoto = {
  /*************** general ****************************** */
  create: async (request) => {
    try {
      const responseFromCreatePhotoOnCloudinary = await createPhoto.createPhotoOnCloudinary(
        request
      );
      if (responseFromCreatePhotoOnCloudinary.success === true) {
        const dataFromCloudinary = responseFromCreatePhotoOnCloudinary.data;
        let enrichedRequest = { ...request, ...dataFromCloudinary };

        const responseFromCreatePhotoOnPlatform = await createPhoto.createPhotoOnPlatform(
          enrichedRequest
        );
        return responseFromCreatePhotoOnPlatform;
      }

      if (responseFromCreatePhotoOnCloudinary.success === false) {
        return responseFromCreatePhotoOnCloudinary;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  update: async (request) => {
    try {
      const responseFromUpdatePhotoOnCloudinary = await createPhoto.updatePhotoOnCloudinary(
        request
      );

      if (responseFromUpdatePhotoOnCloudinary.success === true) {
        const responseFromUpdatePhotoOnPlatform = await createPhoto.updatePhotoOnPlatform(
          request
        );
        return responseFromUpdatePhotoOnPlatform;
      }
      if (responseFromUpdatePhotoOnCloudinary.success === false) {
        return responseFromUpdatePhotoOnCloudinary;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  extractPhotoDetails: async (request) => {
    try {
      const responseFromListPhotos = await createPhoto.list(request);
      logObject("responseFromListPhotos", responseFromListPhotos);
      if (responseFromListPhotos.success === true) {
        const photoDetails = responseFromListPhotos.data[0];
        if (photoDetails.length > 1) {
          return {
            success: false,
            message: "unable to find photo from the system",
            errors: {
              message: "realized more than one photo from the system",
            },
          };
        }
        return {
          success: true,
          data: photoDetails,
          message: "successfully extracted photo details",
        };
      }
      if (responseFromListPhotos.success === false) {
        return responseFromListPhotos;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
      };
    }
  },
  delete: async (request) => {
    try {
      const { id } = request.query;
      let arrayOfOneImage = [];
      let device_name = "";
      const responseFromExtractPhotoDetails = await createPhoto.extractPhotoDetails(
        request
      );

      logObject(
        "responseFromExtractPhotoDetails",
        responseFromExtractPhotoDetails
      );

      if (responseFromExtractPhotoDetails.success === true) {
        const photoDetails = responseFromExtractPhotoDetails.data;
        const imageURL = photoDetails.image_url;
        device_name = photoDetails.device_name;
        arrayOfOneImage.push(imageURL);
      } else if (responseFromExtractPhotoDetails.success === false) {
        return responseFromExtractPhotoDetails;
      }

      logText("deleting photo from the util...");
      let cloudinaryRequest = {};
      cloudinaryRequest["body"] = {};
      cloudinaryRequest["query"] = {};
      cloudinaryRequest["body"]["image_urls"] = arrayOfOneImage;
      cloudinaryRequest["query"]["device_name"] = device_name;
      const responseFromDeletePhotoOnCloudinary = await createPhoto.deletePhotoOnCloudinary(
        cloudinaryRequest
      );

      logObject(
        "responseFromDeletePhotoOnCloudinary",
        responseFromDeletePhotoOnCloudinary
      );

      if (responseFromDeletePhotoOnCloudinary.success === true) {
        const responseFromDeletePhotoOnPlatform = await createPhoto.deletePhotoOnPlatform(
          request
        );
        return responseFromDeletePhotoOnPlatform;
      } else if (responseFromDeletePhotoOnCloudinary.success === false) {
        return responseFromDeletePhotoOnCloudinary;
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: e.message,
        },
      };
    }
  },
  list: async (request) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.photos(request);

      const responseFromListPhotos = await PhotoModel(tenant).list({
        filter,
        limit,
        skip,
      });
      logObject("responseFromListPhotos", responseFromListPhotos);
      return responseFromListPhotos;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  /*************** cloudinary ****************************** */
  createPhotoOnCloudinary: async (request) => {
    try {
      const { path, resource_type, device_name } = request.body;
      logElement("path", path);
      logElement("resource_type", resource_type);
      logElement("device_name", device_name);
      return cloudinary.uploader.upload(
        path,
        {
          resource_type: resource_type,
          public_id: device_name,
          chunk_size: 6000000,
          eager: [
            { width: 300, height: 300, crop: "pad", audio_codec: "none" },
            {
              width: 160,
              height: 100,
              crop: "crop",
              gravity: "south",
              audio_codec: "none",
            },
          ],
          eager_async: true,
          eager_notification_url: "",
        },
        function(error, result) {
          if (error) {
            return {
              success: false,
              message: "unable to upload image",
              errors: {
                message: error,
              },
              status: HTTPStatus.BAD_GATEWAY,
            };
          }
          if (result) {
            let response = {};
            response["body"]["image_code"] = result.public_id;
            response["body"]["image_url"] = result.secure_url;
            response["body"]["metadata"] = {};
            response["body"]["metadata"]["public_id"] = result.public_id;
            response["body"]["metadata"]["version"] = result.version;
            response["body"]["metadata"]["signature"] = result.signature;
            response["body"]["metadata"]["width"] = result.width;
            response["body"]["metadata"]["height"] = result.height;
            response["body"]["metadata"]["format"] = result.format;
            response["body"]["metadata"]["resource_type"] =
              result.resource_type;
            response["body"]["metadata"]["created_at"] = result.created_at;
            response["body"]["metadata"]["bytes"] = result.bytes;
            response["body"]["metadata"]["type"] = result.type;
            response["body"]["metadata"]["url"] = result.url;
            response["body"]["metadata"]["secure_url"] = result.secure_url;
            return {
              success: true,
              message: "successfully uploaded the media",
              data: response,
              status: HTTPStatus.OK,
            };
          }
        }
      );
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  updatePhotoOnCloudinary: async (request) => {
    try {
      let responseFromUpdateOnCloudinary = { success: true };

      if (responseFromUpdateOnCloudinary.success === true) {
        return {
          success: true,
          message: "successfully updated photo on cloudinary",
          data: responseFromUpdateOnCloudinary.data,
          status: responseFromUpdateOnCloudinary.status,
        };
      } else if (responseFromUpdateOnCloudinary.success === false) {
        return responseFromUpdateOnCloudinary;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  deletePhotoOnCloudinary: async (request) => {
    try {
      logText("...extracting IDs from the image URLs...");
      const responseFromExtractImageIds = createPhoto.extractImageIds(request);
      logObject("responseFromExtractImageIds", responseFromExtractImageIds);

      if (isEmpty(responseFromExtractImageIds)) {
        return {
          success: false,
          message: "unable to process the image Ids",
          errors: {
            message: "no response from the utility that extracts the image Ids",
          },
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
      }

      if (responseFromExtractImageIds.success === true) {
        const image_ids = responseFromExtractImageIds.data;
        logText("...deleting images from cloudinary...");
        logObject("the image_ids", image_ids);

        const responseFromCloudinary = await cloudinary.api.delete_resources(
          image_ids
        );
        logObject("responseFromCloudinary", responseFromCloudinary);
        let successfulDeletions = [];
        let failedDeletions = [];
        const deletionStatusFromCloudinaryResponse =
          responseFromCloudinary.deleted;
        Object.entries(deletionStatusFromCloudinaryResponse).forEach(
          ([key, value]) => {
            if (value === "deleted") {
              successfulDeletions.push(key);
            }
            if (value === "not_found") {
              failedDeletions.push(key);
            }
          }
        );
        if (failedDeletions.length === 0 && successfulDeletions.length === 0) {
          return {
            success: false,
            message:
              "no successful deletions or failures recorded from cloudinary",
            status: HTTPStatus.BAD_GATEWAY,
          };
        }

        if (failedDeletions.length > 0 && successfulDeletions.length === 0) {
          return {
            success: false,
            message:
              "unable to delete any of the provided or associated image URLs",
            errors: deletionStatusFromCloudinaryResponse,
            status: HTTPStatus.NOT_FOUND,
          };
        }

        if (successfulDeletions.length > 0 && failedDeletions.length === 0) {
          return {
            success: true,
            message: "image(s) deleted successfully",
            data: successfulDeletions,
            status: HTTPStatus.OK,
          };
        }

        if (successfulDeletions.length > 0 && failedDeletions.length > 0) {
          return {
            success: true,
            message: "some of the images deleted successfully from cloudinary",
            data: {
              successfulDeletions,
              failedDeletions,
            },
            status: HTTPStatus.OK,
          };
        }
      } else if (responseFromExtractImageIds.success === false) {
        return responseFromExtractImageIds;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  extractImageIds: (request) => {
    try {
      const { image_urls } = request.body;
      const { device_name, device_id, site_id, airqloud_id } = request.query;
      let photoNamesWithoutExtension = [];
      image_urls.forEach((imageURL) => {
        logElement("the imageURL", imageURL);
        let request = {};
        request["imageURL"] = imageURL;
        const responseFromGetLastPath = createPhoto.getCloudinaryPaths(request);
        logObject("responseFromGetLastPath", responseFromGetLastPath);
        if (responseFromGetLastPath.success === true) {
          const cloudinaryPublicId = responseFromGetLastPath.data.lastSegment;
          const prependFolderNameToCloudinaryPublicId = `${
            responseFromGetLastPath.data.thirdLastSegment
          }/${device_name ||
            site_id ||
            device_id ||
            airqloud_id}/${cloudinaryPublicId}`;
          photoNamesWithoutExtension.push(
            prependFolderNameToCloudinaryPublicId
          );
        } else if (responseFromGetLastPath.success === false) {
          logObject(
            "runtime error -- unable to extract the last path",
            responseFromGetLastPath
          );
          return responseFromGetLastPath;
        }
      });
      logObject("photoNamesWithoutExtension", photoNamesWithoutExtension);
      return {
        success: true,
        data: photoNamesWithoutExtension,
        message: "successfully extracted the Image Ids",
        status: HTTPStatus.OK,
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  getCloudinaryPaths: (request) => {
    try {
      const { imageURL } = request;
      const segements = imageURL.split("/").filter((segment) => segment);
      const lastSegment = segements[segements.length - 1];
      const thirdLastSegment = segements[segements.length - 3];
      const removedFileExtensionFromLastSegment = lastSegment
        .split(".")
        .slice(0, -1)
        .join(".");
      return {
        success: true,
        data: {
          lastSegment: removedFileExtensionFromLastSegment,
          thirdLastSegment,
        },
        status: HTTPStatus.OK,
        message: "successfully removed the file extension",
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },

  /*************** platform only ****************************** */
  deletePhotoOnPlatform: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.photos(request);
      logObject("filter ", filter);
      const update = body;
      const opts = { new: true };
      const responseFromRemovePhoto = await PhotoModel(tenant).remove({
        filter,
      });
      logObject("responseFromRemovePhoto", responseFromRemovePhoto);
      return responseFromRemovePhoto;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  updatePhotoOnPlatform: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.photos(request);
      logObject("filter ", filter);
      const update = body;
      const opts = { new: true };
      const responseFromModifyPhoto = await PhotoModel(tenant).modify({
        filter,
        update,
        opts,
      });

      return responseFromModifyPhoto;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },

  createPhotoOnPlatform: async (request) => {
    try {
      let { body, query } = request;
      let { tenant } = query;
      let { image_url, device_name, device_id, site_id, airqloud_id } = body;
      let requestForImageIdExtraction = {};
      requestForImageIdExtraction["body"] = {};
      requestForImageIdExtraction["query"] = {};
      requestForImageIdExtraction["query"]["device_name"] = device_name;
      requestForImageIdExtraction["query"]["device_id"] = device_id;
      requestForImageIdExtraction["query"]["site_id"] = site_id;
      requestForImageIdExtraction["query"]["airqloud_id"] = airqloud_id;
      requestForImageIdExtraction["body"]["image_urls"] = [];
      requestForImageIdExtraction["body"]["image_urls"].push(image_url);
      const responseFromExtractImage = await createPhoto.extractImageIds(
        requestForImageIdExtraction
      );
      let photoId = [];
      let modifiedRequestBody = body;
      if (responseFromExtractImage.success === true) {
        photoId = responseFromExtractImage.data;
        logObject("photoId", photoId);
        modifiedRequestBody["image_code"] = photoId[0];
        modifiedRequestBody["metadata"] = {};
        modifiedRequestBody["metadata"]["public_id"] = photoId[0];
        modifiedRequestBody["metadata"]["url"] = image_url;
      } else if (responseFromExtractImage.success === false) {
        logObject("responseFromExtractImage", responseFromExtractImage);
        return responseFromExtractImage;
      }

      const responseFromRegisterPhoto = await PhotoModel(tenant).register(
        modifiedRequestBody
      );

      logObject("responseFromRegisterPhoto", responseFromRegisterPhoto);

      if (responseFromRegisterPhoto.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.PHOTOS_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(responseFromRegisterPhoto.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return {
          success: true,
          message: responseFromRegisterPhoto.message,
          status: responseFromRegisterPhoto.status
            ? responseFromRegisterPhoto.status
            : "",
          data: responseFromRegisterPhoto.data,
        };
      } else if (responseFromRegisterPhoto.success === false) {
        return responseFromRegisterPhoto;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
};

module.exports = createPhoto;
