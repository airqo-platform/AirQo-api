const DefaultsSchema = require("../models/Defaults");
const DefaultModel = (tenant) => {
  return getModelByTenant(tenant, "default", DefaultsSchema);
};

const defaults = {
  list: async (tenant, filter, limit, skip) => {
    try {
      let responseFromListDefault = DefaultModel(tenant).list({
        filter,
        limit,
        skip,
      });
      if (responseFromListDefault.success == true) {
        return {
          success: true,
          message: responseFromListDefault.message,
          users: responseFromListDefault.data,
        };
      } else if ((responseFromListDefault.success = false)) {
        if (responseFromListDefault.error) {
          return {
            success: false,
            message: responseFromListDefault.message,
            error: responseFromListDefault.error,
          };
        } else {
          return {
            success: false,
            message: responseFromListDefault.message,
          };
        }
      }
    } catch (e) {
      return {
        success: false,
        message: "utils server error",
        error: e.message,
      };
    }
  },
  update: async (tenant, filter, update) => {
    try {
      let responseFromModifyDefault = await DefaultModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });
      logObject("responseFromModifyDefault", responseFromModifyDefault);
      if (responseFromModifyDefault.success == true) {
        return {
          success: true,
          message: responseFromModifyDefault.message,
          data: responseFromModifyDefault.data,
        };
      } else if (responseFromModifyDefault.success == false) {
        if (responseFromModifyDefault.error) {
          return {
            success: false,
            message: responseFromModifyDefault.message,
            error: responseFromModifyDefault.error,
          };
        } else {
          return {
            success: false,
            message: responseFromModifyDefault.message,
          };
        }
      }
    } catch (e) {
      return {
        success: false,
        message: "defaults util server error",
        error: e.message,
      };
    }
  },
};

modules.exports = defaults;
