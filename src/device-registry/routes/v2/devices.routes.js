const express = require("express");
const router = express.Router();
const deviceController = require("@controllers/device.controller");
const { headers, pagination, validate } = require("@validators/common");
const {
  validateTenant,
  validateDeviceIdentifier,
  validateCreateDevice,
  validateUpdateDevice,
  validateEncryptKeys,
  validateDecryptKeys,
  validateDecryptManyKeys,
  validateListDevices,
  validateArrayBody,
  validateBulkUpdateDevices,
  validateDeviceIdParam,
  validateClaimDevice,
  validateGetMyDevices,
  validateDeviceAvailability,
  validateOrganizationAssignment,
  validateOrganizationSwitch,
  validateQRCodeGeneration,
  validateListOrphanedDevices,
  validateMigrationRequest,
  validateGetUserOrganizations,
  validatePrepareDeviceShipping,
  validateBulkPrepareDeviceShipping,
  validateGetShippingStatus,
  validateGenerateShippingLabels,
  validateGetDeviceCountSummary,
} = require("@validators/device.validators");
const constants = require("@config/constants");

router.use(headers);

// =============================================================================
// SPECIFIC ROUTES FIRST (before any parameterized routes like /:id)
// =============================================================================

// DEVICE CLAIMING ROUTES
router.post(
  "/claim",
  validateTenant,
  validateClaimDevice,
  validate,
  deviceController.claimDevice
);

router.get(
  "/my-devices",
  validateTenant,
  validateGetMyDevices,
  validate,
  deviceController.getMyDevices
);

router.get(
  "/check-availability/:deviceName",
  validateTenant,
  validateDeviceAvailability,
  validate,
  deviceController.checkDeviceAvailability
);

// ORGANIZATION ROUTES
router.post(
  "/assign-to-organization",
  validateTenant,
  validateOrganizationAssignment,
  validate,
  deviceController.assignDeviceToOrganization
);

router.get(
  "/user-organizations",
  validateTenant,
  validateGetUserOrganizations,
  validate,
  deviceController.getUserOrganizations
);

router.post(
  "/switch-organization/:organization_id",
  validateTenant,
  validateOrganizationSwitch,
  validate,
  deviceController.switchOrganizationContext
);

// QR CODE & ADMIN ROUTES
router.get(
  "/qr-code/:deviceName",
  validateTenant,
  validateQRCodeGeneration,
  validate,
  deviceController.generateClaimQRCode
);

// MIGRATION ROUTE - MUST BE BEFORE /:id ROUTE
router.post(
  "/migrate-for-claiming",
  validateTenant,
  validateMigrationRequest,
  validate,
  deviceController.migrateDevicesForClaiming
);

// DECRYPT ROUTES
router.post(
  "/decrypt",
  validateTenant,
  validateDecryptKeys,
  deviceController.decryptKey
);

router.post(
  "/decrypt/bulk",
  validateTenant,
  validateArrayBody,
  validateDecryptManyKeys,
  deviceController.decryptManyKeys
);

// ENCRYPT ROUTE
router.put(
  "/encrypt",
  validateTenant,
  validateDeviceIdentifier,
  validateEncryptKeys,
  deviceController.encryptKeys
);

// COUNT ROUTE
router.get(
  "/count",
  validateTenant,
  pagination(),
  deviceController.getDevicesCount
);

// NEW COUNT SUMMARY ROUTE
router.get(
  "/summary/count",
  validateTenant,
  validateGetDeviceCountSummary,
  validate,
  deviceController.getDeviceCountSummary
);

router.get(
  "/orphaned",
  validateTenant,
  validateListOrphanedDevices,
  validate,
  deviceController.listOrphanedDevices
);

// SUMMARY ROUTE
router.get(
  "/summary",
  validateTenant,
  validateListDevices,
  pagination(),
  deviceController.listSummary
);

// NEAREST COORDINATES ROUTE
router.get(
  "/by/nearest-coordinates",
  validateTenant,
  pagination(),
  deviceController.listAllByNearestCoordinates
);

// SOFT OPERATIONS
router.post(
  "/soft",
  validateTenant,
  validateCreateDevice,
  deviceController.createOnPlatform
);

router.delete(
  "/soft",
  validateTenant,
  validateDeviceIdentifier,
  deviceController.deleteOnPlatform
);

router.put(
  "/soft",
  validateTenant,
  validateDeviceIdentifier,
  validateUpdateDevice,
  deviceController.updateOnPlatform
);

// EXISTING QR CODE ROUTE (different from new one)
router.get(
  "/qrcode",
  validateTenant,
  validateDeviceIdentifier,
  pagination(),
  deviceController.generateQRCode
);

// BULK OPERATIONS
router.put(
  "/bulk",
  validateTenant,
  validateBulkUpdateDevices,
  deviceController.updateManyDevicesOnPlatform
);

// LIST MOBILE DEVICES
router.get(
  "/mobile",
  validateTenant,
  validateListDevices,
  pagination(),
  deviceController.listMobile
);

// LIST STATIC DEVICES
router.get(
  "/static",
  validateTenant,
  validateListDevices,
  pagination(),
  deviceController.listStatic
);

// LIST LOWCOST DEVICES
router.get(
  "/lowcost",
  validateTenant,
  validateListDevices,
  pagination(),
  deviceController.listLowCost
);

// LIST BAM DEVICES
router.get(
  "/bam",
  validateTenant,
  validateListDevices,
  pagination(),
  deviceController.listBam
);

// LIST GAS DEVICES
router.get(
  "/gas",
  validateTenant,
  validateListDevices,
  pagination(),
  deviceController.listGas
);

// =============================================================================
// DEVICE METADATA CLEANUP ROUTES
// =============================================================================
router.get(
  "/mobile-metadata-analysis",
  validateTenant,
  pagination(),
  deviceController.getMobileDevicesMetadataAnalysis
);

router.post(
  "/fix-metadata-conflicts",
  validateTenant,
  deviceController.fixMetadataConflicts
);

// =============================================================================
// SHIPPING PREPARATION ROUTES
// =============================================================================

// Prepare single device for shipping
router.post(
  "/prepare-for-shipping",
  validateTenant,
  validatePrepareDeviceShipping,
  validate,
  deviceController.prepareDeviceForShipping
);

// Prepare multiple devices for shipping
router.post(
  "/prepare-bulk-for-shipping",
  validateTenant,
  validateBulkPrepareDeviceShipping,
  validate,
  deviceController.prepareBulkDevicesForShipping
);

// Get shipping preparation status
router.get(
  "/shipping-status",
  validateTenant,
  validateGetShippingStatus,
  validate,
  deviceController.getShippingPreparationStatus
);

// Generate shipping labels for printing
router.post(
  "/generate-shipping-labels",
  validateTenant,
  validateGenerateShippingLabels,
  validate,
  deviceController.generateShippingLabels
);

// =============================================================================
// GENERIC ROUTES (should be at the end)
// =============================================================================

// LIST DEVICES - Generic GET route
router.get(
  "/",
  validateTenant,
  validateListDevices,
  pagination(),
  deviceController.list
);

// CREATE DEVICE
router.post("/", validateTenant, validateCreateDevice, deviceController.create);

// DELETE DEVICE
router.delete(
  "/",
  validateTenant,
  validateDeviceIdentifier,
  deviceController.delete
);

// UPDATE DEVICE
router.put(
  "/",
  validateTenant,
  validateDeviceIdentifier,
  validateUpdateDevice,
  deviceController.update
);

// REFRESH DEVICE
router.put(
  "/refresh",
  validateTenant,
  validateDeviceIdentifier,
  deviceController.refresh
);

// =============================================================================
// PARAMETERIZED ROUTES - MUST BE LAST
// =============================================================================

// GET DEVICE BY ID - This should be the LAST route
router.get(
  "/:id",
  validateTenant,
  validateDeviceIdParam,
  validate,
  deviceController.getDeviceDetailsById
);

module.exports = router;
