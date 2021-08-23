const PhotoSchema = require("../models/Photo");
const fs = require("fs");
const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("./log");
const { deleteFromCloudinary } = require("./delete-cloudinary-image");
const { tryCatchErrors, missingQueryParams } = require("./errors");
const cloudinary = require("../config/cloudinary");
const uploadImages = require("../utils/upload-images");

const createPhoto = {
  /*************** for integrated system actions ************/
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
          let status = responseFromCreatePhotoOnPlatform.status
            ? responseFromCreatePhotoOnPlatform.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;

          let errors = responseFromCreatePhotoOnPlatform.errors
            ? responseFromCreatePhotoOnPlatform.errors
            : "";
          return {
            message: responseFromCreatePhotoOnPlatform.message,
            success: false,
            status,
            errors,
          };
        }
      }

      if (responseFromCreatePhotoOnCloudinary.success === false) {
        let status = responseFromCreatePhotoOnCloudinary.status
          ? responseFromCreatePhotoOnCloudinary.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        let errors = responseFromCreatePhotoOnCloudinary.errors
          ? responseFromCreatePhotoOnCloudinary.errors
          : "";
        return {
          message: responseFromCreatePhotoOnCloudinary.message,
          errors,
          success: false,
          status,
        };
      }
    } catch (err) {
      logElement("the errors in create photo util", err.message);
      return {
        message: "internal server errors",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      let responseFromUpdatePhotoOnCloudinary = await createPhoto.updatePhotoOnCloudinary(
        request
      );

      if (responseFromUpdatePhotoOnCloudinary.success === true) {
        let responseFromUpdatePhotoOnPlatform = await createPhoto.updatePhotoOnPlatform(
          request
        );

        if (responseFromUpdatePhotoOnPlatform.success === true) {
          let status = responseFromUpdatePhotoOnPlatform.status
            ? responseFromUpdatePhotoOnPlatform.status
            : HTTPStatus.OK;
          return {
            success: true,
            status,
            message: responseFromUpdatePhotoOnPlatform.message,
          };
        }

        if (responseFromUpdatePhotoOnPlatform.success === false) {
          let status = responseFromUpdatePhotoOnPlatform.status
            ? responseFromUpdatePhotoOnPlatform.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          let errors = responseFromUpdatePhotoOnPlatform.errors
            ? responseFromUpdatePhotoOnPlatform.errors
            : "";

          return {
            success: false,
            errors,
            status,
            message: responseFromUpdatePhotoOnPlatform.message,
          };
        }
      }

      if (responseFromUpdatePhotoOnCloudinary.success === false) {
        let status = responseFromUpdatePhotoOnCloudinary.status
          ? responseFromUpdatePhotoOnCloudinary.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromUpdatePhotoOnCloudinary.errors
          ? responseFromUpdatePhotoOnCloudinary.errors
          : "";
        return {
          success: false,
          message: responseFromUpdatePhotoOnCloudinary.message,
          status,
          errors,
        };
      }
    } catch (err) {
      logElement("update Photo util", err.message);
      return {
        success: false,
        message: "unable to update photo",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      let responseFromDeletePhotoOnCloudinary = await createPhoto.deletePhotoOnCloudinary(
        request
      );

      if (responseFromDeletePhotoOnCloudinary.success === true) {
        let responseFromDeletePhotoOnPlatform = await createPhoto.deletePhotoOnPlatform(
          request
        );

        if (responseFromDeletePhotoOnPlatform.success === true) {
          let status = responseFromDeletePhotoOnPlatform.status
            ? responseFromDeletePhotoOnPlatform.status
            : HTTPStatus.OK;
          return {
            success: true,
            status,
            message: responseFromDeletePhotoOnPlatform.message,
          };
        }

        if (responseFromDeletePhotoOnPlatform.success === false) {
          let status = responseFromDeletePhotoOnPlatform.status
            ? responseFromDeletePhotoOnPlatform.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          let errors = responseFromDeletePhotoOnPlatform.errors
            ? responseFromDeletePhotoOnPlatform.errors
            : "";

          return {
            success: false,
            errors,
            status,
            message: responseFromDeletePhotoOnPlatform.message,
          };
        }
      }

      if (responseFromDeletePhotoOnCloudinary.success === false) {
        let status = responseFromDeletePhotoOnCloudinary.status
          ? responseFromDeletePhotoOnCloudinary.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromDeletePhotoOnCloudinary.errors
          ? responseFromDeletePhotoOnCloudinary.errors
          : "";
        return {
          success: false,
          message: responseFromDeletePhotoOnCloudinary.message,
          status,
          errors,
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
          : HTTPStatus.INTERNAL_SERVER_ERROR;

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
          : HTTPStatus.OK;
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

      if (responseFromRegisterPhoto.success === true) {
        let status = responseFromRegisterPhoto.status
          ? responseFromRegisterPhoto.status
          : HTTPStatus.OK;
        return {
          success: true,
          data: responseFromRegisterPhoto.data,
          message: responseFromRegisterPhoto.message,
          status,
        };
      }

      if (responseFromRegisterPhoto.success === false) {
        let status = responseFromRegisterPhoto.status
          ? responseFromRegisterPhoto.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
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
    } catch (err) {
      logElement("update Photo util errors", err.message);
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
          : HTTPStatus.OK;
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
          : HTTPStatus.INTERNAL_SERVER_ERROR;
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
          : HTTPStatus.OK;
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
          : HTTPStatus.INTERNAL_SERVER_ERROR;

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
  createPhotoOnCloudinary: async (request) => {
    try {
      let { body } = request;
      let { query } = request;

      cloudinary.uploader
        .upload(body.path, { resource_type: "image" })
        .then((result) => {
          logText("we have created the photo");
          return {
            success: true,
            data: result,
            message: "photo created",
            status: HTTPStatus.CREATED,
          };
        })
        .catch((error) => {
          logText("the bad gateway error");
          logObject("error", error);
          return {
            success: false,
            error,
            message: "Unable to upload image",
            status: HTTPStatus.BAD_GATEWAY,
          };
        });
    } catch (err) {
      logText("the server side error");
      return {
        success: false,
        message: "Server Side Error",
        err: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updatePhotoOnCloudinary: async (request) => {
    try {
    } catch (err) {
      return {
        success: false,
        message: "Server Side Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  deletePhotoOnCloudinary: async (request) => {
    try {
      let { query, body } = request;
      const { photo_urls } = body;

      photo_urls.forEach((photo) => {
        if (photo) {
          photoNameWithoutExtension.push(createPhoto.getLastPath(photo));
        }
      });
      let imageIDs = photoNameWithoutExtension;

      cloudinary.api.delete_resources(imageIDs, (errors, result) => {
        if (result) {
          logObject("response from cloudinary", result);
          return {
            success: true,
            message: "images deleted successfully",
            status: HTTPStatus.OK,
          };
        }

        if (errors) {
          logObject("unable to delete from cloudinary", errors);
          logObject("unable to delete from cloudinary", errors);
          return {
            success: false,
            message: "unable to delete from cloudinary",
            errors,
            status: HTTPStatus.BAD_GATEWAY,
          };
        }
      });
    } catch (err) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  getLastPath: async (photo) => {
    const segements = photo.split("/").filter((segment) => segment);
    const lastSegment = segements[segements.length - 1];
    const removeFileExtension = lastSegment
      .split(".")
      .slice(0, -1)
      .join(".");
    return removeFileExtension;
  },

  uploads: (file, folder) => {
    return new Promise((resolve) => {
      cloudinary.uploader.upload(
        file,
        (result) => {
          resolve({
            url: result.url,
            id: result.public_id,
          });
        },
        {
          resource_type: "auto",
          folder: folder,
        }
      );
    });
  },
};

module.exports = createPhoto;
