const crypto = require("crypto");
const axios = require("axios");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- device-util`);

/**
 * Parse OS, browser, and device type from a raw user-agent string.
 * Intentionally avoids a third-party UA parser to keep dependencies lean.
 */
function parseUserAgent(uaString) {
  if (!uaString) {
    return { os: "Unknown OS", browser: "Unknown Browser", deviceType: "Unknown" };
  }

  // --- OS detection ---
  let os = "Unknown OS";
  if (/Windows NT 10/.test(uaString)) os = "Windows 10/11";
  else if (/Windows NT 6\.3/.test(uaString)) os = "Windows 8.1";
  else if (/Windows NT 6\.1/.test(uaString)) os = "Windows 7";
  else if (/Windows/.test(uaString)) os = "Windows";
  else if (/iPhone|iPad/.test(uaString)) {
    const v = /OS (\d+[_\d]*)/.exec(uaString);
    os = v ? `iOS ${v[1].replace(/_/g, ".")}` : "iOS";
  } else if (/Android/.test(uaString)) {
    const v = /Android ([\d.]+)/.exec(uaString);
    os = v ? `Android ${v[1]}` : "Android";
  } else if (/Mac OS X/.test(uaString)) {
    const v = /Mac OS X ([\d_]+)/.exec(uaString);
    os = v ? `macOS ${v[1].replace(/_/g, ".")}` : "macOS";
  } else if (/Linux/.test(uaString)) {
    os = "Linux";
  } else if (/CrOS/.test(uaString)) {
    os = "ChromeOS";
  }

  // --- Browser detection (order matters — Edge/OPR must come before Chrome) ---
  let browser = "Unknown Browser";
  if (/Edg\//.test(uaString)) browser = "Microsoft Edge";
  else if (/OPR\/|Opera/.test(uaString)) browser = "Opera";
  else if (/SamsungBrowser/.test(uaString)) browser = "Samsung Browser";
  else if (/Chrome\//.test(uaString)) browser = "Chrome";
  else if (/Firefox\//.test(uaString)) browser = "Firefox";
  else if (/Safari\//.test(uaString)) browser = "Safari";
  else if (/MSIE|Trident/.test(uaString)) browser = "Internet Explorer";

  // --- Device type ---
  let deviceType = "Desktop";
  if (/iPad|Tablet/.test(uaString)) deviceType = "Tablet";
  else if (/Mobile/.test(uaString)) deviceType = "Mobile";

  return { os, browser, deviceType };
}

/**
 * Compute a stable fingerprint for a device from its IP and user-agent.
 * Returns a 32-character hex string.
 */
function computeDeviceFingerprint(ip, userAgent) {
  return crypto
    .createHash("sha256")
    .update(`${ip || "unknown"}:${userAgent || "unknown"}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Resolve an approximate city/country string for a given IP address.
 * Uses the free ip-api.com endpoint with a 3-second timeout.
 * Returns null on any error or for private/loopback addresses.
 */
async function getIpLocation(ip) {
  if (
    !ip ||
    /^(127\.|::1$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::ffff:)/i.test(ip) ||
    /^(fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:)/i.test(ip)
  ) {
    return null;
  }

  try {
    const { data } = await axios.get(
      `http://ip-api.com/json/${ip}?fields=status,city,regionName,country`,
      { timeout: 3000 }
    );
    if (data?.status === "success") {
      return [data.city, data.regionName, data.country]
        .filter(Boolean)
        .join(", ") || null;
    }
  } catch (err) {
    logger.debug(`getIpLocation: failed for ${ip} — ${err.message}`);
  }
  return null;
}

/**
 * Extract the real client IP from an Express request.
 * Relies on Express's request.ip which respects the app's `trust proxy`
 * setting — that is the correct place to configure proxy trust, not here.
 */
function extractIp(request) {
  return request.ip || request.connection?.remoteAddress || null;
}

module.exports = {
  parseUserAgent,
  computeDeviceFingerprint,
  getIpLocation,
  extractIp,
};
