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
  getLastPath: (request) => {
    try {
      const { photo } = request;
      const segements = photo.split("/").filter((segment) => segment);
      const lastSegment = segements[segements.length - 1];
      const removeFileExtension = lastSegment
        .split(".")
        .slice(0, -1)
        .join(".");
      return removeFileExtension;
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: error.message,
      };
    }
  },
  create: async (request) => {
    try {
      /**
       * first create from cloudinary
       * then create the image on platform in Photo Entity.
       * Then push the photo object ID to the respective Device document.
       * Depending on the outcome of those operations, send an appropriate response.
       */
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: error.message,
      };
    }
  },
  update: async (request) => {
    try {
      /**
       * first update from cloudinary
       * then delete from platform
       * Afterwards, send an appropriate response.
       */
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      /**
       * validations: ensure that tenant, device and photos array are provided
       * we could also take the device exists check to the route level of checks
       *
       * Then first delete the image from cloudinary
       * then delete the same image URL from platform (pictures in the device Array)
       * Afterwards, send an appropriate response back to the requester
       */
      const { device, tenant } = request.query;
      const { photos } = request.body;
      const deviceExists = await (await DeviceModel(tenant)).exists({
        name: device,
      });
      logElement("does device exist ?", deviceExists);

      if (deviceExists) {
        let { tsBody, deviceBody, options } = updateThingBodies(req, res);
        const channelID = await getChannelID(
          req,
          res,
          device,
          tenant.toLowerCase()
        );
        /**
         * apparently, I am not able to get the device from here
         */
        logElement("the channel ID", channelID);
        const deviceFilter = { name: device };
        let photoNameWithoutExtension = [];
        photos.forEach((photo) => {
          if (photo) {
            photoNameWithoutExtension.push(getLastPath(photo));
          }
        });
        let deleteFromCloudinaryPromise = deleteFromCloudinary(
          photoNameWithoutExtension
        );
        let updateDevicePromise = updateDeviceUtil(
          req,
          res,
          channelID,
          device,
          deviceBody,
          tsBody,
          deviceFilter,
          tenant,
          options
        );

        Promise.all([deleteFromCloudinaryPromise, updateDevicePromise]).then(
          (values) => {
            logElement("the values", values);
          }
        );
      } else {
        logText("device does not exist in the network");
        res.status(HTTPStatus.BAD_REQUEST).json({
          message: "device does not exist in the network",
          success: false,
          device,
        });
      }
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete_v2: async (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: error.message,
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
        errors: error.message,
      };
    }
  },
  createPhotoOnCloudinary: async (request) => {
    try {
      let responseFromCreateOnCloudinary = {};

      if (responseFromCreateOnCloudinary.success === true) {
        return {
          success: true,
          message: "",
          data: responseFromCreateOnCloudinary.data,
          status: responseFromCreateOnCloudinary.status,
        };
      }

      if (responseFromCreateOnCloudinary.success === false) {
        let status = responseFromCreateOnCloudinary.status
          ? responseFromCreateOnCloudinary.status
          : "";
        let errors = responseFromCreateOnCloudinary.errors
          ? responseFromCreateOnCloudinary.errors
          : "";
        return {
          success: true,
          message: "",
          status,
          errors,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: error.message,
      };
    }
  },
  deletePhotoOnPlatform: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.photos(request);
      logObject("filter ", filter);
      const update = body;
      const opts = { new: true };
      let responseFromRemovePhoto = await getModelByTenant(
        tenant,
        "photo",
        PhotoSchema
      ).remove({ filter });
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
        errors: error.message,
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
        errors: error.message,
      };
    }
  },
  updatePhotoOnCloudinary: async (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: error.message,
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
        errors: error.message,
      };
    }
  },
  deletePhotoOnCloudinary: (request) => {
    try {
      let { image_ids } = request;
      logText(".....deleting image from cloudinary......");
      cloudinary.api.delete_resources(image_ids, (error, result) => {
        if (result) {
          logObject("response from cloudinary", result);
          return {
            success: true,
            message: "image delete successfully",
            data: result,
            status: HTTPStatus.OK,
          };
        }

        if (error) {
          logObject("unable to delete from cloudinary", error);
          return {
            success: false,
            message: "unable to delete from cloudinary",
            errors: error,
            status: HTTPStatus.BAD_GATEWAY,
          };
        }
        return {
          success: false,
          message: "unable to delete the photo",
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
      });
    } catch (error) {
      logElement("server error", error.message);
      return {
        success: false,
        message: "server error",
        errors: error.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  extractImageIds: async (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: error.message,
      };
    }
  },
};

module.exports = createPhoto;
