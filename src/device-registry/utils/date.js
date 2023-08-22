const { logText, logElement } = require("./log");
const log4js = require("log4js");
module.exports = {
  generateDateFormatWithoutHrs,
};
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- date-util`);

function generateDateFormat(ISODate) {
  try {
    let date = new Date(ISODate);
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getUTCDate();
    let hrs = date.getHours();

    if (day < 10) {
      day = "0" + day;
    }
    if (month < 10) {
      month = "0" + month;
    }
    return `${year}-${month}-${day}-${hrs}`;
  } catch (e) {
    logger.error(`internal server error -- ${e.message}`);
  }
}

function isTimeEmpty(dateTime) {
  let date = new Date(dateTime);
  let hrs = date.getUTCHours();
  let mins = date.getUTCMinutes();
  let secs = date.getUTCSeconds();
  let millisecs = date.getUTCMilliseconds();
  logElement("hrs", hrs);
  logElement("mins", mins);
  logElement("secs", secs);
  logElement("millisecs", millisecs);
  if (
    Number.isInteger(hrs) &&
    Number.isInteger(mins) &&
    Number.isInteger(secs) &&
    Number.isInteger(millisecs)
  ) {
    return false;
  }
  return true;
}

function formatDate(dateTime) {
  return new Date(dateTime).toISOString();
}

function generateDateFormatWithoutHrs(ISODate) {
  try {
    let date = new Date(ISODate);
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getUTCDate();

    if (day < 10) {
      day = "0" + day;
    }
    if (month < 10) {
      month = "0" + month;
    }
    return `${year}-${month}-${day}`;
  } catch (e) {
    logger.error(`internal server error -- ${e.message}`);
  }
}

function addMonthsToProvidedDate(date, number) {
  try {
    logElement("the day I am receiving", date);
    let year = date.split("-")[0];
    let month = date.split("-")[1];
    let day = date.split("-")[2];
    let newMonth = parseInt(month, 10) + number;
    let modifiedMonth = "0" + newMonth;
    return `${year}-${modifiedMonth}-${day}`;
  } catch (e) {
    logger.error(`internal server error -- ${e.message}`);
  }
}

function addMonthsToProvideDateTime(dateTime, number) {
  try {
    if (isTimeEmpty(dateTime) == false) {
      logText("the time is not empty....");
      let newDate = new Date(dateTime);
      let monthsInfrontOfProvidedDateTime = newDate.setMonth(
        newDate.getMonth() + number
      );
      logElement(
        " monthsInfrontOfProvidedDateTime",
        monthsInfrontOfProvidedDateTime
      );
      let modifiedDate = new Date(monthsInfrontOfProvidedDateTime);
      logElement("modifiedDate", modifiedDate);
      return new Date(monthsInfrontOfProvidedDateTime);
    } else {
      logText("the time is empty now....");
      let newDate = addMonthsToProvidedDate(dateTime, number);
      logElement("the new date I am sending", newDate);
      return newDate;
    }
  } catch (e) {
    logger.error(`internal server error -- ${e.message}`);
  }
}

function monthsInfront(number) {
  try {
    let d = new Date();
    let targetMonth = d.getMonth() + number;
    d.setMonth(targetMonth);
    if (d.getMonth() !== targetMonth % 12) {
      d.setDate(0);
    }
    return d;
  } catch (e) {
    logger.error(`internal server error -- ${e.message}`);
  }
}

function addDays(number) {
  try {
    let d = new Date();
    d.setDate(d.getDate() + number);
    return d;
  } catch (e) {
    logger.error(`internal server error -- ${e.message}`);
  }
}

function addHours(number) {
  try {
    const currentTime = new Date();
    const newTime = new Date(currentTime.getTime() + number * 60 * 60 * 1000);
    return newTime;
  } catch (e) {
    logger.error(`internal server error -- ${e.message}`);
  }
}

function addMinutes(number) {
  try {
    let d = new Date();
    d.setMinutes(d.getMinutes() + number);
    return d;
  } catch (e) {
    logger.error(`internal server error -- ${e.message}`);
  }
}

function getDifferenceInMonths(d1, d2) {
  let months;
  let start = new Date(d1);
  let end = new Date(d2);
  months = (end.getFullYear() - start.getFullYear()) * 12;
  months -= start.getMonth();
  months += end.getMonth();
  return months <= 0 ? 0 : months;
}

function threeMonthsFromNow(date) {
  d = new Date(date);
  let targetMonth = d.getMonth() + 3;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

module.exports = {
  generateDateFormat,
  threeMonthsFromNow,
  generateDateFormatWithoutHrs,
  addMonthsToProvideDateTime,
  monthsInfront,
  isTimeEmpty,
  getDifferenceInMonths,
  addDays,
  addMinutes,
  formatDate,
  addHours,
};
