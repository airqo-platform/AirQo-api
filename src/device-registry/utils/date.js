const { logText, logObject, logElement } = require("./log");

const generateDateFormat = (ISODate) => {
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
    console.log("server side error: ", e.message);
  }
};

const generateDateFormatWithoutHrs = (ISODate) => {
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
    console.log("server side error: ", e.message);
  }
};

const addMonthsToProvidedDate = (date, number) => {
  try {
    let year = date.split("-")[0];
    let month = date.split("-")[1];
    let day = date.split("-")[2];
    let newMonth = parseInt(month, 10) + number;
    let modifiedMonth = "0" + newMonth;
    return `${year}-${modifiedMonth}-${day}`;
  } catch (e) {
    console.log("server side error: ", e.message);
  }
};

const removeMonthsFromProvidedDate = (date, number) => {
  try {
    let year = date.split("-")[0];
    let month = date.split("-")[1];
    let day = date.split("-")[2];
    let newMonth = parseInt(month, 10) - number;
    let modifiedMonth = "0" + newMonth;
    return `${year}-${modifiedMonth}-${day}`;
  } catch (e) {
    console.log("server side error: ", e.message);
  }
};

const monthsBehind = (number) => {
  try {
    let d = new Date();
    let targetMonth = d.getMonth() - number;
    d.setMonth(targetMonth);
    if (d.getMonth() !== targetMonth % 12) {
      d.setDate(0);
    }
    return d;
  } catch (e) {
    console.log("server side error: ", e.message);
  }
};

const monthsInfront = (number) => {
  try {
    let d = new Date();
    let targetMonth = d.getMonth() + number;
    d.setMonth(targetMonth);
    if (d.getMonth() !== targetMonth % 12) {
      d.setDate(0);
    }
    return d;
  } catch (e) {
    console.log("server side error: ", e.message);
  }
};

module.exports = {
  generateDateFormat,
  generateDateFormatWithoutHrs,
  removeMonthsFromProvidedDate,
  addMonthsToProvidedDate,
  monthsBehind,
  monthsInfront,
};
