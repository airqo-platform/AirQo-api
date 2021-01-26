const generateDateFormat = async (ISODate) => {
  date = new Date(ISODate);
  year = date.getFullYear();
  month = date.getMonth() + 1;
  dt = date.getDate();
  hrs = date.getHours();

  if (dt < 10) {
    dt = "0" + dt;
  }
  if (month < 10) {
    month = "0" + month;
  }

  return `${year}-${month}-${dt}-${hrs}`;
};

module.exports = { generateDateFormat };
