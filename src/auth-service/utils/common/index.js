const mailer = require("./mailer.util");
const stringify = require("./stringify.util");
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
} = require("./date.util");
const msgs = require("./email.msgs.util");
const emailTemplates = require("./email.templates.util");
const generateFilter = require("./generate-filter.util");
const winstonLogger = require("./log-winston.util");
const handleResponse = require("./response-handler.util");
const slugUtils = require("./slug.util");
const { deduplicator } = require("./slack-dedup-utility");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
  createTokenResponse,
} = require("./response-helpers");

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
  createTokenResponse,
  slugUtils,
  deduplicator,
  winstonLogger,
  mailer,
  stringify,
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
  msgs,
  emailTemplates,
  generateFilter,
  handleResponse,
};
