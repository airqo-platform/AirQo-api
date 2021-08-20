const uploadImages = require("../utils/upload-images");
const fs = require("fs");
const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("../utils/log");
const { deleteFromCloudinary } = require("../utils/delete-cloudinary-image");
const { tryCatchErrors, missingQueryParams } = require("../utils/errors");
const createPhotoUtil = require("../utils/create-photo");

const processImage = {
  /****************** system wide actions *********************************** */
  create: async (req, res) => {
    let { body, query } = req;
    let request = {};
    request["body"] = body;
    request["query"] = query;
    let responseFromCreatePhotoUtil = await createPhotoUtil.create(request);
    if (responseFromCreatePhotoUtil.success === true) {
      let status = responseFromCreatePhotoUtil.status
        ? responseFromCreatePhotoUtil.status
        : HTTPStatus.OK;

      return res.status(status).json({
        success: true,
        message: responseFromCreatePhotoUtil.message,
      });
    }

    if (responseFromCreatePhotoUtil.success === false) {
      let status = responseFromCreatePhotoUtil.status
        ? responseFromCreatePhotoUtil.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;

      let errors = responseFromCreatePhotoUtil.errors
        ? responseFromCreatePhotoUtil.errors
        : "";

      return res.status(status).json({
        success: false,
        message: responseFromCreatePhotoUtil.message,
        errors,
      });
    }
  },
  update: async (req, res) => {
    let { body, query } = req;
    let request = {};
    request["body"] = body;
    request["query"] = query;
    let responseFromUpdatePhotoUtil = await createPhotoUtil.update(request);
    if (responseFromUpdatePhotoUtil.success === true) {
      let status = responseFromUpdatePhotoUtil.status
        ? responseFromUpdatePhotoUtil.status
        : HTTPStatus.OK;

      return res.status(status).json({
        success: true,
        message: responseFromUpdatePhotoUtil.message,
      });
    }

    if (responseFromUpdatePhotoUtil.success === false) {
      let status = responseFromUpdatePhotoUtil.status
        ? responseFromUpdatePhotoUtil.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;

      let errors = responseFromUpdatePhotoUtil.errors
        ? responseFromUpdatePhotoUtil.errors
        : "";

      return res.status(status).json({
        success: false,
        message: responseFromUpdatePhotoUtil.message,
        errors,
      });
    }
  },
  delete: async (req, res) => {
    let { body, query } = req;
    let request = {};
    request["body"] = body;
    request["query"] = query;
    let responseFromDeletePhotoUtil = await createPhotoUtil.delete(request);
    if (responseFromDeletePhotoUtil.success === true) {
      let status = responseFromDeletePhotoUtil.status
        ? responseFromDeletePhotoUtil.status
        : HTTPStatus.OK;

      return res.status(status).json({
        success: true,
        message: responseFromDeletePhotoUtil.message,
      });
    }

    if (responseFromDeletePhotoUtil.success === false) {
      let status = responseFromDeletePhotoUtil.status
        ? responseFromDeletePhotoUtil.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;

      let errors = responseFromDeletePhotoUtil.errors
        ? responseFromDeletePhotoUtil.errors
        : "";

      return res.status(status).json({
        success: false,
        message: responseFromDeletePhotoUtil.message,
        errors,
      });
    }
  },
  list: async (req, res) => {
    let { body, query } = req;
    let request = {};
    request["body"] = body;
    request["query"] = query;
    let responseFromListPhotoUtil = await createPhotoUtil.list(request);
    if (responseFromListPhotoUtil.success === true) {
      let status = responseFromListPhotoUtil.status
        ? responseFromListPhotoUtil.status
        : HTTPStatus.OK;

      return res.status(status).json({
        success: true,
        message: responseFromListPhotoUtil.message,
      });
    }

    if (responseFromListPhotoUtil.success === false) {
      let status = responseFromListPhotoUtil.status
        ? responseFromListPhotoUtil.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;

      let errors = responseFromListPhotoUtil.errors
        ? responseFromListPhotoUtil.errors
        : "";

      return res.status(status).json({
        success: false,
        message: responseFromListPhotoUtil.message,
        errors,
      });
    }
  },
  /*************** platform only actions ******************************/
  createPhotoOnPlatform: async (req, res) => {
    let { body, query } = req;
    let request = {};
    request["body"] = body;
    request["query"] = query;
    let responseFromCreatePhotoOnPlatformUtil = await createPhotoUtil.createPhotoOnPlatform(
      request
    );
    if (responseFromCreatePhotoOnPlatformUtil.success === true) {
      let status = responseFromCreatePhotoOnPlatformUtil.status
        ? responseFromCreatePhotoOnPlatformUtil.status
        : HTTPStatus.OK;

      return res.status(status).json({
        success: true,
        message: responseFromCreatePhotoOnPlatformUtil.message,
      });
    }

    if (responseFromCreatePhotoOnPlatformUtil.success === false) {
      let status = responseFromCreatePhotoOnPlatformUtil.status
        ? responseFromCreatePhotoOnPlatformUtil.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;

      let errors = responseFromCreatePhotoOnPlatformUtil.errors
        ? responseFromCreatePhotoOnPlatformUtil.errors
        : "";

      return res.status(status).json({
        success: false,
        message: responseFromCreatePhotoOnPlatformUtil.message,
        errors,
      });
    }
  },
  deletePhotoOnPlatform: async (req, res) => {
    let { body, query } = req;
    let request = {};
    request["body"] = body;
    request["query"] = query;
    let responseFromDeletePhotoOnPlatformUtil = await createPhotoUtil.deletePhotoOnPlatform(
      request
    );
    if (responseFromDeletePhotoOnPlatformUtil.success === true) {
      let status = responseFromDeletePhotoOnPlatformUtil.status
        ? responseFromDeletePhotoOnPlatformUtil.status
        : HTTPStatus.OK;

      return res.status(status).json({
        success: true,
        message: responseFromDeletePhotoOnPlatformUtil.message,
      });
    }

    if (responseFromDeletePhotoOnPlatformUtil.success === false) {
      let status = responseFromDeletePhotoOnPlatformUtil.status
        ? responseFromDeletePhotoOnPlatformUtil.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;

      let errors = responseFromDeletePhotoOnPlatformUtil.errors
        ? responseFromDeletePhotoOnPlatformUtil.errors
        : "";

      return res.status(status).json({
        success: false,
        message: responseFromDeletePhotoOnPlatformUtil.message,
        errors,
      });
    }
  },
  updatePhotoOnPlatform: async (req, res) => {
    let { body, query } = req;
    let request = {};
    request["body"] = body;
    request["query"] = query;
    let responseFromUpdatePhotoOnPlatformUtil = await createPhotoUtil.updatePhotoOnPlatform(
      request
    );
    if (responseFromUpdatePhotoOnPlatformUtil.success === true) {
      let status = responseFromUpdatePhotoOnPlatformUtil.status
        ? responseFromUpdatePhotoOnPlatformUtil.status
        : HTTPStatus.OK;

      return res.status(status).json({
        success: true,
        message: responseFromUpdatePhotoOnPlatformUtil.message,
      });
    }

    if (responseFromUpdatePhotoOnPlatformUtil.success === false) {
      let status = responseFromUpdatePhotoOnPlatformUtil.status
        ? responseFromUpdatePhotoOnPlatformUtil.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;

      let errors = responseFromUpdatePhotoOnPlatformUtil.errors
        ? responseFromUpdatePhotoOnPlatformUtil.errors
        : "";

      return res.status(status).json({
        success: false,
        message: responseFromUpdatePhotoOnPlatformUtil.message,
        errors,
      });
    }
  },

  /******************* cloudinary only actions ******************************/
  deletePhotoOnCloudinary: async (req, res) => {
    let { body, query } = req;
    let request = {};
    request["body"] = body;
    request["query"] = query;
    let responseFromDeletePhotoOnCloudinaryUtil = await createPhotoUtil.deletePhotoOnCloudinary(
      request
    );
    if (responseFromDeletePhotoOnCloudinaryUtil.success === true) {
      let status = responseFromDeletePhotoOnCloudinaryUtil.status
        ? responseFromDeletePhotoOnCloudinaryUtil.status
        : HTTPStatus.OK;

      return res.status(status).json({
        success: true,
        message: responseFromDeletePhotoOnCloudinaryUtil.message,
      });
    }

    if (responseFromDeletePhotoOnCloudinaryUtil.success === false) {
      let status = responseFromDeletePhotoOnCloudinaryUtil.status
        ? responseFromDeletePhotoOnCloudinaryUtil.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;

      let errors = responseFromDeletePhotoOnCloudinaryUtil.errors
        ? responseFromDeletePhotoOnCloudinaryUtil.errors
        : "";

      return res.status(status).json({
        success: false,
        message: responseFromDeletePhotoOnCloudinaryUtil.message,
        errors,
      });
    }
  },
  updatePhotoOnCloudinary: async (req, res) => {
    let { body, query } = req;
    let request = {};
    request["body"] = body;
    request["query"] = query;
    let responseFromUpdatePhotoOnCloudinaryUtil = await createPhotoUtil.updatePhotoOnCloudinary(
      request
    );
    if (responseFromUpdatePhotoOnCloudinaryUtil.success === true) {
      let status = responseFromUpdatePhotoOnCloudinaryUtil.status
        ? responseFromUpdatePhotoOnCloudinaryUtil.status
        : HTTPStatus.OK;

      return res.status(status).json({
        success: true,
        message: responseFromUpdatePhotoOnCloudinaryUtil.message,
      });
    }

    if (responseFromUpdatePhotoOnCloudinaryUtil.success === false) {
      let status = responseFromUpdatePhotoOnCloudinaryUtil.status
        ? responseFromUpdatePhotoOnCloudinaryUtil.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;

      let errors = responseFromUpdatePhotoOnCloudinaryUtil.errors
        ? responseFromUpdatePhotoOnCloudinaryUtil.errors
        : "";

      return res.status(status).json({
        success: false,
        message: responseFromUpdatePhotoOnCloudinaryUtil.message,
        errors,
      });
    }
  },
  createPhotoOnCloudinary: async (req, res) => {
    let { body, query } = req;
    let request = {};
    request["body"] = body;
    request["query"] = query;
    let responseFromCreatePhotoOnCloudinaryUtil = await createPhotoUtil.createPhotoOnCloudinary(
      request
    );
    if (responseFromCreatePhotoOnCloudinaryUtil.success === true) {
      let status = responseFromCreatePhotoOnCloudinaryUtil.status
        ? responseFromCreatePhotoOnCloudinaryUtil.status
        : HTTPStatus.OK;

      return res.status(status).json({
        success: true,
        message: responseFromCreatePhotoOnCloudinaryUtil.message,
      });
    }

    if (responseFromCreatePhotoOnCloudinaryUtil.success === false) {
      let status = responseFromCreatePhotoOnCloudinaryUtil.status
        ? responseFromCreatePhotoOnCloudinaryUtil.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;

      let errors = responseFromCreatePhotoOnCloudinaryUtil.errors
        ? responseFromCreatePhotoOnCloudinaryUtil.errors
        : "";

      return res.status(status).json({
        success: false,
        message: responseFromCreatePhotoOnCloudinaryUtil.message,
        errors,
      });
    }
  },

  /***************** other methods from cloudinary ****************************/
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
