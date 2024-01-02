const httpStatus = require("http-status");
const { logText } = require("@utils/log");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-photo-controller`
);
const createPhotoUtil = require("@utils/create-photo");
const isEmpty = require("is-empty");

const processImage = {
  create: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "coming soon...",
      });
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreatePhoto = await createPhotoUtil.create(request);

      if (responseFromCreatePhoto.success === true) {
        const status = responseFromCreatePhoto.status
          ? responseFromCreatePhoto.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreatePhoto.message,
          created_photo: responseFromCreatePhoto.data,
        });
      } else if (responseFromCreatePhoto.success === false) {
        const status = responseFromCreatePhoto.status
          ? responseFromCreatePhoto.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreatePhoto.message,
          errors: responseFromCreatePhoto.errors
            ? responseFromCreatePhoto.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  update: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "coming soon...",
      });
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdatePhoto = await createPhotoUtil.update(request);

      if (responseFromUpdatePhoto.success === true) {
        const status = responseFromUpdatePhoto.status
          ? responseFromUpdatePhoto.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdatePhoto.message,
          updated_photo: responseFromUpdatePhoto.data,
        });
      } else if (responseFromUpdatePhoto.success === false) {
        const status = responseFromUpdatePhoto.status
          ? responseFromUpdatePhoto.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdatePhoto.message,
          errors: responseFromUpdatePhoto.errors
            ? responseFromUpdatePhoto.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  delete: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromDeletePhoto = await createPhotoUtil.delete(request);

      if (responseFromDeletePhoto.success === true) {
        const status = responseFromDeletePhoto.status
          ? responseFromDeletePhoto.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeletePhoto.message,
          created_photo: responseFromDeletePhoto.data,
        });
      } else if (responseFromDeletePhoto.success === false) {
        const status = responseFromDeletePhoto.status
          ? responseFromDeletePhoto.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromDeletePhoto.message,
          errors: responseFromDeletePhoto.errors
            ? responseFromDeletePhoto.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  list: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListPhoto = await createPhotoUtil.list(request);

      if (responseFromListPhoto.success === true) {
        const status = responseFromListPhoto.status
          ? responseFromListPhoto.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListPhoto.message,
          photos: responseFromListPhoto.data,
        });
      } else if (responseFromListPhoto.success === false) {
        const status = responseFromListPhoto.status
          ? responseFromListPhoto.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListPhoto.message,
          errors: responseFromListPhoto.errors
            ? responseFromListPhoto.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  /******************** platform ********************************/
  createPhotoOnPlatform: async (req, res, next) => {
    try {
      logText("we are into this now....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreatePhotoOnPlatform = await createPhotoUtil.createPhotoOnPlatform(
        request
      );

      if (responseFromCreatePhotoOnPlatform.success === true) {
        const status = responseFromCreatePhotoOnPlatform.status
          ? responseFromCreatePhotoOnPlatform.status
          : httpStatus.OK;
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
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreatePhotoOnPlatform.message,
          errors: responseFromCreatePhotoOnPlatform.errors
            ? responseFromCreatePhotoOnPlatform.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  deletePhotoOnPlatform: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromDeletePhotoOnPlatform = await createPhotoUtil.deletePhotoOnPlatform(
        request
      );

      if (responseFromDeletePhotoOnPlatform.success === true) {
        const status = responseFromDeletePhotoOnPlatform.status
          ? responseFromDeletePhotoOnPlatform.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeletePhotoOnPlatform.message,
          deleted_photo: responseFromDeletePhotoOnPlatform.data,
        });
      } else if (responseFromDeletePhotoOnPlatform.success === false) {
        const status = responseFromDeletePhotoOnPlatform.status
          ? responseFromDeletePhotoOnPlatform.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromDeletePhotoOnPlatform.message,
          errors: responseFromDeletePhotoOnPlatform.errors
            ? responseFromDeletePhotoOnPlatform.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  updatePhotoOnPlatform: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdatePhotoOnPlatform = await createPhotoUtil.updatePhotoOnPlatform(
        request
      );

      if (responseFromUpdatePhotoOnPlatform.success === true) {
        const status = responseFromUpdatePhotoOnPlatform.status
          ? responseFromUpdatePhotoOnPlatform.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdatePhotoOnPlatform.message,
          updated_photo: responseFromUpdatePhotoOnPlatform.data,
        });
      } else if (responseFromUpdatePhotoOnPlatform.success === false) {
        const status = responseFromUpdatePhotoOnPlatform.status
          ? responseFromUpdatePhotoOnPlatform.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdatePhotoOnPlatform.message,
          errors: responseFromUpdatePhotoOnPlatform.errors
            ? responseFromUpdatePhotoOnPlatform.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  /*********** cloudinary *************************/
  deletePhotoOnCloudinary: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromDeletePhotoOnCloudinary = await createPhotoUtil.deletePhotoOnCloudinary(
        request
      );

      if (responseFromDeletePhotoOnCloudinary.success === true) {
        const status = responseFromDeletePhotoOnCloudinary.status
          ? responseFromDeletePhotoOnCloudinary.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeletePhotoOnCloudinary.message,
          deletion_details: responseFromDeletePhotoOnCloudinary.data,
        });
      } else if (responseFromDeletePhotoOnCloudinary.success === false) {
        const status = responseFromDeletePhotoOnCloudinary.status
          ? responseFromDeletePhotoOnCloudinary.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromDeletePhotoOnCloudinary.message,
          errors: responseFromDeletePhotoOnCloudinary.errors
            ? responseFromDeletePhotoOnCloudinary.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  updatePhotoOnCloudinary: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "coming soon...",
      });
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdatePhotoOnCloudinary = await createPhotoUtil.updatePhotoOnCloudinary(
        request
      );

      if (responseFromUpdatePhotoOnCloudinary.success === true) {
        const status = responseFromUpdatePhotoOnCloudinary.status
          ? responseFromUpdatePhotoOnCloudinary.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdatePhotoOnCloudinary.message,
          created_photo: responseFromUpdatePhotoOnCloudinary.data,
        });
      } else if (responseFromUpdatePhotoOnCloudinary.success === false) {
        const status = responseFromUpdatePhotoOnCloudinary.status
          ? responseFromUpdatePhotoOnCloudinary.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdatePhotoOnCloudinary.message,
          errors: responseFromUpdatePhotoOnCloudinary.errors
            ? responseFromUpdatePhotoOnCloudinary.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  createPhotoOnCloudinary: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "coming soon...",
      });
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreatePhotoOnCloudinary = await createPhotoUtil.createPhotoOnCloudinary(
        request
      );

      if (responseFromCreatePhotoOnCloudinary.success === true) {
        const status = responseFromCreatePhotoOnCloudinary.status
          ? responseFromCreatePhotoOnCloudinary.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreatePhotoOnCloudinary.message,
          created_photo: responseFromCreatePhotoOnCloudinary.data,
        });
      } else if (responseFromCreatePhotoOnCloudinary.success === false) {
        const status = responseFromCreatePhotoOnCloudinary.status
          ? responseFromCreatePhotoOnCloudinary.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreatePhotoOnCloudinary.message,
          errors: responseFromCreatePhotoOnCloudinary.errors
            ? responseFromCreatePhotoOnCloudinary.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = processImage;
