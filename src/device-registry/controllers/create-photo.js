const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("../utils/log");
const errors = require("../utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger("create-photo-controller");
const { validationResult } = require("express-validator");
const createPhotoUtil = require("../utils/create-photo");

const processImage = {
  create: async (req, res) => {
    try {
      return res.status(HTTPStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "coming soon...",
      });
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
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
        errors: { message: error.message },
      });
    }
  },
  update: async (req, res) => {
    try {
      return res.status(HTTPStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "coming soon...",
      });
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
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
        errrors: { message: error.message },
      });
    }
  },
  delete: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
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
          message: error.message,
        },
      });
    }
  },
  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
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
        errors: { message: error.message },
      });
    }
  },
  /******************** platform ********************************/
  createPhotoOnPlatform: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      logElement("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      const { tenant } = query;
      const { image_url, device_name, device_id } = body;

      let request = {};
      request["body"] = {};
      request["query"] = {};
      request["body"]["image_url"] = image_url;
      request["body"]["device_name"] = device_name;
      request["body"]["device_id"] = device_id;
      request["query"]["tenant"] = tenant;

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
        const data = responseFromCreatePhotoOnPlatform.data;
        res.status(status).json({
          success: true,
          message: responseFromCreatePhotoOnPlatform.message,
          created_photo: data,
        });
      } else if (responseFromCreatePhotoOnPlatform.success === false) {
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
        errors: { message: error.message },
      });
    }
  },
  deletePhotoOnPlatform: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
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
        errors: { message: error.message },
      });
    }
  },
  updatePhotoOnPlatform: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
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
        errors: { message: error.message },
      });
    }
  },
  /*********** cloudinary *************************/
  deletePhotoOnCloudinary: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
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
          deletion_details: responseFromDeletePhotoOnCloudinary.data,
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
    } catch (error) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  updatePhotoOnCloudinary: async (req, res) => {
    try {
      return res.status(HTTPStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "coming soon...",
      });
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
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
    } catch (error) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  createPhotoOnCloudinary: async (req, res) => {
    try {
      return res.status(HTTPStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "coming soon...",
      });
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
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
          message: error.message,
        },
      });
    }
  },
};

module.exports = processImage;
