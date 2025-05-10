const express = require("express");
const router = express.Router();
const authMiddleware = require("@middleware/auth.middleware");
const resourceFilterMiddleware = require("@middleware/resource-filter.middleware");
const deviceController = require("@controllers/device.controller");
const { headers, pagination } = require("@validators/common");
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
} = require("@validators/device.validators");

const { validate } = require("@validators/common");

router.use(headers);
router.use(authMiddleware);
router.use(resourceFilterMiddleware);

// Decrypt key route
router.post(
  "/decrypt",
  validateTenant,
  validateDecryptKeys,
  deviceController.decryptKey
);

// Decrypt bulk keys route
router.post(
  "/decrypt/bulk",
  validateTenant,
  validateArrayBody,
  validateDecryptManyKeys,
  deviceController.decryptManyKeys
);

// Encrypt keys route
router.put(
  "/encrypt",
  validateTenant,
  validateDeviceIdentifier,
  validateEncryptKeys,
  deviceController.encryptKeys
);

// Get devices count route
router.get(
  "/count",
  validateTenant,
  pagination(),
  deviceController.getDevicesCount
);

// List devices route
router.get(
  "/",
  validateTenant,
  validateListDevices,
  pagination(),
  // authMiddleware,
  // resourceFilterMiddleware,
  deviceController.list
);

// List devices summary route
router.get(
  "/summary",
  validateTenant,
  validateListDevices,
  pagination(),
  // authMiddleware,
  // resourceFilterMiddleware,
  deviceController.listSummary
);

// Create device route
router.post("/", validateTenant, validateCreateDevice, deviceController.create);

// Delete device route
router.delete(
  "/",
  validateTenant,
  validateDeviceIdentifier,
  deviceController.delete
);

// Update device route
router.put(
  "/",
  validateTenant,
  validateDeviceIdentifier,
  validateUpdateDevice,
  deviceController.update
);

// Refresh device route
router.put(
  "/refresh",
  validateTenant,
  validateDeviceIdentifier,
  deviceController.refresh
);

// List devices by nearest coordinates route
router.get(
  "/by/nearest-coordinates",
  validateTenant,
  pagination(),
  deviceController.listAllByNearestCoordinates
);

// Soft create device route
router.post(
  "/soft",
  validateTenant,
  validateCreateDevice,
  deviceController.createOnPlatform
);

// Soft delete device route
router.delete(
  "/soft",
  validateTenant,
  validateDeviceIdentifier,
  deviceController.deleteOnPlatform
);

// Soft update device route
router.put(
  "/soft",
  validateTenant,
  validateDeviceIdentifier,
  validateUpdateDevice,
  deviceController.updateOnPlatform
);

// Generate QR code route
router.get(
  "/qrcode",
  validateTenant,
  validateDeviceIdentifier,
  pagination(),
  deviceController.generateQRCode
);

// New Bulk Update Devices route
router.put(
  "/bulk",
  validateTenant,
  validateBulkUpdateDevices,
  deviceController.updateManyDevicesOnPlatform
);

router.get(
  "/:id",
  validateTenant,
  validateDeviceIdParam,
  validate,
  deviceController.getDeviceDetailsById
);
module.exports = router;
