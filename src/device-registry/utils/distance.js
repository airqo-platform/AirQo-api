const { logObject, logElement, logText } = require("./log");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- distance-util`);

const distance = {
  findNearestDevices: (devices, radius, latitude, longitude) => {
    try {
      let nearest_devices = [];

      devices.forEach((device) => {
        if (
          "latitude" in device &&
          "longitude" in device &&
          device["isActive"] == true &&
          device["isPrimaryInLocation"] == true
        ) {
          distanceBetweenDevices = distance.calculateDistance(
            latitude,
            longitude,
            device["latitude"],
            device["longitude"]
          );

          if (distanceBetweenDevices < radius) {
            device["distance"] = distance;
            nearest_devices.push(device);
          }
        }
      });

      return nearest_devices;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
    }
  },

  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters
    return distance;
  },

  filterSitesByRadius({ sites, lat, lon, radius } = {}) {
    // logObject("sites we are using", sites);
    const filteredSites = sites.filter((site) => {
      // logObject("site.latitude", site.latitude);
      // logObject("lat", lat);
      // logObject("site.longitude", site.longitude);
      // logObject("lon", lon);
      const distanceBetween = distance.getDistance(
        lat,
        lon,
        site.latitude,
        site.longitude
      );
      return distanceBetween <= radius;
    });
    return filteredSites;
  },

  calculateDistance: (latitude1, longitude1, latitude2, longitude2) => {
    // getting distance between latitudes and longitudes
    const latitudeDisatnce = distance.degreesToRadians(latitude2 - latitude1);
    const longitudeDisatnce = distance.degreesToRadians(
      longitude2 - longitude1
    );

    // converting degrees to radians
    latitude1 = distance.degreesToRadians(latitude1);
    latitude2 = distance.degreesToRadians(latitude2);

    // Applying Haversine formula
    const haversine =
      Math.pow(Math.sin(latitudeDisatnce / 2), 2) +
      Math.pow(Math.sin(longitudeDisatnce / 2), 2) *
        Math.cos(latitude1) *
        Math.cos(latitude2);

    // Earth's radius in kilometers
    const radius = 6371;

    const c = 2 * Math.asin(Math.sqrt(haversine));
    return radius * c;
  },

  distanceBtnTwoPoints: (latitude1, longitude1, latitude2, longitude2) => {
    try {
      // getting distance between latitudes and longitudes
      const latitudeDisatnce = distance.degreesToRadians(latitude2 - latitude1);
      const longitudeDisatnce = distance.degreesToRadians(
        longitude2 - longitude1
      );

      // converting degrees to radians
      latitude1 = distance.degreesToRadians(latitude1);
      latitude2 = distance.degreesToRadians(latitude2);

      // Applying Haversine formula
      const haversine =
        Math.pow(Math.sin(latitudeDisatnce / 2), 2) +
        Math.pow(Math.sin(longitudeDisatnce / 2), 2) *
          Math.cos(latitude1) *
          Math.cos(latitude2);

      // Earth's radius in kilometers
      const radius = 6371;

      const c = 2 * Math.asin(Math.sqrt(haversine));
      return radius * c;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
    }
  },
  degreesToRadians: (degrees) => {
    try {
      const pi = Math.PI;
      return degrees * (pi / 180);
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
    }
  },

  radiansToDegrees: (radians) => {
    try {
      {
        const pi = Math.PI;
        return radians * (180 / pi);
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
    }
  },

  generateRandomNumbers: ({ min = 0, max = 6.28319, places = 3 } = {}) => {
    if (Number.isInteger(min) && Number.isInteger(max)) {
      if (places !== undefined) {
        new Error("Cannot specify decimal places with integers.");
      }
      return Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      if (Number.isNaN(Number.parseFloat(min))) {
        new Error("Minimum value is not a number.");
      }

      if (Number.isNaN(Number.parseFloat(max))) {
        new Error("Maximum value is not a number.");
      }

      if (Number.isInteger(places) === false) {
        new Error("Number of decimal places is not a number.");
      }

      if (places <= 0) {
        new Error("Number of decimal places must be at least 1.");
      }
      let value = Math.random() * (max - min + 1) + min;
      return Number.parseFloat(value).toFixed(places);
    }
  },

  createApproximateCoordinates: ({
    latitude = 0,
    longitude = 0,
    approximate_distance_in_km = 0.5,
  } = {}) => {
    try {
      const radiusOfEarth = 6378.1;
      const bearingInRadians = distance.generateRandomNumbers();
      const latitudeInRadians = distance.degreesToRadians(latitude);
      const longitudeInRadians = distance.degreesToRadians(longitude);

      let approximateLatitudeInRadians = Math.asin(
        Math.sin(latitudeInRadians) *
        Math.cos(approximate_distance_in_km / radiusOfEarth) +
        Math.cos(latitudeInRadians) *
        Math.sin(approximate_distance_in_km / radiusOfEarth) *
        Math.cos(bearingInRadians)
      );

      let approximateLongitudeInRadians =
        longitudeInRadians +
        Math.atan2(
          Math.sin(bearingInRadians) *
          Math.sin(approximate_distance_in_km / radiusOfEarth) *
          Math.cos(latitudeInRadians),
          Math.cos(approximate_distance_in_km / radiusOfEarth) -
          Math.sin(latitudeInRadians) * Math.sin(approximateLatitudeInRadians)
        );

      return {
        approximate_latitude: distance.radiansToDegrees(
          approximateLatitudeInRadians
        ),
        approximate_longitude: distance.radiansToDegrees(
          approximateLongitudeInRadians
        ),
        approximate_distance_in_km,
        bearing_in_radians: parseFloat(bearingInRadians),
        provided_latitude: parseFloat(latitude),
        provided_longitude: parseFloat(longitude),
      };
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: "Error in createApproximateCoordinates",
        },
      };
    }
  },
};

module.exports = distance;
