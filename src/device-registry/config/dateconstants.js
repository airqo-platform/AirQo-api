//Sovling circular dependencies between date and constants

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

module.exports={
    generateDateFormatWithoutHrs,
    monthsInfront,
};