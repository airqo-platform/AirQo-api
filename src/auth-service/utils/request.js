const { logElement } = require("./log");

const request = {
  create: async (
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

  list: async (tenant, filter, options) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  update: async (tenant, filter, options) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  confirm: async (tenant, email, password, options) => {
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

  delete: async () => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },
};

module.exports = request;
