const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- distance-util`);
const { logObject, HttpError } = require("@utils/shared");

const distance = {
  findNearestDevices: ({ devices, radius, latitude, longitude } = {}, next) => {
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
            {
              latitude1: latitude,
              longitude1: longitude,
              latitude2: device["latitude"],
              longitude2: device["longitude"],
            },
            next
          );

          if (distanceBetweenDevices < radius) {
            device["distance"] = distance;
            nearest_devices.push(device);
          }
        }
      });

      return nearest_devices;
    } catch (error) {
      logger.error(`🐛🐛 Internal server error -- ${error.message}`);
    }
  },
  getDistance({ lat1, lon1, lat2, lon2 } = {}, next) {
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
  filterSitesByRadius({ sites, lat, lon, radius } = {}, next) {
    // logObject("sites we are using", sites);
    const filteredSites = sites.filter((site) => {
      // logObject("site.latitude", site.latitude);
      // logObject("lat", lat);
      // logObject("site.longitude", site.longitude);
      // logObject("lon", lon);
      const distanceBetween = distance.getDistance(
        {
          lat1: lat,
          lon1: lon,
          lat2: site.latitude,
          lon2: site.longitude,
        },
        next
      );
      return distanceBetween <= radius;
    });
    return filteredSites;
  },
  getDistanceSquared: ({ lat1, lon1, lat2, lon2 } = {}) => {
    const latDiff = lat2 - lat1;
    const lonDiff = lon2 - lon1;
    return latDiff * latDiff + lonDiff * lonDiff;
  },
  calculateDistance: (
    { latitude1, longitude1, latitude2, longitude2 } = {},
    next
  ) => {
    try {
      // getting distance between latitudes and longitudes
      const latitudeDistance = distance.degreesToRadians(latitude2 - latitude1);
      const longitudeDistance = distance.degreesToRadians(
        longitude2 - longitude1
      );

      // converting degrees to radians
      const lat1Rad = distance.degreesToRadians(latitude1);
      const lat2Rad = distance.degreesToRadians(latitude2);

      // Applying Haversine formula
      const haversine =
        Math.pow(Math.sin(latitudeDistance / 2), 2) +
        Math.pow(Math.sin(longitudeDistance / 2), 2) *
          Math.cos(lat1Rad) *
          Math.cos(lat2Rad);

      // Earth's radius in kilometers
      const radius = 6371;

      const c = 2 * Math.asin(Math.sqrt(haversine));
      return radius * c;
    } catch (error) {
      logger.error(
        `🐛🐛 Internal server error -- calculateDistance -- ${error.message}`
      );
      return Infinity;
    }
  },
  distanceBtnTwoPoints: (
    { latitude1, longitude1, latitude2, longitude2 } = {},
    next
  ) => {
    return distance.calculateDistance(
      { latitude1, longitude1, latitude2, longitude2 },
      next
    );
  },
  /**
   * Calculates the haversine distance between two points on Earth.
   * @param {{lat: number, lng: number}} coords1 - The first point's coordinates.
   * @param {{lat: number, lng: number}} coords2 - The second point's coordinates.
   * @returns {number} The distance in kilometers.
   */
  haversineDistance: (coords1, coords2) => {
    return distance.calculateDistance({
      latitude1: coords1.lat,
      longitude1: coords1.lng,
      latitude2: coords2.lat,
      longitude2: coords2.lng,
    });
  },
  degreesToRadians: (degrees) => {
    try {
      const pi = Math.PI;
      return degrees * (pi / 180);
    } catch (error) {
      logger.error(
        `🐛🐛 Internal server error -- degreesToRadians -- ${error.message}`
      );
      return NaN;
    }
  },
  radiansToDegrees: (radians) => {
    try {
      {
        const pi = Math.PI;
        return radians * (180 / pi);
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal server error -- ${error.message}`);
    }
  },
  generateRandomNumbers: (
    { min = 0, max = 6.28319, places = 3 } = {},
    next
  ) => {
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
  createApproximateCoordinates: (
    {
      latitude = 0,
      longitude = 0,
      approximate_distance_in_km = 0.5,
      bearing,
    } = {},
    next
  ) => {
    try {
      const radiusOfEarth = 6378.1;
      const bearingInRadians = bearing || distance.generateRandomNumbers();
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
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = distance;
