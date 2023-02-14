const InquirySchema = require("../models/Inquiry");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logElement, logText } = require("./log");
const mailer = require("./mailer");
const httpStatus = require("http-status");
constants = require("../config/constants");

const InquiryModel = (tenant) => {
  return getModelByTenant(tenant, "inquiry", InquirySchema);
};

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- inquire-util`);

const inquire = {
  create: async (inquire, callback) => {
    try {
      const { fullName, email, message, category, tenant } = inquire;

      const responseFromCreateInquiry = await InquiryModel(tenant).register(
        inquire
      );

      if (responseFromCreateInquiry.success === true) {
        const createdInquiry = await responseFromCreateInquiry.data;
        let responseFromSendEmail = await mailer.inquiry(
          fullName,
          email,
          category,
          message,
          tenant
        );
        if (responseFromSendEmail.success === true) {
          const status = responseFromSendEmail.status
            ? responseFromSendEmail.status
            : "";
          callback({
            success: true,
            message: "inquiry successfully created",
            data: createdInquiry,
            status,
          });
        } else if (responseFromSendEmail.success === false) {
          logObject("responseFromSendEmail", responseFromSendEmail);
          const errors = responseFromSendEmail.error
            ? responseFromSendEmail.error
            : "";
          const status = responseFromSendEmail.status
            ? responseFromSendEmail.status
            : "";

          callback({
            success: false,
            message: responseFromSendEmail.message,
            errors,
            status,
          });
        }
      } else if (responseFromCreateInquiry.success === false) {
        const errors = responseFromCreateInquiry.errors
          ? responseFromCreateInquiry.errors
          : "";
        const status = responseFromCreateInquiry.status
          ? responseFromCreateInquiry.status
          : "";
        callback({
          success: false,
          message: responseFromCreateInquiry.message,
          errors,
          status,
        });
      }
    } catch (e) {
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },

  list: async ({ tenant, filter, limit, skip }) => {
    try {
      logElement("the tenant", tenant);
      logObject("the filter", filter);
      logElement("limit", limit);
      logElement("the skip", skip);

      let responseFromListInquiry = await InquiryModel(
        tenant.toLowerCase()
      ).list({
        filter,
        limit,
        skip,
      });

      if (responseFromListInquiry.success == true) {
        return {
          success: true,
          message: responseFromListInquiry.message,
          data: responseFromListInquiry.data,
        };
      } else if (responseFromListInquiry.success == false) {
        if (responseFromListInquiry.error) {
          return {
            success: false,
            message: responseFromListInquiry.message,
            error: responseFromListInquiry.error,
          };
        } else {
          return {
            success: false,
            message: responseFromListInquiry.message,
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
      let responseFromModifyInquiry = await InquiryModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });
      logObject("responseFromModifyInquiry", responseFromModifyInquiry);
      if (responseFromModifyInquiry.success == true) {
        return {
          success: true,
          message: responseFromModifyInquiry.message,
          data: responseFromModifyInquiry.data,
        };
      } else if (responseFromModifyInquiry.success == false) {
        if (responseFromModifyInquiry.error) {
          return {
            success: false,
            message: responseFromModifyInquiry.message,
            error: responseFromModifyInquiry.error,
          };
        } else {
          return {
            success: false,
            message: responseFromModifyInquiry.message,
          };
        }
      }
    } catch (e) {
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },

  delete: async (tenant, filter) => {
    try {
      let responseFromRemoveInquiry = await InquiryModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });

      if (responseFromRemoveInquiry.success == true) {
        return {
          success: true,
          message: responseFromRemoveInquiry.message,
          data: responseFromRemoveInquiry.data,
        };
      } else if (responseFromRemoveInquiry.success == false) {
        if (responseFromRemoveInquiry.error) {
          return {
            success: false,
            message: responseFromRemoveInquiry.message,
            error: responseFromRemoveInquiry.error,
          };
        } else {
          return {
            success: false,
            message: responseFromRemoveInquiry.message,
          };
        }
      }
    } catch (e) {
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },
};

module.exports = inquire;
