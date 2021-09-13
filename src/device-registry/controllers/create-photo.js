const uploadImages = require("../utils/upload-images");
const fs = require("fs");
const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("../utils/log");
const { deleteFromCloudinary } = require("../utils/delete-cloudinary-image");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");
const getDetail = require("../utils/get-device-details");
const isEmpty = require("is-empty");
const {
  updateThingBodies,
  getChannelID,
} = require("../utils/does-device-exist");
const getLastPath = require("../utils/get-last-path");
const updateDeviceUtil = require("../utils/update-device");

const processImage = {
  create: async (req, res) => {},
  update: async (req, res) => {},
  delete: async (req, res) => {},
  list: async (req, res) => {},
  /***platform */
  createPhotoOnPlatform: async (req, res) => {},
  deletePhotoOnPlatform: async (req, res) => {},
  updatePhotoOnPlatform: async (req, res) => {},
  /***cloudinary */
  deletePhotoOnCloudinary: async (req, res) => {},
  updatePhotoOnCloudinary: async (req, res) => {},
  createPhotoOnCloudinary: async (req, res) => {},
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
