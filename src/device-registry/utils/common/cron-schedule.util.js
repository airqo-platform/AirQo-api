const getSchedule = (baseSchedule, environment) => {
  // Centralized offsets for each environment.
  // PRODUCTION has an offset of 0, making it the default.
  const OFFSETS = {
    "STAGING ENVIRONMENT": 5,
    "DEVELOPMENT ENVIRONMENT": 10,
  };

  const [minute, ...rest] = baseSchedule.split(" ");
  const offset = OFFSETS[environment] || 0; // Default to 0 for PRODUCTION or any other env

  // If there's no offset, return the original schedule immediately.
  if (offset === 0) {
    return baseSchedule;
  }

  const newMinute = (parseInt(minute, 10) + offset) % 60;
  return `${newMinute} ${rest.join(" ")}`;
};

module.exports = { getSchedule };
