const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
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
  validateBulkClaim,
  validateGetMyDevices,
  validateDeviceAvailability,
  validateOrganizationSwitch,
  validateQRCodeGeneration,
  validateListOrphanedDevices,
  validateMigrationRequest,
  validateGetUserOrganizations,
  validatePrepareDeviceShipping,
  validateBulkPrepareDeviceShipping,
  validateCreateShippingBatch,
  validateGetShippingStatus,
  validateGenerateShippingLabels,
  validateGetShippingBatchDetails,
  validateGetDeviceCountSummary,
  validateTransferDevice,
  validateRemoveDevicesFromBatch,
  validateBulkSoftCreate,
} = require("@validators/device.validators");
const constants = require("@config/constants");

// ── Multer setup for CSV bulk import ────────────────────────────────────────
const _bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    // text/plain is intentionally excluded: the error message promises ".csv
    // only" and a plain-text file is not guaranteed to be CSV-structured.
    const allowedMimetypes = [
      "text/csv",
      "application/csv",
      "text/comma-separated-values",
      "application/vnd.ms-excel",
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimetypes.includes(file.mimetype) && ext === ".csv") {
      cb(null, true);
    } else {
      cb(
        new HttpError(
          "Only .csv files are accepted for bulk import",
          httpStatus.BAD_REQUEST,
          { message: `Unsupported file: mimetype=${file.mimetype}, extension=${ext}` },
        ),
        false,
      );
    }
  },
});

// Wraps multer errors into proper HttpErrors so the global error handler
// formats them consistently with the rest of the API.
const uploadBulkCSV = (req, res, next) => {
  _bulkUpload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : httpStatus.BAD_REQUEST;
      return next(new HttpError(err.message, status, { message: err.message }));
    }
    return next(
      err instanceof HttpError
        ? err
        : new HttpError(err.message, httpStatus.BAD_REQUEST, { message: err.message }),
    );
  });
};

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

router.post(
  "/claim/bulk",
  validateTenant,
  validateBulkClaim,
  validate,
  deviceController.bulkClaimDevice
);

router.get(
  "/my-devices",
  validateTenant,
  validateGetMyDevices,
  validate,
  pagination(),
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

// NEW STATUS-BASED LISTING ENDPOINTS
router.get(
  "/status/operational",
  validateTenant,
  validateListDevices,
  pagination(),
  validate,
  deviceController.listOperationalDevices
);

router.get(
  "/status/transmitting",
  validateTenant,
  validateListDevices,
  pagination(),
  validate,
  deviceController.listTransmittingDevices
);

router.get(
  "/status/data-available",
  validateTenant,
  validateListDevices,
  pagination(),
  validate,
  deviceController.listDataAvailableDevices
);

router.get(
  "/status/not-transmitting",
  validateTenant,
  validateListDevices,
  pagination(),
  validate,
  deviceController.listNotTransmittingDevices
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

// Bulk soft-create — accepts a JSON array of devices OR a multipart CSV file.
// Returns 207 Multi-Status with a per-device result array so the caller can
// see which rows succeeded and which failed without retrying the whole batch.
router.post(
  "/soft/bulk",
  validateTenant,
  uploadBulkCSV,
  validateBulkSoftCreate,
  validate,
  deviceController.bulkCreateOnPlatform
);

router.post(
  "/soft",
  validateTenant,
  validateCreateDevice,
  validate,
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
// DEVICE TRANSFER ROUTES
// =============================================================================

// Transfer device ownership between users
router.post(
  "/transfer",
  validateTenant,
  validateTransferDevice,
  validate,
  deviceController.transferDevice
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

// shipping batch and prepare devices
router.post(
  "/shipping-batches",
  validateTenant,
  validateCreateShippingBatch,
  validate,
  deviceController.createShippingBatch
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

// Get a list of all shipping batches
router.get(
  "/shipping-batches",
  validateTenant,
  pagination(),
  validate,
  deviceController.listShippingBatches
);

// Get details of a specific shipping batch
router.get(
  "/shipping-batches/:id",
  validateTenant,
  validateGetShippingBatchDetails,
  validate,
  deviceController.getShippingBatchDetails
);

// Remove devices from a shipping batch
router.delete(
  "/shipping-batches/:id/devices",
  validateTenant,
  validateRemoveDevicesFromBatch,
  validate,
  deviceController.removeDevicesFromShippingBatch
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
