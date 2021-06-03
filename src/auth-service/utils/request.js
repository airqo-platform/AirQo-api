const { logElement } = require("./log");

const request = {
  create: (
    tenant,
    firstName,
    lastName,
    email,
    organization,
    jobTitle,
    website,
    description,
    category
  ) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  list: (tenant, filter, options) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  update: (tenant, filter, options) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  confirm: (tenant, filter, options) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  generatePassword: () => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  delete: () => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },
};

module.exports = request;
