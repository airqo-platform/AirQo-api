const { logObject, logText, logElement, HttpError } = require("@utils/shared");
const log4js = require("log4js");
module.exports = {
  generateDateFormatWithoutHrs,
};
const moment = require("moment");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- date-util`);

const ConvertDates = {
  strToDate: (st, strFormat = "YYYY-MM-DDTHH:mm:ss.SSSSZ") => {
    return moment(st, strFormat).toDate();
  },

  dateToStr: (date, strFormat = "YYYY-MM-DDTHH:mm:ss.SSSSZ") => {
    return moment(date).format(strFormat);
  },

  formatDate: (date, strFormat = "YYYY-MM-DDTHH:mm:ss.SSSSZ") => {
    return moment(date).format(strFormat);
  },

  convertGMTtoEAT: (gmtDatetime) => {
    return moment(gmtDatetime)
      .add(3, "hours")
      .format("ddd, DD MMM YYYY HH:mm A");
  },

  convertToDate: (gmtDatetime) => {
    return moment(gmtDatetime).format("YYYY-MM-DD");
  },

  validateDateTime: (value, dateFormat = "YYYY-MM-DDTHH:mm:ss.SSSSZ") => {
    const parsedDate = moment(value, dateFormat, true);
    if (!parsedDate.isValid()) {
      throw new TypeError(`Cannot convert ${value} to datetime type`);
    }
    return parsedDate.toDate();
  },

  validateDate: (value) => {
    const parsedDate = moment(value, "YYYY-MM-DD", true);
    if (!parsedDate.isValid()) {
      throw new TypeError(`Cannot convert ${value} to datetime type`);
    }
    return parsedDate.toDate();
  },
};

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
  try {
    // FIXED: Handle invalid input dates
    if (
      !dateTime ||
      dateTime === false ||
      dateTime === null ||
      dateTime === undefined
    ) {
      return true; // Treat invalid inputs as "empty time"
    }

    let date = new Date(dateTime);

    // FIXED: Check if date is valid before extracting time components
    if (isNaN(date.getTime())) {
      return true; // Treat invalid dates as "empty time"
    }

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
  } catch (error) {
    logger.error(`isTimeEmpty error: ${error.message}`);
    return true;
  }
}

function formatDate(dateTime) {
  return new Date(dateTime).toISOString();
}

const isDate = (date) => {
  try {
    return date.includes("-") || date.includes("/");
  } catch (error) {
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
    };
  }
};

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
    // FIXED: Add input validation
    let workingDate;

    if (!date || date === false || date === null || date === undefined) {
      workingDate = new Date();
    } else {
      workingDate = new Date(date);
      if (isNaN(workingDate.getTime())) {
        workingDate = new Date();
      }
    }

    const originalDate = new Date(workingDate);
    const year = originalDate.getFullYear();
    const month = originalDate.getMonth();
    const day = originalDate.getDate();

    const newDate = new Date(year, month + number, day);

    const newYear = newDate.getFullYear();
    const newMonth = newDate.getMonth() + 1;
    const newDay = newDate.getDate();

    const formattedMonth = newMonth < 10 ? `0${newMonth}` : newMonth;
    const formattedDay = newDay < 10 ? `0${newDay}` : newDay;

    logObject(
      "date returned by function",
      `${newYear}-${formattedMonth}-${formattedDay}`
    );
    return `${newYear}-${formattedMonth}-${formattedDay}`;
  } catch (error) {
    logger.error(`🐛🐛 Internal server error -- ${error.message}`);
    // Return current date formatted as fallback
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1 + number;
    const day = now.getDate();
    return `${year}-${month < 10 ? "0" + month : month}-${
      day < 10 ? "0" + day : day
    }`;
  }
}

function addMonthsToProvideDateTime(dateTime, number, next) {
  try {
    // FIXED: Handle invalid input dates at the start
    let workingDate;

    if (
      !dateTime ||
      dateTime === false ||
      dateTime === null ||
      dateTime === undefined
    ) {
      workingDate = new Date(); // Use current date for invalid inputs
    } else {
      workingDate = new Date(dateTime);
      // Check if the created date is valid
      if (isNaN(workingDate.getTime())) {
        workingDate = new Date(); // Use current date for invalid dates
      }
    }

    if (isTimeEmpty(dateTime) === false) {
      const originalDate = new Date(workingDate);
      const year = originalDate.getFullYear();
      const month = originalDate.getMonth();
      const day = originalDate.getDate();

      const newDate = new Date(year, month + number, day);
      logObject(
        "date returned by function addMonthsToProvideDateTime() 1",
        newDate
      );
      return newDate; // Return Date object
    } else {
      // FIXED: Ensure we still return a Date object even in this branch
      const originalDate = new Date(workingDate);
      const year = originalDate.getFullYear();
      const month = originalDate.getMonth();
      const day = originalDate.getDate();

      const newDate = new Date(year, month + number, day);
      logObject(
        "date returned by function addMonthsToProvideDateTime() 2",
        newDate
      );
      return newDate; // Return Date object instead of calling addMonthsToProvidedDate
    }
  } catch (error) {
    logger.error(`🐛🐛 addMonthsToProvideDateTime error -- ${error.message}`);
    const fallbackDate = new Date();
    fallbackDate.setMonth(fallbackDate.getMonth() + number);
    return fallbackDate;
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

const isValidDateFormat = (value, format = "YYYY-MM-DDTHH:mm:ss.SSSSZ") => {
  try {
    const parsedDate = moment(value, format, true);
    if (!parsedDate.isValid()) {
      throw new Error(`Invalid date format. Use ${format}`);
    }
    return true;
  } catch (error) {
    throw new Error(`Invalid date format. Use ${format}`);
  }
};

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
  isValidDateFormat,
  addHours,
  ConvertDates,
  isDate,
};
