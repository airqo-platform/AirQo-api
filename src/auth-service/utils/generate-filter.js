const { logElement } = require("./log");

const filter = {
  users: () => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },
  candidates: () => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },
  defaults: () => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },
};

module.exports = filter;
