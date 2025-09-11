const express = require("express");
const CampaignController = require("@controllers/campaign.controller");
const campaignValidations = require("@validators/campaign.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

const router = express.Router();

router.use(headers);
router.use(campaignValidations.pagination(20, 100));

// Create Campaign
router.post(
  "/create",
  campaignValidations.create,
  enhancedJWTAuth,
  CampaignController.createCampaign
);

// List Campaigns
router.get(
  "/list",
  campaignValidations.list,
  enhancedJWTAuth,
  CampaignController.listCampaigns
);

// Get Single Campaign
router.get(
  "/:id",
  campaignValidations.idOperation,
  enhancedJWTAuth,
  CampaignController.getCampaign
);

// Update Campaign
router.patch(
  "/:id/update",
  campaignValidations.update,
  enhancedJWTAuth,
  CampaignController.updateCampaign
);

// Delete Campaign
router.delete(
  "/:id/delete",
  campaignValidations.idOperation,
  enhancedJWTAuth,
  CampaignController.deleteCampaign
);

// Create Campaign Update
router.post(
  "/:id/updates",
  campaignValidations.createUpdate,
  enhancedJWTAuth,
  CampaignController.createCampaignUpdate
);

// Get Campaign Updates
router.get(
  "/:id/updates",
  campaignValidations.idOperation,
  enhancedJWTAuth,
  CampaignController.getCampaignUpdates
);

// Get Campaign Statistics
router.get(
  "/stats",
  campaignValidations.tenantOperation,
  enhancedJWTAuth,
  CampaignController.getCampaignStats
);

// Toggle Campaign Status
router.patch(
  "/:id/toggle-status",
  campaignValidations.idOperation,
  enhancedJWTAuth,
  CampaignController.toggleCampaignStatus
);

// Get Campaign Donations
router.get(
  "/:id/donations",
  campaignValidations.idOperation,
  enhancedJWTAuth,
  CampaignController.getCampaignDonations
);

// Generate Campaign Report
router.get(
  "/reports/campaign-report",
  campaignValidations.tenantOperation,
  enhancedJWTAuth,
  CampaignController.generateCampaignReport
);

module.exports = router;
