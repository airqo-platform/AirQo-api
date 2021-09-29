const { logObject, logElement, logText } = require("./log");
const transformData = {
  convertErrorArrayToObject: (arrays) => {
    const initialValue = {};
    return arrays.reduce((obj, item) => {
      let param = item.param;
      return {
        ...obj,
        [param]: `${item.msg}`,
      };
    }, initialValue);
  },
};

module.exports = transformData;
