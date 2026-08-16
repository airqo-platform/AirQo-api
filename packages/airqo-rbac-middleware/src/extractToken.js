/**
 * Extract the raw API token from an Authorization header in the
 * "JWT <token>" format (the AirQo convention — not a Bearer scheme).
 */
const extractToken = (req) => {
  const auth = (req.headers && req.headers["authorization"]) || "";
  const match = auth.match(/^JWT\s+(\S+)/i);
  return match ? match[1] : null;
};

module.exports = { extractToken };
