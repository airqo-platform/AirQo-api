const PhotoSchema = require("../models/Photo");
const fs = require("fs");
const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("./log");
const { deleteFromCloudinary } = require("./delete-cloudinary-image");
const { tryCatchErrors, missingQueryParams } = require("./errors");
const cloudinary = require("../config/cloudinary");

const createPhoto = {
  /*************** for integrated system actions *********** */
  create: async (request) => {
    try {
      let responseFromCreatePhotoOnCloudinary = await createPhoto.createPhotoOnCloudinary(
        request
      );

      if (responseFromCreatePhotoOnCloudinary.success === true) {
        let responseFromCreatePhotoOnPlatform = await createPhoto.createPhotoOnPlatform(
          request
        );

        if (responseFromCreatePhotoOnPlatform.success === true) {
          let status = responseFromCreatePhotoOnPlatform.status
            ? responseFromCreatePhotoOnPlatform.status
            : HTTPStatus.OK;
          return {
            success: true,
            message: responseFromCreatePhotoOnPlatform.message,
            status,
          };
        }

        if (responseFromCreatePhotoOnPlatform.success === false) {
        }
      }

      if (responseFromCreatePhotoOnCloudinary.success === false) {
        let status = responseFromCreatePhotoOnCloudinary.status
          ? responseFromCreatePhotoOnCloudinary.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        let error = responseFromCreatePhotoOnCloudinary.error
          ? responseFromCreatePhotoOnCloudinary.error
          : "";

        return {
          message: responseFromCreatePhotoOnCloudinary.message,
          error,
          success: false,
          status,
        };
      }
    } catch (err) {
      logElement("the error in create photo util", err.message);
      return {
        message: "internal server error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      let { query } = request;
      let { body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.photos(request);

      let responseFromModifyPhoto = await getModelByTenant(
        tenant.toLowerCase(),
        "photo",
        PhotoSchema
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyPhoto.success === true) {
        let status = responseFromModifyPhoto.status
          ? responseFromModifyPhoto.status
          : "";
        return {
          success: true,
          message: responseFromModifyPhoto.message,
          data: responseFromModifyPhoto.data,
          status,
        };
      }

      if (responseFromModifyPhoto.success === false) {
        let errors = responseFromModifyPhoto.errors
          ? responseFromModifyPhoto.errors
          : "";

        let status = responseFromModifyPhoto.status
          ? responseFromModifyPhoto.status
          : "";

        return {
          success: false,
          message: responseFromModifyPhoto.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("update Photo util", err.message);
      return {
        success: false,
        message: "unable to update photo",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.photos(request);
      let responseFromRemovePhoto = await getModelByTenant(
        tenant.toLowerCase(),
        "photo",
        PhotoSchema
      ).remove({
        filter,
      });

      if (responseFromRemovePhoto.success === true) {
        let status = responseFromRemovePhoto.status
          ? responseFromRemovePhoto.status
          : "";
        return {
          success: true,
          message: responseFromRemovePhoto.message,
          data: responseFromRemovePhoto.data,
          status,
        };
      }

      if (responseFromRemovePhoto.success === false) {
        let errors = responseFromRemovePhoto.errors
          ? responseFromRemovePhoto.errors
          : "";

        let status = responseFromRemovePhoto.status
          ? responseFromRemovePhoto.status
          : "";

        return {
          success: false,
          message: responseFromRemovePhoto.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("delete Photo util", err.message);
      return {
        success: false,
        message: "unable to delete photo",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      const limit = 1000;
      const skip = parseInt(query.skip) || 0;
      let filter = generateFilter.photos(request);
      logObject("filter", filter);

      let responseFromListPhoto = await getModelByTenant(
        tenant.toLowerCase(),
        "photo",
        PhotoSchema
      ).list({
        filter,
        limit,
        skip,
      });

      logObject("responseFromListPhoto", responseFromListPhoto);
      if (responseFromListPhoto.success === false) {
        let errors = responseFromListPhoto.errors
          ? responseFromListPhoto.errors
          : "";

        let status = responseFromListPhoto.status
          ? responseFromListPhoto.status
          : "";
        return {
          success: false,
          message: responseFromListPhoto.message,
          errors,
          status,
        };
      }

      if (responseFromListPhoto.success === true) {
        let status = responseFromListPhoto.status
          ? responseFromListPhoto.status
          : "";
        data = responseFromListPhoto.data;
        return {
          success: true,
          message: responseFromListPhoto.message,
          data,
          status,
        };
      }
    } catch (err) {
      logElement("list Photos util", err.message);
      return {
        success: false,
        message: "unable to list photo",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /********** for platform only activities *****************/
  createPhotoOnPlatform: async (request) => {
    try {
      const { tenant } = request.query;
      const { body } = request;

      const responseFromRegisterPhoto = await getModelByTenant(
        tenant,
        "photo",
        PhotoSchema
      ).register(body);

      logger.info(
        `the responseFromRegisterPhoto --${jsonify(responseFromRegisterPhoto)} `
      );
      let status = responseFromRegisterPhoto.status
        ? responseFromRegisterPhoto.status
        : "";
      if (responseFromRegisterPhoto.success === true) {
        return {
          success: true,
          data: responseFromRegisterPhoto.data,
          message: responseFromRegisterPhoto.message,
          status,
        };
      }

      if (responseFromRegisterPhoto.success === false) {
        let error = responseFromRegisterPhoto.error
          ? responseFromRegisterPhoto.error
          : "";
        return {
          success: false,
          message: responseFromRegisterPhoto.message,
          error,
          status,
        };
      }
    } catch (err) {
      logElement("update Photo util", err.message);
      return {
        success: false,
        message: "unable to create photo on the platform",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updatePhotoOnPlatform: async (request) => {
    try {
      let { query } = request;
      let { body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.photos(request);

      let responseFromModifyPhoto = await getModelByTenant(
        tenant.toLowerCase(),
        "photo",
        PhotoSchema
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyPhoto.success === true) {
        let status = responseFromModifyPhoto.status
          ? responseFromModifyPhoto.status
          : "";
        return {
          success: true,
          message: responseFromModifyPhoto.message,
          data: responseFromModifyPhoto.data,
          status,
        };
      }

      if (responseFromModifyPhoto.success === false) {
        let errors = responseFromModifyPhoto.errors
          ? responseFromModifyPhoto.errors
          : "";

        let status = responseFromModifyPhoto.status
          ? responseFromModifyPhoto.status
          : "";

        return {
          success: false,
          message: responseFromModifyPhoto.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("update Photo util", err.message);
      return {
        success: false,
        message: "unable to update photo",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deletePhotoOnPlatform: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.photos(request);
      let responseFromRemovePhoto = await getModelByTenant(
        tenant.toLowerCase(),
        "photo",
        PhotoSchema
      ).remove({
        filter,
      });

      if (responseFromRemovePhoto.success === true) {
        let status = responseFromRemovePhoto.status
          ? responseFromRemovePhoto.status
          : "";
        return {
          success: true,
          message: responseFromRemovePhoto.message,
          data: responseFromRemovePhoto.data,
          status,
        };
      }

      if (responseFromRemovePhoto.success === false) {
        let errors = responseFromRemovePhoto.errors
          ? responseFromRemovePhoto.errors
          : "";

        let status = responseFromRemovePhoto.status
          ? responseFromRemovePhoto.status
          : "";

        return {
          success: false,
          message: responseFromRemovePhoto.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("delete Photo util", err.message);
      return {
        success: false,
        message: "unable to delete photo",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /************ for cloudinary only activities *************** */
  createPhotoOnCloudinary: async (request) => {},
  updatePhotoOnCloudinary: async (request) => {},
  deletePhotoOnCloudinary: async (request) => {},
};

module.exports = createPhoto;
