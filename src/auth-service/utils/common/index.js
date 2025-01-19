const mailer = require("./mailer");
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
} = require("./date");
const msgs = require("./email.msgs");
const emailTemplates = require("./email.templates");
const generateFilter = require("./generate-filter");
const winstonLogger = require("./log-winston");
const responseHandler = require("./responseHandler");

module.exports = {
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
  responseHandler,
};
