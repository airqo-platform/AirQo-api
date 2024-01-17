const { logElement, logObject } = require("./log");
const log4js = require("log4js");
module.exports = {
  generateDateFormatWithoutHrs,
};
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- date-util`);
const { HttpError } = require("@utils/errors");

function generateDateFormat(ISODate, next) {
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
    logObject("date returned by function", `${year}-${month}-${day}-${hrs}`);
    return `${year}-${month}-${day}-${hrs}`;
  } catch (error) {
    logger.error(`internal server error -- ${error.message}`);
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

function generateDateFormatWithoutHrs(ISODate, next) {
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
    logObject("date returned by function", `${year}-${month}-${day}`);
    return `${year}-${month}-${day}`;
  } catch (error) {
    logger.error(`internal server error -- ${error.message}`);
  }
}

function addMonthsToProvidedDate(date, number, next) {
  try {
    const originalDate = new Date(date);
    const year = originalDate.getFullYear();
    const month = originalDate.getMonth();
    const day = originalDate.getDate();

    const newDate = new Date(year, month + number, day);

    const newYear = newDate.getFullYear();
    const newMonth = newDate.getMonth() + 1; // Adding 1 because getMonth() returns a zero-based index
    const newDay = newDate.getDate();

    // Ensure month and day are formatted with leading zeros if necessary
    const formattedMonth = newMonth < 10 ? `0${newMonth}` : newMonth;
    const formattedDay = newDay < 10 ? `0${newDay}` : newDay;
    logObject(
      "date returned by function",
      `${newYear}-${formattedMonth}-${formattedDay}`
    );
    return `${newYear}-${formattedMonth}-${formattedDay}`;
  } catch (error) {
    logger.error(`🐛🐛 Internal server error -- ${error.message}`);
  }
}

function addMonthsToProvideDateTime(dateTime, number, next) {
  try {
    if (isTimeEmpty(dateTime) === false) {
      const originalDate = new Date(dateTime);
      const year = originalDate.getFullYear();
      const month = originalDate.getMonth();
      const day = originalDate.getDate();

      const newDate = new Date(year, month + number, day);
      logObject(
        "date returned by function addMonthsToProvideDateTime() 1",
        newDate
      );
      return newDate;
    } else {
      const newDate = addMonthsToProvidedDate(dateTime, number);
      logObject(
        "date returned by function addMonthsToProvideDateTime() 2",
        newDate
      );
      return newDate;
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal server error -- ${error.message}`);
  }
}

function addWeeksToProvideDateTime(dateTime, number, next) {
  try {
    if (isTimeEmpty(dateTime) === false) {
      const originalDate = new Date(dateTime);
      const newDate = new Date(originalDate);
      newDate.setDate(originalDate.getDate() + number * 7); // Multiply by 7 to add weeks

      return newDate;
    } else {
      const newDate = addMonthsToProvidedDate(dateTime, number * 4); // Approximate 4 weeks per month
      return newDate;
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal server error -- ${error.message}`);
  }
}

function addDaysToProvideDateTime(dateTime, number, next) {
  try {
    if (isTimeEmpty(dateTime) === false) {
      const originalDate = new Date(dateTime);
      const newDate = new Date(originalDate);
      newDate.setDate(originalDate.getDate() + number);

      return newDate;
    } else {
      const newDate = addMonthsToProvidedDate(dateTime, number / 30); // Approximate 30 days per month
      return newDate;
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal server error -- ${error.message}`);
  }
}

function monthsInfront(number, next) {
  try {
    const d = new Date();
    const currentMonth = d.getMonth();
    const targetMonth = currentMonth + number;

    // Calculate the year and month separately to handle both integers and decimals
    const year = d.getFullYear() + Math.floor(targetMonth / 12);
    const month = targetMonth % 12;

    d.setFullYear(year);
    d.setMonth(month);

    if (d.getMonth() !== month) {
      // If the month is not what we expected, set it to the last day of the previous month
      d.setDate(0);
    }
    logObject("date returned by function for monthsInfront()", d);
    return d;
  } catch (error) {
    logger.error(`🐛🐛 Internal server error -- ${error.message}`);
  }
}

function addDays(number, next) {
  try {
    let d = new Date();
    d.setDate(d.getDate() + number);
    logObject("date returned by function addDays()", d);
    return d;
  } catch (error) {
    logger.error(`internal server error -- ${error.message}`);
  }
}

function addHours(number, next) {
  try {
    const currentTime = new Date();
    const newTime = new Date(currentTime.getTime() + number * 60 * 60 * 1000);
    return newTime;
  } catch (error) {
    logger.error(`internal server error -- ${error.message}`);
  }
}

function addMinutes(number, next) {
  try {
    let d = new Date();
    d.setMinutes(d.getMinutes() + number);
    return d;
  } catch (error) {
    logger.error(`internal server error -- ${error.message}`);
  }
}

function getDifferenceInMonths(d1, d2) {
  let months;
  let start = new Date(d1);
  let end = new Date(d2);
  months = (end.getFullYear() - start.getFullYear()) * 12;
  months -= start.getMonth();
  months += end.getMonth();
  logObject(" result for getDifferenceInMonths()", months <= 0 ? 0 : months);
  return months <= 0 ? 0 : months;
}

function getDifferenceInWeeks(d1, d2) {
  const oneWeekInMilliseconds = 7 * 24 * 60 * 60 * 1000;
  const startDate = new Date(d1);
  const endDate = new Date(d2);
  const timeDifference = Math.abs(endDate - startDate);
  const weeks = Math.floor(timeDifference / oneWeekInMilliseconds);

  return weeks;
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
  getDifferenceInWeeks,
  addDaysToProvideDateTime,
  addWeeksToProvideDateTime,
  addDays,
  addMinutes,
  formatDate,
  addHours,
};
