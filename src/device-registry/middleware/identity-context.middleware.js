/**
 * identity-context.middleware.js
 *
 * Reads the X-Auth-User-Id / X-Auth-User-Groups headers the nginx gateway
 * attaches after calling auth-service's verify endpoint (see
 * identity-headers.util.js in auth-service and the location-snippets in
 * k8s/nginx/*\/global-config.yaml). proxy_set_header on the gateway side
 * always overwrites whatever a client sent for these header names, so they
 * cannot be spoofed by a direct caller.
 *
 * device-registry never calls auth-service and never stores this data — it
 * only reads what the gateway has already attached to the current request,
 * for the lifetime of that request.
 */

const attachIdentityContext = (req, res, next) => {
  const userId = req.headers["x-auth-user-id"] || null;
  const groupsHeader = req.headers["x-auth-user-groups"] || "";
  const groups = groupsHeader
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  req.identity = { userId, groups };
  next();
};

module.exports = { attachIdentityContext };
