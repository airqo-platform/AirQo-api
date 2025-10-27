const cronParser = require("cron-parser");

/**
 * Adjusts a cron schedule by a minute offset based on the environment.
 * Handles minute and hour rollovers for simple numeric hour values.
 *
 * @param {string} baseSchedule - The base cron expression string (e.g., "30 * * * *").
 * @param {string} environment - The deployment environment (e.g., "STAGING ENVIRONMENT").
 * @returns {string} The adjusted cron expression string, or the original if adjustment is not possible.
 */
const getSchedule = (baseSchedule, environment) => {
  try {
    // Validate the cron expression format
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

  const parts = baseSchedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    console.warn(
      `getSchedule expects a 5-field cron expression (minute, hour, day of month, month, day of week). Received ${parts.length} fields: "${baseSchedule}". Using original schedule.`
    );
    return baseSchedule;
  }
  const [minute, hour, ...rest] = parts;

  // Handle non-numeric minute values gracefully (e.g., '*', '*/15').
  const parsedMinute = parseInt(minute, 10);
  if (isNaN(parsedMinute)) {
    console.warn(
      `getSchedule cannot apply offset to non-numeric minute value: "${minute}". Using original schedule.`
    );
    return baseSchedule;
  }

  const totalMinutes = parsedMinute + offset;
  const newMinute = totalMinutes % 60;
  const hourIncrement = Math.floor(totalMinutes / 60);

  let newHour = hour;
  if (hourIncrement > 0) {
    const hourNum = Number(hour);
    if (hour === "*") {
      // Wildcard is OK; no explicit increment needed as it runs every hour.
    } else if (Number.isInteger(hourNum)) {
      newHour = (hourNum + hourIncrement) % 24;
    } else {
      // It's a pattern like "*/2" or "1,3,5". It's not safe to adjust,
      // so we return the original schedule to avoid breaking the job.
      console.warn(
        `getSchedule cannot apply hour rollover to patterned hour value: "${hour}". Using original schedule.`
      );
      return baseSchedule;
    }
  }

  return `${newMinute} ${newHour} ${rest.join(" ")}`;
};

module.exports = { getSchedule };
