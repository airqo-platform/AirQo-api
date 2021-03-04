const generateDateFormat = async (ISODate) => {
  date = new Date(ISODate);
  year = date.getFullYear();
  month = date.getMonth() + 1;
  day = date.getDate();
  hrs = date.getHours();

  if (day && month && hrs) {
    if (day < 10) {
      day = "0" + day;
    }
    if (month < 10) {
      month = "0" + month;
    }
    return `${year}-${month}-${day}-${hrs}`;
  } else {
    return `${year}-${month}-${day}`;
  }
};

const generateDateFormatWithoutHrs = async (ISODate) => {
  date = new Date(ISODate);
  year = date.getFullYear();
  month = date.getMonth() + 1;
  day = date.getDate();
  hrs = date.getHours();

  return `${year}-${month}-${day}`;
};

module.exports = { generateDateFormat, generateDateFormatWithoutHrs };
