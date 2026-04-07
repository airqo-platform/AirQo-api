const crypto = require("crypto");
const axios = require("axios");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- device-util`);

/**
 * Normalize an IP string for consistent fingerprinting and private-range checks.
 * Strips the ::ffff: prefix from IPv4-mapped IPv6 addresses so that
 * ::ffff:1.2.3.4 and 1.2.3.4 are treated as the same host.
 */
function normalizeIp(ip) {
  if (!ip) return ip;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return mapped ? mapped[1] : ip;
}

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
    const v = /OS (\d+)[_\d]*/.exec(uaString);
    os = v ? `iOS ${v[1]}` : "iOS";
  } else if (/Android/.test(uaString)) {
    const v = /Android (\d+)/.exec(uaString);
    os = v ? `Android ${v[1]}` : "Android";
  } else if (/Mac OS X/.test(uaString)) {
    const v = /Mac OS X (\d+)[_\d]*/.exec(uaString);
    os = v ? `macOS ${v[1]}` : "macOS";
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
 * Compute a stable fingerprint for a device from its user-agent string.
 * Uses only parsed OS (major version), browser family, and device type so the
 * fingerprint survives normal IP rotations and minor UA/version changes.
 * The ip parameter is accepted for API compatibility but not included in the hash.
 * Returns a 32-character hex string.
 */
function computeDeviceFingerprint(ip, userAgent) {
  const { os, browser, deviceType } = parseUserAgent(userAgent);
  return crypto
    .createHash("sha256")
    .update(`${os}:${browser}:${deviceType}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Resolve an approximate city/country string for a given IP address.
 * Requires IP_API_PRO_URL to be set in the environment (an HTTPS-capable
 * geolocation endpoint). Returns null when unconfigured or on any error.
 */
async function getIpLocation(ip) {
  if (!constants.IP_API_PRO_URL) {
    return null;
  }

  const normalized = normalizeIp(ip);

  if (
    !normalized ||
    /^(127\.|::1$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/i.test(normalized) ||
    /^(fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:)/i.test(normalized)
  ) {
    return null;
  }

  try {
    const parsedBase = new URL(constants.IP_API_PRO_URL);
    if (parsedBase.protocol !== "https:") {
      logger.warn("getIpLocation: IP_API_PRO_URL must use https — skipping lookup");
      return null;
    }
    const url = constants.IP_API_PRO_URL.replace("<ip>", normalized);
    const { data } = await axios.get(url, { timeout: 3000 });
    if (data?.status === "success") {
      return [data.city, data.regionName, data.country]
        .filter(Boolean)
        .join(", ") || null;
    }
  } catch (err) {
    logger.debug(`getIpLocation: failed — ${err.message}`);
  }
  return null;
}

/**
 * Extract the real client IP from an Express request.
 * Uses the custom HAProxy headers (x-client-ip, x-client-original-ip) that
 * the infra layer sets — consistent with token.util.js and rate-limit middleware.
 */
function extractIp(request) {
  return (
    request.headers["x-client-ip"] ||
    request.headers["x-client-original-ip"] ||
    null
  );
}

module.exports = {
  parseUserAgent,
  computeDeviceFingerprint,
  getIpLocation,
  extractIp,
};
