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
const { publishKafkaEvent } = require("./kafka.util");
const slugUtils = require("./slug.util");
const { deduplicator } = require("./slack-dedup-utility");
const {
  getDefaultTheme,
  hasValidTheme,
  mergeWithDefaults,
} = require("./theme-defaults.util");

module.exports = {
  slugUtils,
  deduplicator,
  getDefaultTheme,
  hasValidTheme,
  mergeWithDefaults,
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
  publishKafkaEvent,
};
