const Device = require("../models/Device");
const Maintenance = require("../models/maintenance_log");
const LocationActivity = require("../models/location_activity");
const Location = require("../models/Location");
const HTTPStatus = require("http-status");
const iot = require("@google-cloud/iot");
const client = new iot.v1.DeviceManagerClient();
const device_registry =
  "projects/airqo-250220/locations/europe-west1/registries/device-registry";
const uuidv1 = require("uuid/v1");
const mqtt = require("mqtt");
const projectId = "airqo-250220";
const region = `europe-west1`;
const registryId = `device-registry`;
const algorithm = `RS256`;
// const privateKeyFile = `./rsa_private.pem`;
const mqttBridgeHostname = `mqtt.googleapis.com`;
const mqttBridgePort = 8883;
const messageType = `events`;
const numMessages = 5;
const fetch = require("node-fetch");
const request = require("request");
const axios = require("axios");
const constants = require("../config/constants");

const device = {
  listAll: async (req, res) => {
    const limit = parseInt(req.query.limit, 0);
    const skip = parseInt(req.query.skip, 0);

    try {
      const devices = await Device.list({ limit, skip });
      return res.status(HTTPStatus.OK).json(devices);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  listAllGcp: (req, res) => {
    const formattedParent = client.registryPath(
      "airqo-250220",
      "europe-west1",
      "device-registry"
    );
    const options = { autoPaginate: false };
    const callback = (responses) => {
      // The actual resources in a response.
      const resources = responses[0];
      // The next request if the response shows that there are more responses.
      const nextRequest = responses[1];
      // The actual response object, if necessary.
      // var rawResponse = responses[2];
      for (let i = 0; i < resources.length; i += 1) {
        // doThingsWith(resources[i]);
      }
      if (nextRequest) {
        // Fetch the next page.
        return client.listDevices(nextRequest, options).then(callback);
      }
      let response = responses[0];
      return res.status(HTTPStatus.OK).json(response);
    };
    client
      .listDevices({ parent: formattedParent }, options)
      .then(callback)
      .catch((err) => {
        console.error(err);
      });
  },

  createOne: async (req, res) => {
    try {
      console.log("creating one device....");
      const device = await Device.createDevice(req.body);
      return res.status(HTTPStatus.CREATED).json(device);
    } catch (e) {
      return res.status(400).json(e);
    }
  },

  createOneGcp: (req, res) => {
    const formattedParent = client.registryPath(
      "airqo-250220",
      "europe-west1",
      "device-registry"
    );
    const device = {
      id: req.body.id,
      metadata: req.body.metadata,
    };
    const request = {
      parent: formattedParent,
      device: device,
    };
    client
      .createDevice(request)
      .then((responses) => {
        const response = responses[0];
        return res.status(HTTPStatus.OK).json(response);
      })
      .catch((err) => {
        console.error(err);
        return res.status(HTTPStatus.BAD_REQUEST).json(err);
      });
    //connect the device to Cloud IoT core using MQTT bridge
  },

  /********************************* create Thing ****************************** */
  createThing: async (req, res) => {
    const baseUrl = `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`;
    let bodyPrep = {
      ...req.body,
      ...constants.DEVICE_CREATION,
    };
    try {
      console.log("creating one device....");
      const device = await Device.createDevice(req.body);
      await axios
        .post(baseUrl, bodyPrep)
        .then((response) => {
          console.log("the response...");
          console.dir(response.data);
          let output = response.data;
          return res.status(HTTPStatus.CREATED).json({
            success: true,
            message: "successfully created the device",
            device,
          });
        })
        .catch((e) => {
          let errors = e.message;
          res.status(400).json({
            success: false,
            message:
              "unable to create the device, please crosscheck the validity of all your input values",
            errors,
          });
        });
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "unable to save the device",
        error: e,
      });
    }
  },

  deployDevice: async (req, res) => {
    try {
      const {
        deviceName,
        locationName,
        height,
        mountType,
        powerType,
        date,
        latitude,
        longitude,
        isPrimaryInLocation,
        isUserForCollocaton,
      } = req.body;

      const deviceBody = {
        name: deviceName,
        locationID: locationName,
        height: height,
        mountType: mountType,
        powerType: powerType,
        latitude: latitude,
        longitude: longitude,
        isPrimaryInLocation: isPrimaryInLocation,
        isUserForCollocaton: isUserForCollocaton,
      };

      const locationActivityBody = {
        location: locationName,
        device: deviceName,
        date: date,
        description: "device deployed",
        activityType: "deployment",
      };

      console.log("adding location activity...");
      const newLocationActivity = await LocationActivity.createLocationActivity(
        locationActivityBody
      );
      console.log("updating device...");
      const deviceFilter = { name: deviceName };
      await Device.findOneAndUpdate(
        deviceFilter,
        deviceBody,
        {
          new: true,
        },
        (error, deployedDevice) => {
          if (error) {
            return res
              .status(HTTPStatus.BAD_GATEWAY)
              .json({ message: "unable to deploy device", error });
          } else if (deployedDevice) {
            return res.status(HTTPStatus.OK).json({
              message: "device successfully deployed",
              deployedDevice,
            });
          } else {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              message:
                "device does not exist, please first create the device you are trying to deploy ",
            });
          }
        }
      );
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({ error: e });
    }
  },

  fetchDeployments: async (req, res) => {
    const limit = parseInt(req.query.limit, 0);
    const skip = parseInt(req.query.skip, 0);

    try {
      const locationActivities = await LocationActivity.list({ limit, skip });
      return res.status(HTTPStatus.OK).json(locationActivities);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  /********************************* delete Thing ****************************** */
  deleteThing: async (req, res) => {
    const url = `https://api.thingspeak.com/channels/${req.query.device}.json?api_key=${process.env.TS_API_KEY}`;
    await axios
      .delete(url)
      .then(function(response) {
        console.log(response.data);
        let output = response.data;
        res.status(200).json({
          message: "successfully deleted the device",
          success: true,
          output,
        });
      })
      .catch(function(error) {
        console.log(error);
        res.status(500).json({
          message: "unable to delete the device, device does not exist",
          success: false,
        });
      });
  },

  /********************************* clear Thing ****************************** */

  clearThing: async (req, res) => {
    const url = `https://api.thingspeak.com/channels/${req.query.device}/feeds.json?api_key=${process.env.TS_API_KEY}`;
    await axios
      .delete(url)
      .then(function(response) {
        console.log(response.data);
        let output = response.data;
        res.status(200).json({
          message: "successfully cleared the device data",
          success: true,
          output,
        });
      })
      .catch(function(error) {
        console.log(error);
        res.status(500).json({
          message: "unable to clear the device data, device does not exist",
          success: false,
          //   error,
        });
      });
  },

  /********************************* Thing Settings ****************************** */
  updateThingSettings: async (req, res) => {
    const url = `https://api.thingspeak.com/channels/${req.query.device}.json?api_key=${process.env.TS_API_KEY}`;
    // {
    //     "name": "12345",
    //     "latitude": "27.2038",
    //     "longitude": "77.5011",
    //     "description": "yala",
    //     "public_flag": "true",
    //   }

    let bodyPrep = {
      ...req.body,
      name: req.body.name,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      description:
        `product_name: ${req.body.product_name}` +
        ", " +
        `device_manufacturer: ${req.body.device_manufacturer}`,
      public_flag: req.body.public_flag,
    };

    await axios
      .put(url, bodyPrep)
      .then(function(response) {
        console.log(response.data);
        let output = response.data;
        res.status(200).json({
          message: "successfully updated the device settings",
          success: true,
          output,
        });
      })
      .catch(function(error) {
        console.log(error);
        res.status(500).json({
          message:
            "unable to update the device settings, device does not exist on platform",
          success: false,
          // error,
        });
      });
  },

  /********************************* push data to Thing ****************************** */
  writeToThing: async (req, res) => {
    /****
     * get the device/channel ID
     * the n afterwards use that channel ID to get the write API key.
     * afterwards, make the write request accordigly
     *
     */
    getUrl = `https://api.thingspeak.com/channels/${channel}.json?api_key=${process.env.TS_API_KEY}`;
    await axios
      .get(getUrl)
      .then(function(response) {
        console.log(response.data);
        updateUrl = `https://api.thingspeak.com/update.json?api_key=${response.data.api_keys[0].api_key}`;

        /****
         * prepare the request object
         * "field1": "1PM2.5",
         * "field2": "1PM10",
         * field3: "2PM2.5",
         * field4: "2PM10",
         * field5: "Voltage",
         * field6: "Temp"
         * field7: ""
         * "lat": "Latitude"
         * "long":"Longitude",
         * "elevation":"Height",
         * "status": "maintenance"
         */
        axios
          .post(updateUrl, req.body)
          .then(function(response) {
            console.log(response.data);
            let output = response.data;
            res.status(200).json({
              message: "successfully written data to the device",
              success: true,
              output,
            });
          })
          .catch(function(error) {
            console.log(error);
            res.status(500).json({
              message: "unable to write data to the device",
              success: false,
              error,
            });
          });
      })
      .catch(function(error) {
        console.log(error);
        res.status(500).json({
          message:
            "unable to get channel details necessary for writing this data",
          success: false,
          error,
        });
      });
  },

  bulkWriteToThing: (req, res) => {},

  /**************************** end of using ThingSpeak **************************** */

  //getting the device by its ID:
  listOne: async (req, res) => {
    try {
      const device = await Device.findById(req.params.id);
      return res.status(HTTPStatus.OK).json(device);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  listOneGcp: (req, res) => {
    let device = req.params.name;
    const formattedName = client.devicePath(
      "airqo-250220",
      "europe-west1",
      "device-registry",
      `${device}`
    );
    client
      .getDevice({ name: formattedName })
      .then((responses) => {
        var response = responses[0];
        // doThingsWith(response)
        return res.status(HTTPStatus.OK).json(response);
      })
      .catch((err) => {
        console.error(err);
      });
  },

  delete: async (req, res) => {
    try {
      const device = await Device.findById(req.params.id);

      if (!device.user.equals(req.user._id)) {
        return res.sendStatus(HTTPStatus.UNAUTHORIZED);
      }

      await device.remove();
      return res.sendStatus(HTTPStatus.OK);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  deleteGcp: (req, res) => {
    let device = req.params.name;
    const formattedName = client.devicePath(
      "airqo-250220",
      "europe-west1",
      "device-registry",
      `${device}`
    );
    client
      .deleteDevice({ name: formattedName })
      .then((responses) => {
        let result = {
          status: "OK",
          message: `device ${device} has successfully been deleted`,
        };
        return res.status(HTTPStatus.OK).json(result);
      })
      .catch((err) => {
        console.error(err);
        return res.status(HTTPStatus.BAD_REQUEST).json(err);
      });
  },

  updateDevice: async (req, res) => {
    try {
      const device = await Device.findById(req.params.id);
      if (!device.user.equals(req.user._id)) {
        return res.sendStatus(HTTPStatus.UNAUTHORIZED);
      }

      Object.keys(req.body).forEach((key) => {
        device[key] = req.body[key];
      });

      return res.status(HTTPStatus.OK).json(await device.save());
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  updateDeviceGcp: (req, res) => {
    let device = req.params.name;
    const formattedName = client.devicePath(
      "airqo-250220",
      "europe-west1",
      "device-registry",
      `${device}`
    );

    var deviceUpdate = {
      name: req.params.name,
      blocked: req.body.blocked,
      metadata: req.body.metadata,
    };
    var updateMask = {
      blocked: device.blocked,
      metadata: device.metadata,
    };
    var request = {
      device: deviceUpdate,
      updateMask: updateMask,
    };
    client
      .updateDevice(request)
      .then((responses) => {
        var response = responses[0];
        return res.status(HTTPStatus.OK).json(response);
      })
      .catch((err) => {
        console.error(err);
        return res.status(HTTPStatus.BAD_REQUEST).json(err);
      });
  },
};

module.exports = device;
