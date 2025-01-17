const CampaignModel = require("@models/Campaign");
const TransactionModel = require("@models/Transaction");
const { logElement, logText, logObject } = require("@utils/log");
const stringify = require("@utils/stringify");
const generateFilter = require("@utils/generate-filter");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- campaigns-util`);
const { HttpError } = require("@utils/errors");

const campaigns = {
  /**
   * Create a new campaign
   * @param {Object} request - Express request object
   * @param {Object} campaignData - Campaign creation data
   * @param {Function} next - Error handling middleware
   */
  createCampaign: async (request, campaignData, next) => {
    try {
      const { tenant } = request.query;
      const result = await CampaignModel(tenant).create(campaignData, next);
      logObject("Campaign Creation Response", result);
      return result;
    } catch (error) {
      logger.error(`Campaign Creation Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * List campaigns with flexible filtering
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  list: async (request, next) => {
    try {
      logText("Processing campaign listing request");
      const { tenant } = request.query;
      const filter = generateFilter.campaigns(request, next);
      const { limit, skip } = request.query;

      const listResponse = await CampaignModel(tenant).list(
        {
          filter,
          limit: limit ? parseInt(limit) : 20,
          skip: skip ? parseInt(skip) : 0,
        },
        next
      );

      logObject("listResponse", listResponse);
      return listResponse;
    } catch (error) {
      logger.error(`Campaign Listing Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Get a single campaign by ID
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  getCampaign: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { id } = request.params;

      const campaign = await CampaignModel(tenant)
        .findById(id)
        .populate("created_by", "name email");

      if (!campaign) {
        return {
          success: false,
          message: "Campaign not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: "Campaign retrieved successfully",
        data: campaign,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Get Campaign Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Update a campaign
   * @param {Object} request - Express request object
   * @param {Object} updateData - Update data
   * @param {Function} next - Error handling middleware
   */
  updateCampaign: async (request, updateData, next) => {
    try {
      const { tenant } = request.query;
      const { id } = request.params;

      const campaign = await CampaignModel(tenant).findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!campaign) {
        return {
          success: false,
          message: "Campaign not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: "Campaign updated successfully",
        data: campaign,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Update Campaign Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Delete a campaign
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  deleteCampaign: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { id } = request.params;

      const campaign = await CampaignModel(tenant).findByIdAndDelete(id);

      if (!campaign) {
        return {
          success: false,
          message: "Campaign not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: "Campaign deleted successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Delete Campaign Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Create a campaign update
   * @param {Object} request - Express request object
   * @param {Object} updateData - Update creation data
   * @param {Function} next - Error handling middleware
   */
  createCampaignUpdate: async (request, updateData, next) => {
    try {
      const { tenant } = request.query;
      const { id } = request.params;
      const { title, content, created_by } = updateData;

      const campaign = await CampaignModel(tenant).findById(id);

      if (!campaign) {
        return {
          success: false,
          message: "Campaign not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      campaign.updates.push({
        title,
        content,
        created_by,
        created_at: new Date(),
      });

      await campaign.save();

      return {
        success: true,
        message: "Campaign update created successfully",
        data: campaign.updates[campaign.updates.length - 1],
        status: httpStatus.CREATED,
      };
    } catch (error) {
      logger.error(`Campaign Update Creation Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Get campaign updates
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  getCampaignUpdates: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { id } = request.params;

      const campaign = await CampaignModel(tenant)
        .findById(id)
        .populate("updates.created_by", "name email");

      if (!campaign) {
        return {
          success: false,
          message: "Campaign not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: "Campaign updates retrieved successfully",
        data: campaign.updates,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Get Campaign Updates Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Get campaign statistics
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  getCampaignStats: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { start_date, end_date } = request.query;

      const filter = {};
      if (start_date || end_date) {
        filter.createdAt = {};
        if (start_date) filter.createdAt.$gte = new Date(start_date);
        if (end_date) filter.createdAt.$lte = new Date(end_date);
      }

      const campaignStats = await CampaignModel(tenant).getStats(filter);
      const transactionStats = await TransactionModel(tenant).aggregate([
        {
          $match: {
            donation_campaign_id: { $exists: true },
            status: "completed",
            ...(filter.createdAt && { createdAt: filter.createdAt }),
          },
        },
        {
          $group: {
            _id: "$donation_campaign_id",
            total_donations: { $sum: 1 },
            total_amount: { $sum: "$amount" },
          },
        },
      ]);

      return {
        success: true,
        message: "Statistics retrieved successfully",
        data: {
          campaigns: campaignStats[0] || {
            totalCampaigns: 0,
            totalTargetAmount: 0,
            totalRaisedAmount: 0,
          },
          donations: {
            total_count: transactionStats.reduce(
              (acc, curr) => acc + curr.total_donations,
              0
            ),
            total_amount: transactionStats.reduce(
              (acc, curr) => acc + curr.total_amount,
              0
            ),
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Campaign Stats Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Toggle campaign status
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  toggleCampaignStatus: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { id } = request.params;

      const campaign = await CampaignModel(tenant).findById(id);

      if (!campaign) {
        return {
          success: false,
          message: "Campaign not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Toggle between active and paused states
      campaign.status = campaign.status === "active" ? "paused" : "active";
      await campaign.save();

      return {
        success: true,
        message: `Campaign status changed to ${campaign.status}`,
        data: campaign,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Toggle Campaign Status Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Get campaign donations
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  getCampaignDonations: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { id } = request.params;
      const { limit = 20, skip = 0 } = request.query;

      const donations = await TransactionModel(tenant)
        .find({
          donation_campaign_id: id,
          status: "completed",
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .populate("user_id", "name email");

      const total = await TransactionModel(tenant).countDocuments({
        donation_campaign_id: id,
        status: "completed",
      });

      return {
        success: true,
        message: "Campaign donations retrieved successfully",
        data: {
          donations,
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Get Campaign Donations Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Generate campaign report
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  generateCampaignReport: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { start_date, end_date } = request.query;

      const filter = {};
      if (start_date || end_date) {
        filter.createdAt = {};
        if (start_date) filter.createdAt.$gte = new Date(start_date);
        if (end_date) filter.createdAt.$lte = new Date(end_date);
      }

      const campaigns = await CampaignModel(tenant)
        .find(filter)
        .populate("created_by", "name email");

      const donationsData = await TransactionModel(tenant).aggregate([
        {
          $match: {
            donation_campaign_id: { $exists: true },
            status: "completed",
            ...(filter.createdAt && { createdAt: filter.createdAt }),
          },
        },
        {
          $group: {
            _id: "$donation_campaign_id",
            total_donations: { $sum: 1 },
            total_amount: { $sum: "$amount" },
            average_donation: { $avg: "$amount" },
          },
        },
      ]);

      const report = {
        generated_at: new Date(),
        time_period: {
          start_date: start_date || "All time",
          end_date: end_date || "Current",
        },
        summary: {
          total_campaigns: campaigns.length,
          active_campaigns: campaigns.filter((c) => c.status === "active")
            .length,
          total_raised: donationsData.reduce(
            (acc, curr) => acc + curr.total_amount,
            0
          ),
          total_donations: donationsData.reduce(
            (acc, curr) => acc + curr.total_donations,
            0
          ),
        },
        campaigns: campaigns.map((campaign) => ({
          id: campaign._id,
          title: campaign.title,
          status: campaign.status,
          target_amount: campaign.target_amount,
          current_amount: campaign.current_amount,
          progress_percentage: (
            (campaign.current_amount / campaign.target_amount) *
            100
          ).toFixed(2),
          created_by: campaign.created_by,
          created_at: campaign.createdAt,
          category: campaign.category,
        })),
      };

      return {
        success: true,
        message: "Campaign report generated successfully",
        data: report,
        // Continued from previous implementation...
        donations_summary: donationsData.map((donation) => ({
          campaign_id: donation._id,
          total_donations: donation.total_donations,
          total_amount: donation.total_amount,
          average_donation: donation.average_donation.toFixed(2),
        })),
      };

      return {
        success: true,
        message: "Campaign report generated successfully",
        data: report,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Generate Campaign Report Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Helper function to validate campaign existence
   * @param {string} campaignId - Campaign ID
   * @param {string} tenant - Tenant identifier
   * @returns {Promise<Object>} Campaign object if found
   * @throws {HttpError} If campaign not found
   */
  validateCampaignExists: async (campaignId, tenant) => {
    const campaign = await CampaignModel(tenant).findById(campaignId);
    if (!campaign) {
      throw new HttpError("Campaign not found", httpStatus.NOT_FOUND);
    }
    return campaign;
  },

  /**
   * Helper function to validate campaign ownership
   * @param {Object} campaign - Campaign object
   * @param {string} userId - User ID
   * @throws {HttpError} If user is not the campaign owner
   */
  validateCampaignOwnership: (campaign, userId) => {
    if (campaign.created_by.toString() !== userId) {
      throw new HttpError(
        "Unauthorized access to campaign",
        httpStatus.FORBIDDEN
      );
    }
  },

  /**
   * Helper function to validate campaign dates
   * @param {Date} startDate - Campaign start date
   * @param {Date} endDate - Campaign end date
   * @throws {HttpError} If dates are invalid
   */
  validateCampaignDates: (startDate, endDate) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new HttpError(
        "End date must be after start date",
        httpStatus.BAD_REQUEST
      );
    }

    if (start < now && !existingCampaign) {
      throw new HttpError(
        "Start date cannot be in the past for new campaigns",
        httpStatus.BAD_REQUEST
      );
    }
  },

  /**
   * Helper function to format campaign response
   * @param {Object} campaign - Campaign object
   * @returns {Object} Formatted campaign response
   */
  formatCampaignResponse: (campaign) => {
    return {
      id: campaign._id,
      title: campaign.title,
      description: campaign.description,
      target_amount: campaign.target_amount,
      current_amount: campaign.current_amount,
      currency: campaign.currency,
      progress: (
        (campaign.current_amount / campaign.target_amount) *
        100
      ).toFixed(2),
      status: campaign.status,
      category: campaign.category,
      created_by: campaign.created_by,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      is_public: campaign.is_public,
      images: campaign.images,
      tags: campaign.tags,
      updates_count: campaign.updates.length,
      created_at: campaign.createdAt,
      updated_at: campaign.updatedAt,
    };
  },
};

module.exports = campaigns;
