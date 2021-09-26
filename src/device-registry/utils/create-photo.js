const HTTPStatus = require("http-status");
const PhotoSchema = require("../models/Photo");
const { getModelByTenant } = require("./multitenancy");
const isEmpty = require("is-empty");
const axios = require("axios");
const constants = require("../config/constants");
const cloudinary = require("../config/cloudinary");
const { logObject, logElement, logText } = require("./log");
const generateFilter = require("./generate-filter");
const jsonify = require("../utils/jsonify");
const { tryCatchErrors } = require("./errors");

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

        if (responseFromCreatePhotoOnPlatform.success === true) {
          const status = responseFromCreatePhotoOnPlatform.status
            ? responseFromCreatePhotoOnPlatform.status
            : "";
          return {
            success: true,
            message: responseFromCreatePhotoOnPlatform.message,
            status,
          };
        }

        if (responseFromCreatePhotoOnPlatform.success === false) {
          const status = responseFromCreatePhotoOnPlatform.status
            ? responseFromCreatePhotoOnPlatform.status
            : "";
          const errors = responseFromCreatePhotoOnPlatform.errors
            ? responseFromCreatePhotoOnPlatform.errors
            : "";
          return {
            success: false,
            message: responseFromCreatePhotoOnPlatform.message,
            errors,
            status,
          };
        }
      }

      if (responseFromCreatePhotoOnCloudinary.success === false) {
        const status = responseFromCreatePhotoOnCloudinary.status
          ? responseFromCreatePhotoOnCloudinary.status
          : "";
        const errors = responseFromCreatePhotoOnCloudinary.errors
          ? responseFromCreatePhotoOnCloudinary.errors
          : "";
        return {
          success: false,
          message: responseFromCreatePhotoOnCloudinary.message,
          errors,
          status,
        };
      }
    } catch (error) {
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
      const responseFromUpdatePhotoOnCloudinary = await createPhoto.updatePhotoOnPlatform(
        request
      );

      if (responseFromUpdatePhotoOnCloudinary.success === true) {
        const responseFromUpdatePhotoOnPlatform = await createPhoto.updatePhotoOnPlatform(
          request
        );

        if (responseFromUpdatePhotoOnPlatform.success === true) {
          const status = responseFromUpdatePhotoOnPlatform.status
            ? responseFromUpdatePhotoOnPlatform.status
            : "";
          return {
            success: true,
            message: responseFromUpdatePhotoOnPlatform.message,
            data: responseFromUpdatePhotoOnPlatform.data,
          };
        }

        if (responseFromUpdatePhotoOnPlatform.success === false) {
          const status = responseFromUpdatePhotoOnPlatform.status
            ? responseFromUpdatePhotoOnPlatform.status
            : "";
          const errors = responseFromUpdatePhotoOnPlatform.errors
            ? responseFromUpdatePhotoOnPlatform.errors
            : "";
          return {
            success: false,
            message: responseFromUpdatePhotoOnPlatform.message,
            errors,
            status,
          };
        }
      }

      if (responseFromUpdatePhotoOnCloudinary.success === false) {
        const status = responseFromUpdatePhotoOnCloudinary.status
          ? responseFromUpdatePhotoOnCloudinary.status
          : "";
        const errors = responseFromUpdatePhotoOnCloudinary.errors
          ? responseFromUpdatePhotoOnCloudinary.errors
          : "";
        return {
          success: false,
          message: responseFromUpdatePhotoOnCloudinary.message,
          errors,
          status,
        };
      }
    } catch (error) {
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
      let responseFromListPhotos = await createPhoto.list(request);
      logObject("responseFromListPhotos", responseFromListPhotos);
      if (responseFromListPhotos.success === true) {
        const photoDetails = responseFromListPhotos.data[0];
        if (photoDetails.length > 1) {
          return {
            success: false,
            message: "unable to find photo from the system",
            error: {
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
      let responseFromExtractPhotoDetails = await createPhoto.extractPhotoDetails(
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
      }

      if (responseFromExtractPhotoDetails.success === false) {
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

        logObject(
          "responseFromDeletePhotoOnPlatform",
          responseFromDeletePhotoOnPlatform
        );

        if (responseFromDeletePhotoOnPlatform.success === true) {
          const status = responseFromDeletePhotoOnPlatform.status
            ? responseFromDeletePhotoOnPlatform.status
            : "";
          return {
            success: true,
            message: responseFromDeletePhotoOnPlatform.message,
            data: responseFromDeletePhotoOnPlatform.data,
            status,
          };
        }

        if (responseFromDeletePhotoOnPlatform.success === false) {
          const status = responseFromDeletePhotoOnPlatform.status
            ? responseFromDeletePhotoOnPlatform.status
            : "";
          const errors = responseFromDeletePhotoOnPlatform.errors
            ? responseFromDeletePhotoOnPlatform.errors
            : "";
          return {
            success: false,
            message: responseFromDeletePhotoOnPlatform.message,
            status,
            errors,
          };
        }
      }

      if (responseFromDeletePhotoOnCloudinary.success === false) {
        const status = responseFromDeletePhotoOnCloudinary.status
          ? responseFromDeletePhotoOnCloudinary.status
          : "";
        const errors = responseFromDeletePhotoOnCloudinary.errors
          ? responseFromDeletePhotoOnCloudinary.errors
          : "";
        return {
          success: false,
          message: responseFromDeletePhotoOnCloudinary.message,
          status,
          errors,
        };
      }
    } catch (e) {
      logObject("the internal server error", e);
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
      let { query } = request;
      let filter = generateFilter.photos(request);
      let { limit, skip, tenant } = query;
      let responseFromListPhotos = await getModelByTenant(
        tenant,
        "photo",
        PhotoSchema
      ).list({
        filter,
        limit,
        skip,
      });
      logObject("responseFromListPhotos", responseFromListPhotos);
      if (responseFromListPhotos.success === true) {
        let status = responseFromListPhotos.status
          ? responseFromListPhotos.status
          : "";
        return {
          success: true,
          message: responseFromListPhotos.message,
          status,
          data: responseFromListPhotos.data,
        };
      }

      if (responseFromListPhotos.success === false) {
        let status = responseFromListPhotos.status
          ? responseFromListPhotos.status
          : "";
        let errors = responseFromListPhotos.errors
          ? responseFromListPhotos.errors
          : "";
        return {
          success: false,
          message: responseFromListPhotos.message,
          status,
          errors,
        };
      }
    } catch (error) {
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
      let responseFromUpdateOnCloudinary = {};

      if (responseFromUpdateOnCloudinary.success === true) {
        return {
          success: true,
          message: "",
          data: responseFromUpdateOnCloudinary.data,
          status: responseFromUpdateOnCloudinary.status,
        };
      }

      if (responseFromUpdateOnCloudinary.success === false) {
        let status = responseFromUpdateOnCloudinary.status
          ? responseFromUpdateOnCloudinary.status
          : HTTPStatus.BAD_GATEWAY;
        let errors = responseFromUpdateOnCloudinary.errors
          ? responseFromUpdateOnCloudinary.errors
          : status;
        return {
          success: true,
          message: responseFromUpdateOnCloudinary.message,
          status,
          errors,
        };
      }
    } catch (error) {
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
      }

      if (responseFromExtractImageIds.success === false) {
        const status = responseFromExtractImageIds.status
          ? responseFromExtractImageIds.status
          : "";
        const errors = responseFromExtractImageIds.errors
          ? responseFromExtractImageIds.errors
          : "";
        return {
          success: false,
          message: responseFromExtractImageIds.message,
          status,
          errors,
        };
      }
    } catch (error) {
      logObject("Internal Server Error", error);
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
      const { device_name } = request.query;
      let photoNamesWithoutExtension = [];
      image_urls.forEach((imageURL) => {
        logElement("the imageURL", imageURL);
        let request = {};
        request["imageURL"] = imageURL;
        const responseFromGetLastPath = createPhoto.getLastPath(request);
        logObject("responseFromGetLastPath", responseFromGetLastPath);
        if (responseFromGetLastPath.success === true) {
          const cloudinaryPublicId = responseFromGetLastPath.data;
          const prependFolderNameToCloudinaryPublicId = `devices/${device_name}/${cloudinaryPublicId}`;
          photoNamesWithoutExtension.push(
            prependFolderNameToCloudinaryPublicId
          );
        }
        if (responseFromGetLastPath.success === false) {
          logObject(
            "runtime error -- unable to extract the last path",
            responseFromGetLastPath
          );
          return {
            success: false,
            message: responseFromGetLastPath.message,
            errors: responseFromGetLastPath.errors,
          };
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
  getLastPath: (request) => {
    try {
      const { imageURL } = request;
      const segements = imageURL.split("/").filter((segment) => segment);
      const lastSegment = segements[segements.length - 1];
      const removeFileExtension = lastSegment
        .split(".")
        .slice(0, -1)
        .join(".");
      return {
        success: true,
        data: removeFileExtension,
        status: HTTPStatus.OK,
        message: "successfully removed the file extension",
      };
    } catch (error) {
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
      const responseFromRemovePhoto = await getModelByTenant(
        tenant,
        "photo",
        PhotoSchema
      ).remove({ filter });
      logObject("responseFromRemovePhoto", responseFromRemovePhoto);
      if (responseFromRemovePhoto.success === true) {
        const status = responseFromRemovePhoto.status
          ? responseFromRemovePhoto.status
          : "";
        const data = responseFromRemovePhoto.data;
        return {
          success: true,
          message: responseFromRemovePhoto.message,
          status,
          data,
        };
      }

      if (responseFromRemovePhoto.success === false) {
        const status = responseFromRemovePhoto.status
          ? responseFromRemovePhoto.status
          : "";
        const errors = responseFromRemovePhoto.errors
          ? responseFromRemovePhoto.errors
          : "";
        return {
          success: false,
          message: responseFromRemovePhoto.message,
          errors,
          status,
        };
      }
    } catch (error) {
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
      let responseFromModifyPhoto = await getModelByTenant(
        tenant,
        "photo",
        PhotoSchema
      ).modify({ filter, update, opts });
      if (responseFromModifyPhoto.success === true) {
        const status = responseFromModifyPhoto.status
          ? responseFromModifyPhoto.status
          : "";
        const data = responseFromModifyPhoto.data;
        return {
          success: true,
          message: responseFromModifyPhoto.message,
          status,
          data,
        };
      }

      if (responseFromModifyPhoto.success === false) {
        const status = responseFromModifyPhoto.status
          ? responseFromModifyPhoto.status
          : "";
        const errors = responseFromModifyPhoto.errors
          ? responseFromModifyPhoto.errors
          : "";
        return {
          success: false,
          message: responseFromModifyPhoto.message,
          errors,
          status,
        };
      }
    } catch (error) {
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

      const responseFromRegisterPhoto = await getModelByTenant(
        tenant,
        "photo",
        PhotoSchema
      ).register(body);

      logObject("responseFromRegisterPhoto", responseFromRegisterPhoto);

      if (responseFromRegisterPhoto.success === true) {
        let status = responseFromRegisterPhoto.status
          ? responseFromRegisterPhoto.status
          : "";
        let data = jsonify(responseFromRegisterPhoto.data);
        return {
          success: true,
          message: responseFromRegisterPhoto.message,
          status,
          data,
        };
      }

      if (responseFromRegisterPhoto.success === false) {
        let status = responseFromRegisterPhoto.status
          ? responseFromRegisterPhoto.status
          : "";
        let errors = responseFromRegisterPhoto.errors
          ? responseFromRegisterPhoto.errors
          : "";
        return {
          success: false,
          message: responseFromRegisterPhoto.message,
          errors,
          status,
        };
      }
    } catch (error) {
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
