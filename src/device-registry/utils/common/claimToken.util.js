// utils/claimToken.util.js
const crypto = require("crypto");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- claim-token-util`);

class ClaimTokenUtil {
  // Generate simple 8-character hex claim token
  static generateClaimToken() {
    return crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase();
    // Output: "A1B2C3D4"
  }

  // Alternative: Generate readable token with words + numbers
  static generateReadableToken() {
    const words = [
      "AIR",
      "QUALITY",
      "MONITOR",
      "SENSOR",
      "DATA",
      "CLEAN",
      "PURE",
      "FRESH",
    ];
    const numbers = crypto
      .randomInt(0, 1000)
      .toString()
      .padStart(3, "0");
    const word = words[crypto.randomInt(0, words.length)];
    return `${word}${numbers}`;
    // Output: "AIR123", "SENSOR456", "CLEAN789"
  }

  // Validate claim token format
  static isValidClaimToken(token) {
    // For hex tokens: 8 hex characters
    return /^[A-F0-9]{8}$/.test(token?.toString() || "");
  }

  // Validate readable token format
  static isValidReadableToken(token) {
    // For readable tokens: WORD + 3 digits
    return /^[A-Z]{3,7}[0-9]{3}$/.test(token?.toString() || "");
  }

  // Generate QR code data for device claiming
  static generateQRCodeData(deviceName, claimToken, frontendUrl) {
    const baseUrl =
      frontendUrl || constants.DEPLOYMENT_URL || "https://platform.airqo.net";

    const url = new URL("/claim-device", baseUrl);
    url.searchParams.append("id", deviceName);
    url.searchParams.append("token", claimToken);

    return {
      device_id: deviceName,
      claim_url: url.toString(),
      platform: "AirQo",
      token: claimToken,
      generated_at: new Date().toISOString(),
    };
  }

  // Generate printable device label data
  static generateDeviceLabelData(deviceName, claimToken, qrCodeData) {
    return {
      device_name: deviceName,
      device_id: deviceName,
      claim_token: claimToken,
      qr_code_data: qrCodeData,
      qr_code_string: JSON.stringify(qrCodeData),
      instructions: [
        "1. Create account at platform.airqo.net",
        "2. Scan QR code or enter Device ID",
        "3. Enter claim token if prompted",
        "4. Deploy device to your location",
      ],
    };
  }
}

module.exports = ClaimTokenUtil;
