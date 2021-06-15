const { logElement, logObject } = require("./log");

const filter = {
  users: (req) => {
    try {
      let { privilege, id, username, active } = req.query;
      let { email, resetPasswordToken } = req.body;
      let filter = {};
      if (email) {
        filter["email"] = email;
      }
      if (resetPasswordToken) {
        filter["resetPasswordToken"] = resetPasswordToken;
        filter["resetPasswordExpires"] = {
          $gt: Date.now(),
        };
      }
      if (privilege) {
        filter["privilege"] = privilege;
      }
      if (id) {
        filter["_id"] = id;
      }
      if (active) {
        if (active == "yes") {
          filter["isActive"] = true;
        } else if (active == "no") {
          filter["isActive"] = false;
        }
      }
      if (username) {
        filter["userName"] = username;
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (e) {
      return {
        success: false,
        message: "filter util server error",
        error: e.message,
      };
    }
  },
  candidates: (req) => {
    try {
      let { category, id } = req.query;
      let { email } = req.body;
      let filter = {};
      if (email) {
        filter["email"] = email;
      }
      if (category) {
        filter["category"] = category;
      }
      if (id) {
        filter["_id"] = id;
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (e) {
      return {
        success: false,
        message: "filter util server error",
        error: e.message,
      };
    }
  },
  defaults: (req) => {
    try {
      let { chart, user, id } = req.query;
      let filter = {};
      if (chart) {
        filter["chartTitle"] = chart;
      }
      if (user) {
        filter["user"] = user;
      }
      if (id) {
        filter["_id"] = id;
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (e) {
      return {
        success: false,
        message: "filter util server error",
        error: e.message,
      };
    }
  },

  defaults: (req) => {
    try {
      let { user, chartTitle } = req.query;
      let filter = {};
      if (user) {
        filter["user"] = user;
      }
      if (chartTitle) {
        filter["chartTitle"] = chartTitle;
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (e) {
      return {
        success: false,
        message: "filter util server error",
        error: e.message,
      };
    }
  },
};

module.exports = filter;
