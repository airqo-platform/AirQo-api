const express = require("express");
const CampaignController = require("@controllers/campaign.controller");
const campaignValidations = require("@validators/campaign.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

const router = express.Router();

// CORS headers middleware
const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};

router.use(headers);
router.use(campaignValidations.pagination(20, 100));

// Create Campaign
router.post(
  "/create",
  campaignValidations.create,
  setJWTAuth,
  authJWT,
  CampaignController.createCampaign
);

// List Campaigns
router.get(
  "/list",
  campaignValidations.list,
  setJWTAuth,
  authJWT,
  CampaignController.listCampaigns
);

// Get Single Campaign
router.get(
  "/:id",
  campaignValidations.idOperation,
  setJWTAuth,
  authJWT,
  CampaignController.getCampaign
);

// Update Campaign
router.patch(
  "/:id/update",
  campaignValidations.update,
  setJWTAuth,
  authJWT,
  CampaignController.updateCampaign
);

// Delete Campaign
router.delete(
  "/:id/delete",
  campaignValidations.idOperation,
  setJWTAuth,
  authJWT,
  CampaignController.deleteCampaign
);

// Create Campaign Update
router.post(
  "/:id/updates",
  campaignValidations.createUpdate,
  setJWTAuth,
  authJWT,
  CampaignController.createCampaignUpdate
);

// Get Campaign Updates
router.get(
  "/:id/updates",
  campaignValidations.idOperation,
  setJWTAuth,
  authJWT,
  CampaignController.getCampaignUpdates
);

// Get Campaign Statistics
router.get(
  "/stats",
  campaignValidations.tenantOperation,
  setJWTAuth,
  authJWT,
  CampaignController.getCampaignStats
);

// Toggle Campaign Status
router.patch(
  "/:id/toggle-status",
  campaignValidations.idOperation,
  setJWTAuth,
  authJWT,
  CampaignController.toggleCampaignStatus
);

// Get Campaign Donations
router.get(
  "/:id/donations",
  campaignValidations.idOperation,
  setJWTAuth,
  authJWT,
  CampaignController.getCampaignDonations
);

// Generate Campaign Report
router.get(
  "/reports/campaign-report",
  campaignValidations.tenantOperation,
  setJWTAuth,
  authJWT,
  CampaignController.generateCampaignReport
);

module.exports = router;
