const { logElement, logObject } = require("./log");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;

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
      let { id, user, user_id } = req.query;
      let filter = {};
      if (user) {
        filter["user"] = ObjectId(user);
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (user_id) {
        filter["user"] = ObjectId(user_id);
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

  defaults_v2: (req) => {
    try {
      let { id, user, user_id, airqloud, airqloud_id, site, site_id } =
        req.query;
      let filter = {
        site_ids: {},
        sites: {},
        airqloud_ids: {},
        airqlouds: {},
      };

      /*** user id */
      if (user) {
        filter["user"] = ObjectId(user);
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }

      /** airqloud_id */
      if (airqloud_id) {
        let airqloudIdArray = airqloud_id.split(",");
        let modifiedAirQloudIdArray = airqloudIdArray.map((airqloud_id) => {
          return ObjectId(airqloud_id);
        });
        filter["airqloud_ids"]["$in"] = modifiedAirQloudIdArray;
      }

      if (!airqloud_id) {
        delete filter["airqloud_ids"];
      }

      /*** airqloud */
      if (airqloud) {
        filter["airqlouds"] = airqloud;
      }
      if (!airqloud) {
        delete filter["airqlouds"];
      }

      /**
       * site_id
       */
      if (site_id) {
        let siteIdArray = site_id.split(",");
        let modifiedSiteIdArray = siteIdArray.map((site_id) => {
          return ObjectId(site_id);
        });
        filter["site_ids"]["$in"] = modifiedSiteIdArray;
      }

      if (!site_id) {
        delete filter["site_ids"];
      }

      /** site */
      if (site) {
        let siteArray = site.split(",");
        filter["sites"]["$in"] = siteArray;
      }

      if (!site) {
        delete filter["sites"];
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
