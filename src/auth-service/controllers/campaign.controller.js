const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logText, logObject } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- campaign-controller`
);
const campaignsUtil = require("@utils/campaign.util");

const campaigns = {
  // Create Campaign
  createCampaign: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const {
        title,
        description,
        target_amount,
        currency,
        start_date,
        end_date,
        category,
      } = request.body;

      const result = await campaignsUtil.createCampaign(request, {
        title,
        description,
        target_amount,
        currency,
        start_date,
        end_date,
        category,
        created_by: request.user._id,
        status: "draft",
      });

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.CREATED;
        return res.status(status).json({
          success: true,
          message: "Campaign created successfully",
          campaign: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message ? result.message : "",
          errors: result.errors
            ? result.errors
            : { message: "Campaign creation failed" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  // List Campaigns
  listCampaigns: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await campaignsUtil.list(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: result.message,
          campaigns: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  // Get Single Campaign
  getCampaign: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await campaignsUtil.getCampaign(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: result.message,
          campaign: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Update Campaign
  updateCampaign: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await campaignsUtil.updateCampaign(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Campaign updated successfully",
          campaign: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Delete Campaign
  deleteCampaign: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await campaignsUtil.deleteCampaign(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Campaign deleted successfully",
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Create Campaign Update
  createCampaignUpdate: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await campaignsUtil.createUpdate(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Campaign update created successfully",
          update: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Get Campaign Updates
  getCampaignUpdates: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await campaignsUtil.getCampaignUpdates(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Campaign updates retrieved successfully",
          updates: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Get Campaign Statistics
  getCampaignStats: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await campaignsUtil.getStats(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Campaign statistics retrieved successfully",
          stats: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Toggle Campaign Status
  toggleCampaignStatus: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await campaignsUtil.toggleStatus(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Campaign status updated successfully",
          campaign: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Get Campaign Donations
  getCampaignDonations: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await campaignsUtil.getCampaignDonations(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Campaign donations retrieved successfully",
          donations: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Generate Campaign Report
  generateCampaignReport: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await campaignsUtil.generateReport(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Campaign report generated successfully",
          report: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

module.exports = campaigns;
