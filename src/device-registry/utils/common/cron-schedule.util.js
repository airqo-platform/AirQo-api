const cronParser = require("cron-parser");

/**
 * Adjusts a cron schedule by a minute offset based on the environment.
 * Handles minute and hour rollovers.
 *
 * @param {string} baseSchedule - The base cron expression string (e.g., "30 * * * *").
 * @param {string} environment - The deployment environment (e.g., "STAGING ENVIRONMENT").
 * @returns {string} The adjusted cron expression string.
 */
const getSchedule = (baseSchedule, environment) => {
  // Validate the cron expression format
  try {
    cronParser.parseExpression(baseSchedule);
  } catch (err) {
    // Log the error and return the original schedule to prevent crashes.
    console.error(
      `Invalid cron expression passed to getSchedule: "${baseSchedule}"`
    );
    return baseSchedule;
  }

  // Centralized offsets for each environment.
  // PRODUCTION has an offset of 0, making it the default.
  const OFFSETS = {
    "STAGING ENVIRONMENT": 5,
    "DEVELOPMENT ENVIRONMENT": 10,
  };
  const offset = OFFSETS[environment] || 0; // Default to 0 for PRODUCTION or any other env

  // If there's no offset, return the original schedule immediately.
  if (offset === 0) {
    return baseSchedule;
  }

  const [minute, hour, ...rest] = baseSchedule.split(" ");

  const totalMinutes = parseInt(minute, 10) + offset;
  const newMinute = totalMinutes % 60;
  const hourIncrement = Math.floor(totalMinutes / 60);

  let newHour = hour;
  // Only increment the hour if it's a specific number and not a wildcard '*'
  if (hourIncrement > 0 && hour !== "*" && !isNaN(parseInt(hour, 10))) {
    const currentHour = parseInt(hour, 10);
    newHour = (currentHour + hourIncrement) % 24;
  }

  return `${newMinute} ${newHour} ${rest.join(" ")}`;
};

module.exports = { getSchedule };
