const stringify = require("./stringify");
const {
  generateDateFormat,
  threeMonthsFromNow,
  generateDateFormatWithoutHrs,
  addMonthsToProvideDateTime,
  addWeeksToProvideDateTime,
  addDaysToProvideDateTime,
  getDifferenceInWeeks,
  monthsInfront,
  isTimeEmpty,
  getDifferenceInMonths,
  addDays,
  addMinutes,
  formatDate,
  addHours,
  monthsFromNow,
  isDate,
} = require("./date");
const generateFilter = require("./generate-filter");
const handleResponse = require("./responseHandler");
const distance = require("./distance");
const translate = require("./translate");
const { getUptimeAccuracyUpdateObject } = require("./uptime.util");

const claimTokenUtil = require("./claimToken.util");
const { deduplicator } = require("./slack-dedup-utility");
const ActivityLogger = require("./activity-logger.util");
const throttleUtil = require("./throttle.util");
const LogThrottleManager = require("./log-throttle-manager.util");

const { getSchedule } = require("./cron-schedule.util");

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const computeTransmissionStatus = (device) => {
  const { isOnline, rawOnlineStatus, lastActive } = device;
  if (lastActive) {
    const date = new Date(lastActive);
    const now = Date.now();
    if (isNaN(date.getTime())) return "Invalid Date";
    if (date.getTime() > now + MAX_CLOCK_SKEW_MS) return "Invalid Date";
  }
  if (rawOnlineStatus === true && isOnline === true) return "Operational";
  if (rawOnlineStatus === true && isOnline === false) return "Transmitting";
  if (rawOnlineStatus === false && isOnline === true) return "Data Available";
  return "Not Transmitting";
};

module.exports = {
  getSchedule,
  LogThrottleManager,
  claimTokenUtil,
  throttleUtil,
  ActivityLogger,
  getUptimeAccuracyUpdateObject,
  deduplicator,
  translate,
  distance,
  stringify,
  generateDateFormat,
  threeMonthsFromNow,
  isDate,
  generateDateFormatWithoutHrs,
  addMonthsToProvideDateTime,
  addWeeksToProvideDateTime,
  addDaysToProvideDateTime,
  getDifferenceInWeeks,
  monthsInfront,
  isTimeEmpty,
  getDifferenceInMonths,
  addDays,
  addMinutes,
  formatDate,
  addHours,
  monthsFromNow,
  generateFilter,
  handleResponse,
  computeTransmissionStatus,
};
