const HTTPStatus = require("http-status");
const PhotoSchema = require("../models/Photo");
const { getModelByTenant } = require("./multitenancy");
const isEmpty = require("is-empty");
const axios = require("axios");
const constants = require("../config/constants");
const cloudinary = require("../config/cloudinary");
const { logObject, logElement, logText } = require("./log");
const getLastPath = require("./get-last-path");
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
          issue: error.message,
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
          issue: error.message,
        },
      };
    }
  },
  delete: async (request) => {
    try {
      logText("deleting photo from the util...");
      const responseFromDeletePhotoOnCloudinary = await createPhoto.deletePhotoOnCloudinary(
        request
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
          issue: e.message,
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
          issue: error.message,
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
                issue: error,
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
          issue: error.message,
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
          issue: error.message,
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
            issue: "no response from the utility that extracts the image Ids",
          },
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
      }

      if (responseFromExtractImageIds.success === true) {
        const status = responseFromExtractImageIds.status
          ? responseFromExtractImageIds.status
          : HTTPStatus.OK;
        const image_ids = responseFromExtractImageIds.data;
        logText("...deleting image from cloudinary...");
        logObject("the image_ids", image_ids);

        const responseFromCloudinary = await cloudinary.api.delete_resources(
          image_ids,
          (error, result) => {
            if (result) {
              logObject("response from cloudinary", result);
              if (result.partial === false) {
                return {
                  success: false,
                  message: "unable to delete image",
                  errors: result.deleted,
                  data: result,
                  status,
                };
              }

              if (result.partial === true) {
                return {
                  success: true,
                  message: "image delete successfully",
                  data: result.deleted,
                  status,
                };
              }
            } else if (error) {
              logObject("unable to delete from cloudinary", error);
              return {
                success: false,
                message: "unable to delete the photo",
                errors: {
                  issue: error,
                },
                status: HTTPStatus.BAD_GATEWAY,
              };
            }
            return {
              success: false,
              message: "unable to delete the photo the photo",
              status: HTTPStatus.INTERNAL_SERVER_ERROR,
            };
          }
        );
        logObject("responseFromCloudinary", responseFromCloudinary);
        if (responseFromCloudinary.partial === false) {
          return {
            success: false,
            message: "unable to delete image",
            errors: responseFromCloudinary.deleted,
            status: HTTPStatus.NOT_FOUND,
          };
        }

        if (responseFromCloudinary.partial === true) {
          return {
            success: true,
            message: "image delete successfully",
            data: responseFromCloudinary.deleted,
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
      logElement("Internal Server Error", error.message);
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          issue: error.message,
        },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  extractImageIds: (request) => {
    try {
      const { image_urls } = request.body;
      logText("...checking if the input is an array...");
      if (!Array.isArray(image_urls)) {
        return {
          success: false,
          message: "the provided images must be arrays",
          status: HTTPStatus.BAD_REQUEST,
        };
      }
      let response = {};
      image_urls.forEach((imageURL) => {
        logElement("the imageURL", imageURL);
        if (isEmpty(imageURL)) {
          return {
            success: false,
            message: "no image provided in the request",
          };
        }
        let request = {};
        request["imageURL"] = imageURL;
        const responseFromGetLastPath = createPhoto.getLastPath(request);
        logObject("responseFromGetLastPath", responseFromGetLastPath);
        if (responseFromGetLastPath.success === true) {
          logText("we are positive this time!");
          let photoNamesWithoutExtension = [];
          const data = responseFromGetLastPath.data;
          photoNamesWithoutExtension.push(data);
          logObject("photoNamesWithoutExtension", photoNamesWithoutExtension);
          response = {
            success: true,
            data: photoNamesWithoutExtension,
            message: "successfully extracted the Image Ids",
            status: HTTPStatus.OK,
          };
          logObject("the response", response);
        }
        if (responseFromGetLastPath.success === false) {
          response = {
            success: false,
            errors: responseFromGetLastPath.errors,
            message: responseFromGetLastPath.message,
          };
        }
      });
      return response;
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          issue: error.message,
        },
      };
    }
  },
  getLastPath: (request) => {
    try {
      const { imageURL } = request;
      if (isEmpty(imageURL)) {
        return {
          success: false,
          message: "the imageURL is missing in the request",
        };
      }
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
          issue: error.message,
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
          issue: error.message,
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
          issue: error.message,
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
          issue: error.message,
        },
      };
    }
  },
};

module.exports = createPhoto;
