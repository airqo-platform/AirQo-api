const express = require("express");
const router = express.Router();
const deviceController = require("@controllers/device.controller");
const { validatePagination, headers } = require("@middleware/common");
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
} = require("@validators/device.validators");

router.use(headers);
router.use(validatePagination);

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
router.get("/count", validateTenant, deviceController.getDevicesCount);

// List devices route
router.get("/", validateTenant, validateListDevices, deviceController.list);

// List devices summary route
router.get(
  "/summary",
  validateTenant,
  validateListDevices,
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
  deviceController.generateQRCode
);

// New Bulk Update Devices route
router.put(
  "/bulk",
  validateTenant,
  validateBulkUpdateDevices,
  deviceController.updateManyDevicesOnPlatform
);
module.exports = router;
