const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const errors = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-photo-controller`
);
const { validationResult } = require("express-validator");
const createPhotoUtil = require("@utils/create-photo");
const isEmpty = require("is-empty");

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
      let request = Object.assign({}, req);
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
      } else if (responseFromCreatePhoto.success === false) {
        const status = responseFromCreatePhoto.status
          ? responseFromCreatePhoto.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreatePhoto.message,
          errors: responseFromCreatePhoto.errors
            ? responseFromCreatePhoto.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
      let request = Object.assign({}, req);
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
      } else if (responseFromUpdatePhoto.success === false) {
        const status = responseFromUpdatePhoto.status
          ? responseFromUpdatePhoto.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdatePhoto.message,
          errors: responseFromUpdatePhoto.errors
            ? responseFromUpdatePhoto.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  delete: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
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
      } else if (responseFromDeletePhoto.success === false) {
        const status = responseFromDeletePhoto.status
          ? responseFromDeletePhoto.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromDeletePhoto.message,
          errors: responseFromDeletePhoto.errors
            ? responseFromDeletePhoto.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);
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
      } else if (responseFromListPhoto.success === false) {
        const status = responseFromListPhoto.status
          ? responseFromListPhoto.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListPhoto.message,
          errors: responseFromListPhoto.errors
            ? responseFromListPhoto.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
      logText("we are into this now....");
      const hasErrors = !validationResult(req).isEmpty();
      logElement("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      let request = Object.assign({}, req);

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

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
        res.status(status).json({
          success: true,
          message: responseFromCreatePhotoOnPlatform.message,
          created_photo: responseFromCreatePhotoOnPlatform.data
            ? responseFromCreatePhotoOnPlatform.data
            : [],
        });
      } else if (responseFromCreatePhotoOnPlatform.success === false) {
        const status = responseFromCreatePhotoOnPlatform.status
          ? responseFromCreatePhotoOnPlatform.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreatePhotoOnPlatform.message,
          errors: responseFromCreatePhotoOnPlatform.errors
            ? responseFromCreatePhotoOnPlatform.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);

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
      } else if (responseFromDeletePhotoOnPlatform.success === false) {
        const status = responseFromDeletePhotoOnPlatform.status
          ? responseFromDeletePhotoOnPlatform.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromDeletePhotoOnPlatform.message,
          errors: responseFromDeletePhotoOnPlatform.errors
            ? responseFromDeletePhotoOnPlatform.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);

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
      } else if (responseFromUpdatePhotoOnPlatform.success === false) {
        const status = responseFromUpdatePhotoOnPlatform.status
          ? responseFromUpdatePhotoOnPlatform.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdatePhotoOnPlatform.message,
          errors: responseFromUpdatePhotoOnPlatform.errors
            ? responseFromUpdatePhotoOnPlatform.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);

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
      } else if (responseFromDeletePhotoOnCloudinary.success === false) {
        const status = responseFromDeletePhotoOnCloudinary.status
          ? responseFromDeletePhotoOnCloudinary.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromDeletePhotoOnCloudinary.message,
          errors: responseFromDeletePhotoOnCloudinary.errors
            ? responseFromDeletePhotoOnCloudinary.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
      let request = Object.assign({}, req);
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
      } else if (responseFromUpdatePhotoOnCloudinary.success === false) {
        const status = responseFromUpdatePhotoOnCloudinary.status
          ? responseFromUpdatePhotoOnCloudinary.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdatePhotoOnCloudinary.message,
          errors: responseFromUpdatePhotoOnCloudinary.errors
            ? responseFromUpdatePhotoOnCloudinary.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
      let request = Object.assign({}, req);
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
      } else if (responseFromCreatePhotoOnCloudinary.success === false) {
        const status = responseFromCreatePhotoOnCloudinary.status
          ? responseFromCreatePhotoOnCloudinary.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreatePhotoOnCloudinary.message,
          errors: responseFromCreatePhotoOnCloudinary.errors
            ? responseFromCreatePhotoOnCloudinary.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
