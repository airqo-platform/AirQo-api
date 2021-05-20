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

const generateMonthsInfront = (date, number) => {
  var d = new Date(date);
  var targetMonth = d.getMonth() + number;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0);
  }
  return d;
};

const generateMonthsBehind = (date, number) => {
  var d = new Date(date);
  var targetMonth = d.getMonth() - number;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0);
  }
  return d;
};

module.exports = {
  generateDateFormat,
  generateDateFormatWithoutHrs,
  generateMonthsBehind,
  generateMonthsInfront,
};
