const uploadImages = require("../utils/upload-images");
const fs = require("fs");
const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("../utils/log");
const { deleteFromCloudinary } = require("../utils/delete-cloudinary-image");
const {
  tryCatchErrors,
  missingQueryParams,
  badRequest,
} = require("../utils/errors");
const getDetail = require("../utils/get-device-details");
const isEmpty = require("is-empty");
const {
  updateThingBodies,
  getChannelID,
} = require("../utils/does-device-exist");
const getLastPath = require("../utils/get-last-path");
const updateDeviceUtil = require("../utils/update-device");
const log4js = require("log4js");
const logger = log4js.getLogger("create-photo-controller");
const { validationResult } = require("express-validator");
const manipulateArraysUtil = require("../utils/manipulate-arrays");
const createPhotoUtil = require("../utils/create-photo");
const { registerDeviceUtil } = require("../utils/create-device");

const processImage = {
  create: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;

      const responseFromCreatePhoto = await createPhotoUtil.create(request);

      if (responseFromCreatePhoto.success === true) {
        const status = responseFromCreatePhoto.status
          ? responseFromCreatePhoto.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreatePhoto.message,
          created_photo: responseFromCreatePhoto.data,
        });
      }

      if (responseFromCreatePhoto.success === false) {
        const status = responseFromCreatePhoto.status
          ? responseFromCreatePhoto.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromCreatePhoto.errors
          ? responseFromCreatePhoto.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromCreatePhoto.message,
          errors,
        });
      }
    } catch (error) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
      });
    }
  },
  update: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromUpdatePhoto = await createPhotoUtil.update(request);

      if (responseFromUpdatePhoto.success === true) {
        const status = responseFromUpdatePhoto.status
          ? responseFromUpdatePhoto.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdatePhoto.message,
          updated_photo: responseFromUpdatePhoto.data,
        });
      }

      if (responseFromUpdatePhoto.success === false) {
        const status = responseFromUpdatePhoto.status
          ? responseFromUpdatePhoto.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromUpdatePhoto.errors
          ? responseFromUpdatePhoto.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromUpdatePhoto.message,
          errors,
        });
      }
    } catch (error) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errrors: error.message,
      });
    }
  },
  delete: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromDeletePhoto = await createPhotoUtil.delete(request);

      logObject("responseFromDeletePhoto", responseFromDeletePhoto);

      if (responseFromDeletePhoto.success === true) {
        const status = responseFromDeletePhoto.status
          ? responseFromDeletePhoto.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeletePhoto.message,
          created_photo: responseFromDeletePhoto.data,
        });
      }

      if (responseFromDeletePhoto.success === false) {
        const status = responseFromDeletePhoto.status
          ? responseFromDeletePhoto.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromDeletePhoto.errors
          ? responseFromDeletePhoto.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromDeletePhoto.message,
          errors,
        });
      }
    } catch (error) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: {
          issue: error.message,
        },
      });
    }
  },
  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromListPhoto = await createPhotoUtil.list(request);
      logObject("responseFromListPhoto in controller", responseFromListPhoto);

      if (responseFromListPhoto.success === true) {
        const status = responseFromListPhoto.status
          ? responseFromListPhoto.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListPhoto.message,
          photos: responseFromListPhoto.data,
        });
      }

      if (responseFromListPhoto.success === false) {
        const status = responseFromListPhoto.status
          ? responseFromListPhoto.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromListPhoto.errors
          ? responseFromListPhoto.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromListPhoto.message,
          errors,
        });
      }
    } catch (error) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
      });
    }
  },
  /******************** platform ********************************/
  createPhotoOnPlatform: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromCreatePhotoOnPlatform = await createPhotoUtil.createPhotoOnPlatform(
        request
      );
      logObject(
        "responseFromCreatePhotoOnPlatform",
        responseFromCreatePhotoOnPlatform
      );
      if (responseFromCreatePhotoOnPlatform.success === true) {
        const status = responseFromCreatePhotoOnPlatform.status
          ? responseFromCreatePhotoOnPlatform.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreatePhotoOnPlatform.message,
          created_photo: responseFromCreatePhotoOnPlatform.data,
        });
      }

      if (responseFromCreatePhotoOnPlatform.success === false) {
        const status = responseFromCreatePhotoOnPlatform.status
          ? responseFromCreatePhotoOnPlatform.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromCreatePhotoOnPlatform.errors
          ? responseFromCreatePhotoOnPlatform.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromCreatePhotoOnPlatform.message,
          errors,
        });
      }
    } catch (error) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
      });
    }
  },
  deletePhotoOnPlatform: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromDeletePhotoOnPlatform = await createPhotoUtil.deletePhotoOnPlatform(
        request
      );

      logObject(
        "responseFromDeletePhotoOnPlatform",
        responseFromDeletePhotoOnPlatform
      );

      if (responseFromDeletePhotoOnPlatform.success === true) {
        const status = responseFromDeletePhotoOnPlatform.status
          ? responseFromDeletePhotoOnPlatform.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeletePhotoOnPlatform.message,
          deleted_photo: responseFromDeletePhotoOnPlatform.data,
        });
      }

      if (responseFromDeletePhotoOnPlatform.success === false) {
        const status = responseFromDeletePhotoOnPlatform.status
          ? responseFromDeletePhotoOnPlatform.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromDeletePhotoOnPlatform.errors
          ? responseFromDeletePhotoOnPlatform.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromDeletePhotoOnPlatform.message,
          errors,
        });
      }
    } catch (error) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
      });
    }
  },
  updatePhotoOnPlatform: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromUpdatePhotoOnPlatform = await createPhotoUtil.updatePhotoOnPlatform(
        request
      );

      logObject(
        "responseFromUpdatePhotoOnPlatform",
        responseFromUpdatePhotoOnPlatform
      );

      if (responseFromUpdatePhotoOnPlatform.success === true) {
        const status = responseFromUpdatePhotoOnPlatform.status
          ? responseFromUpdatePhotoOnPlatform.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdatePhotoOnPlatform.message,
          updated_photo: responseFromUpdatePhotoOnPlatform.data,
        });
      }

      if (responseFromUpdatePhotoOnPlatform.success === false) {
        const status = responseFromUpdatePhotoOnPlatform.status
          ? responseFromUpdatePhotoOnPlatform.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromUpdatePhotoOnPlatform.errors
          ? responseFromUpdatePhotoOnPlatform.errors
          : status;
        res.status(status).json({
          success: false,
          message: responseFromUpdatePhotoOnPlatform.message,
          errors,
        });
      }
    } catch (error) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
      });
    }
  },
  /*********** cloudinary *************************/
  deletePhotoOnCloudinary: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromDeletePhotoOnCloudinary = await createPhotoUtil.deletePhotoOnCloudinary(
        request
      );

      if (responseFromDeletePhotoOnCloudinary.success === true) {
        const status = responseFromDeletePhotoOnCloudinary.status
          ? responseFromDeletePhotoOnCloudinary.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeletePhotoOnCloudinary.message,
          created_photo: responseFromDeletePhotoOnCloudinary.data,
        });
      }

      if (responseFromDeletePhotoOnCloudinary.success === false) {
        const status = responseFromDeletePhotoOnCloudinary.status
          ? responseFromDeletePhotoOnCloudinary.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromDeletePhotoOnCloudinary.errors
          ? responseFromDeletePhotoOnCloudinary.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromDeletePhotoOnCloudinary.message,
          errors,
        });
      }
    } catch (errors) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
      });
    }
  },
  updatePhotoOnCloudinary: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromUpdatePhotoOnCloudinary = await createPhotoUtil.updatePhotoOnCloudinary(
        request
      );

      if (responseFromUpdatePhotoOnCloudinary.success === true) {
        const status = responseFromUpdatePhotoOnCloudinary.status
          ? responseFromUpdatePhotoOnCloudinary.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdatePhotoOnCloudinary.message,
          created_photo: responseFromUpdatePhotoOnCloudinary.data,
        });
      }

      if (responseFromUpdatePhotoOnCloudinary.success === false) {
        const status = responseFromUpdatePhotoOnCloudinary.status
          ? responseFromUpdatePhotoOnCloudinary.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromUpdatePhotoOnCloudinary.errors
          ? responseFromUpdatePhotoOnCloudinary.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromUpdatePhotoOnCloudinary.message,
          errors,
        });
      }
    } catch (errors) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
      });
    }
  },
  createPhotoOnCloudinary: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      const responseFromCreatePhotoOnCloudinary = await createPhotoUtil.createPhotoOnCloudinary(
        request
      );
      logObject(
        "responseFromCreatePhotoOnCloudinary",
        responseFromCreatePhotoOnCloudinary
      );
      if (responseFromCreatePhotoOnCloudinary.success === true) {
        const status = responseFromCreatePhotoOnCloudinary.status
          ? responseFromCreatePhotoOnCloudinary.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreatePhotoOnCloudinary.message,
          created_photo: responseFromCreatePhotoOnCloudinary.data,
        });
      }

      if (responseFromCreatePhotoOnCloudinary.success === false) {
        const status = responseFromCreatePhotoOnCloudinary.status
          ? responseFromCreatePhotoOnCloudinary.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromCreatePhotoOnCloudinary.errors
          ? responseFromCreatePhotoOnCloudinary.errors
          : "";
        res.status(status).json({
          success: false,
          message: responseFromCreatePhotoOnCloudinary.message,
          errors,
        });
      }
    } catch (error) {
      logObject("error", error);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: {
          issue: error.message,
        },
      });
    }
  },

  /**
   ******************** legacy ***************************************
   */
  uploadManyPhotosOnCloudinary: async (req, res) => {
    try {
      const { tenant } = req.query;

      if (tenant) {
        const uploader = async (path) => {
          await uploadImages.uploads(path, "Images");
        };
        const urls = [];
        const files = req.files;

        for (const file of files) {
          const { path } = file;
          const newPath = await uploader(path);
          urls.push(newPath);
          fs.unlinkSync(path);
        }

        res.status(HTTPStatus.OK).json({
          success: true,
          message: "images uploaded successfully",
          data: urls,
        });
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(e, req, res);
    }
  },
  deletePhotos: async (req, res) => {
    try {
      const { device, tenant } = req.query;
      const { photos } = req.body;
      if (tenant && device && photos) {
        const deviceDetails = await getDetail(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          let { tsBody, deviceBody, options } = updateThingBodies(req, res);
          const channelID = await getChannelID(
            req,
            res,
            device,
            tenant.toLowerCase()
          );

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
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      logElement(
        "unable to carry out the entire deletion of device",
        e.message
      );
      logObject("unable to carry out the entire deletion of device", e.message);
      tryCatchErrors(res, e);
    }
  },
};

module.exports = processImage;
