const { upload, uploads } = require("../utils/create-photo");
const fs = require("fs");
const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("../utils/log");
const { tryCatchErrors, missingQueryParams } = require("../utils/errors");
const { deleteFromCloudinary } = require("../utils/delete-photo");
const getLastPath = require("../utils/get-last-path");
const { getDetailsOnPlatform } = require("../utils/get-device-details");
const { createDeviceRequestBodies } = require("../utils/create-request-body");
const {
  updateDevice,
  updateOnThingSpeak,
  updateOnPlatform,
  updateOnClarity,
  updateOnGCP,
  transformDeviceName,
} = require("../utils/update-device");

const processImage = {
  create: (req, res) => {},
  update: (req, res) => {},
  uploadMany: async (req, res) => {
    try {
      const { tenant } = req.query;

      if (tenant) {
        const uploader = async (path) => {
          await uploads.uploads(path, "Images");
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

  delete: async (req, res) => {
    try {
      const { device, tenant } = req.query;
      const { photos } = req.body;
      if (tenant && device && photos) {
        const deviceDetails = await getDetailsOnPlatform(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent?", doesDeviceExist);
        if (doesDeviceExist) {
          let { tsBody, deviceBody, options } = createDeviceRequestBodies(
            req,
            res
          );
          const channelID = deviceDetails[0].channelID;
          logElement("the channel ID", channelID);
          const deviceFilter = { _id: device };
          let photoNameWithoutExtension = [];
          photos.forEach((photo) => {
            if (photo) {
              photoNameWithoutExtension.push(getLastPath(photo));
            }
          });
          let responseFromDeleteOnCloudinary = await deleteFromCloudinary(
            photoNameWithoutExtension
          );

          let responseFromUpdateDevice = await updateDevice(
            channelID,
            deviceBody,
            tsBody,
            deviceFilter,
            tenant,
            options
          );

          if (responseFromDeleteOnCloudinary.success === true) {
            if (responseFromUpdateDevice.success === true) {
              return res.status(HTTPStatus.OK).json({
                message: responseFromUpdateDevice.message,
                updatedDevice: responseFromUpdateDevice.updatedDevice,
                success: true,
              });
            } else if (responseFromUpdateDevice.success === false) {
              if (responseFromUpdateDevice.error) {
                return res.status(HTTPStatus.BAD_GATEWAY).json({
                  message: responseFromUpdateDevice.message,
                  success: false,
                  error: error,
                });
              } else {
                return res.status(HTTPStatus.BAD_GATEWAY).json({
                  message: responseFromUpdateDevice.message,
                  success: false,
                });
              }
            }
          } else if ((responseFromDeleteOnCloudinary.success = false)) {
            if (responseFromDeleteOnCloudinary.error) {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: responseFromDeleteOnCloudinary.message,
                success: false,
                error: error,
              });
            } else {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: responseFromDeleteOnCloudinary.message,
                success: false,
              });
            }
          }
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
