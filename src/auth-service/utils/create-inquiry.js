const InquiryModel = require("@models/Inquiry");
const { logObject } = require("@utils/log");
const mailer = require("@utils/mailer");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generatFilter = require("@utils/generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- inquiry-util`);
const { HttpError } = require("@utils/errors");

const inquiry = {
  create: async (request, next) => {
    try {
      const {
        fullName,
        email,
        message,
        category,
        tenant,
        firstName,
        lastName,
      } = { ...request.body, ...request.query, ...request.params };

      const name = fullName || firstName || lastName;
      const inquiry = {
        ...request.body,
      };

      const responseFromCreateInquiry = await InquiryModel(tenant).register(
        inquiry,
        next
      );

      if (responseFromCreateInquiry.success === true) {
        const createdInquiry = await responseFromCreateInquiry.data;
        const responseFromSendEmail = await mailer.inquiry(
          {
            name,
            email,
            category,
            message,
            tenant,
          },
          next
        );

        if (responseFromSendEmail.success === true) {
          return {
            success: true,
            message: "inquiry successfully created",
            data: createdInquiry,
            status: responseFromSendEmail.status || "",
          };
        } else if (responseFromSendEmail.success === false) {
          logObject("responseFromSendEmail", responseFromSendEmail);
          return responseFromSendEmail;
        }
      } else if (responseFromCreateInquiry.success === false) {
        return responseFromCreateInquiry;
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (request, next) => {
    try {
      const { tenant, filter, limit, skip } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const responseFromListInquiry = await InquiryModel(
        tenant.toLowerCase()
      ).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListInquiry;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const update = request.body;
      const filter = await generatFilter.inquiry(request);
      const responseFromModifyInquiry = await InquiryModel(
        tenant.toLowerCase()
      ).modify(
        {
          filter,
          update,
        },
        next
      );
      logObject("responseFromModifyInquiry", responseFromModifyInquiry);
      return responseFromModifyInquiry;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = await generatFilter.inquiry(request);

      const responseFromRemoveInquiry = await InquiryModel(
        tenant.toLowerCase()
      ).remove(
        {
          filter,
        },
        next
      );
      return responseFromRemoveInquiry;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = inquiry;
