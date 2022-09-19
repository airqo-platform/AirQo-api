const InquirySchema = require("../models/Inquiry");
const { getModelByTenant } = require("../utils/multitenancy");
const { logObject, logElement, logText } = require("../utils/log");
const mailer = require("../services/mailer");
const httpStatus = require("http-status");
const validationsUtil = require("./validations");
constants = require("../config/constants");
const kickbox = require("kickbox")
  .client(`${constants.KICKBOX_API_KEY}`)
  .kickbox();

const InquiryModel = (tenant) => {
  return getModelByTenant(tenant, "inquiry", InquirySchema);
};

const inquire = {
  create: async (inquire, callback) => {
    try {
      let { fullName, email, message, category, tenant } = inquire;

      // await validationsUtil.checkEmailExistenceUsingKickbox(email, (value) => {
      //   if (value.success === false) {
      //     const errors = value.errors ? value.errors : "";
      //     logObject("the validation checks results", {
      //       success: false,
      //       message: value.message,
      //       errors,
      //       status: value.status,
      //     });
      //     callback({
      //       success: false,
      //       message: value.message,
      //       errors,
      //       status: value.status,
      //     });
      //   }
      // });

      const responseFromCreateInquiry = await InquiryModel(tenant).register(
        inquire
      );

      if (responseFromCreateInquiry.success === true) {
        let createdInquiry = await responseFromCreateInquiry.data;
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
        }

        if (responseFromSendEmail.success === false) {
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
      }

      if (responseFromCreateInquiry.success === false) {
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
