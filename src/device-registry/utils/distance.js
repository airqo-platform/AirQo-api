const { logObject, logElement, logText } = require("./log");
const distanceBtnTwoPoints = (latitude1, longitude1, latitude2, longitude2) => {
  try {
    // getting distance between latitudes and longitudes
    const latitudeDisatnce = degreesToRadians(latitude2 - latitude1);
    const longitudeDisatnce = degreesToRadians(longitude2 - longitude1);

    // converting degrees to radians
    latitude1 = degreesToRadians(latitude1);
    latitude2 = degreesToRadians(latitude2);

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
    logElement(
      "the error for distanceBtnTwoPoints in the distance util",
      error.message
    );
  }
};

const degreesToRadians = (degrees) => {
  try {
    const pi = Math.PI;
    return degrees * (pi / 180);
  } catch (error) {
    logElement(
      "the error for degreesToRadians in the distance util",
      error.message
    );
  }
};

module.exports = {
  distanceBtnTwoPoints,
};
