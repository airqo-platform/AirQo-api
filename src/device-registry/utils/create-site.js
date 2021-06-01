const Validator = require("validator");
const isEmpty = require("is-empty");

const validateSiteName = (data) => {
  let errors = {};
  data.email = !isEmpty(data.email) ? data.email : "";
  if (Validator.isEmpty(data.email)) {
    errors.email = "Email field is required";
  } else if (!Validator.isEmail(data.email)) {
    errors.email = "Email is invalid";
  }
  return {
    errors,
    isValid: isEmpty(errors),
  };
};

const createSite = async (lat, long, name) => {};

const updateSite = async (generated_name, body) => {};

const deleteSite = async (generated_name) => {};

const getSite = async (generated_name) => {};

const formatSiteName = (data) => {};

const reverseGeoCode = (lat, long) => {};

const getDistance = (lat, long) => {};

const getLandform = (lat, long) => {};

const getAltitude = (lat, long) => {};

const getTrafficFactor = (lat, long) => {};

const getGreenness = (lat, long) => {};

const getTerrain = (lat, long) => {};

const getAspect = (lat, long) => {};

const getRoadIntesity = (lat, long) => {};

const getRoadStatus = (lat, long) => {};

const getLandUse = (lat, long) => {};

const generateLatLong = (lat, long) => {};

module.exports = {
  validateSiteName,
};
