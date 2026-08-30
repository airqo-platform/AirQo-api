/**
 * identity-headers.util.js
 *
 * Attaches identity/group-membership response headers to the two endpoints
 * the nginx gateway's `auth_request /auth` subrequest calls
 * (POST /api/v2/users/verify and GET /api/v2/tokens/:token/verify).
 *
 * nginx captures these via auth_request_set + proxy_set_header and forwards
 * them, unspoofable, to backend services (see the global-config.yaml files
 * under k8s/nginx). This is the ONLY place user/group data is resolved —
 * backend services never call auth-service themselves and never store this
 * data; they just read the headers nginx attaches to the current request.
 *
 * This response is only ever read by nginx's internal subrequest, never
 * returned to a browser, so no Access-Control-Expose-Headers is needed.
 */

const GroupModel = require("@models/Group");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- identity-headers-util`,
);

/**
 * Resolve a user's group_roles into grp_title strings and set them, along
 * with the user id, as response headers.
 *
 * Never throws — a lookup failure just means no group headers are attached
 * (the caller still gets their normal 200/verify response either way).
 */
const attachIdentityHeaders = async (res, user, tenant) => {
  try {
    if (!user || !user._id) return;

    res.set("X-Auth-User-Id", String(user._id));

    const groupIds = (user.group_roles || [])
      .map((gr) => gr && gr.group)
      .filter(Boolean);

    if (groupIds.length === 0) {
      res.set("X-Auth-User-Groups", "");
      return;
    }

    const groups = await GroupModel(tenant)
      .find({ _id: { $in: groupIds } })
      .select("grp_title")
      .lean();

    const groupTitles = groups.map((g) => g.grp_title).filter(Boolean);
    res.set("X-Auth-User-Groups", groupTitles.join(","));
  } catch (error) {
    logger.warn(
      `Non-critical: attachIdentityHeaders failed (headers omitted): ${error.message}`,
    );
  }
};

module.exports = { attachIdentityHeaders };
