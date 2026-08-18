const crypto = require("crypto");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const GroupJoinLinkModel = require("@models/GroupJoinLink");
const AccessRequestModel = require("@models/AccessRequest");
const GroupModel = require("@models/Group");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const groupUtil = require("@utils/group.util");
const { ActivityLogger } = require("@utils/common/activity-logger.util");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- join-link-util`,
);

const isUserAssignedToGroup = (user, grp_id) => {
  if (user && user.group_roles && user.group_roles.length > 0) {
    return user.group_roles.some(
      (assignment) => assignment.group.toString() === grp_id.toString(),
    );
  }
  return false;
};

const joinLinkUtil = {
  createJoinLink: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const { tenant } = request.query;
      const { label, expires_at, max_uses, requires_approval } = request.body;

      const groupExists = await GroupModel(tenant).exists({ _id: grp_id });
      if (!groupExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
        return;
      }

      const token = crypto.randomBytes(32).toString("hex");
      const linkData = {
        group_id: grp_id,
        token,
        created_by: request.user?._id,
      };
      if (label !== undefined) linkData.label = label;
      if (expires_at !== undefined) linkData.expires_at = expires_at;
      if (max_uses !== undefined) linkData.max_uses = max_uses;
      if (requires_approval !== undefined)
        linkData.requires_approval = requires_approval;

      const response = await GroupJoinLinkModel(tenant).register(
        linkData,
        next,
      );

      if (response.success === true) {
        ActivityLogger.logActivity({
          tenant,
          group_id: grp_id,
          activity_type: "JOIN_LINK_CREATED",
          actor: { user_id: request.user?._id, email: request.user?.email },
          details: label ? `Created join link: ${label}` : "Created join link",
        });
      }

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  listJoinLinks: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const { tenant, limit, skip } = request.query;

      const response = await GroupJoinLinkModel(tenant).list(
        {
          filter: { group_id: grp_id, is_active: true },
          limit: limit ? parseInt(limit) : undefined,
          skip: skip ? parseInt(skip) : undefined,
        },
        next,
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  revokeJoinLink: async (request, next) => {
    try {
      const { grp_id, link_id } = request.params;
      const { tenant } = request.query;

      const response = await GroupJoinLinkModel(tenant).modify(
        {
          filter: { _id: link_id, group_id: grp_id },
          update: { is_active: false },
        },
        next,
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  redeemJoinLink: async (request, next) => {
    try {
      const { token } = request.params;
      const { tenant } = request.query;
      const userId = request.user?._id;

      if (!userId) {
        next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to redeem a join link",
          }),
        );
        return;
      }

      const link = await GroupJoinLinkModel(tenant).findOne({ token });
      if (isEmpty(link)) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "This join link does not exist",
          }),
        );
        return;
      }

      if (!link.is_active) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "This join link has been revoked",
          }),
        );
        return;
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "This join link has expired",
          }),
        );
        return;
      }

      if (link.max_uses && link.uses_count >= link.max_uses) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "This join link has reached its maximum number of uses",
          }),
        );
        return;
      }

      const user = await UserModel(tenant).findById(userId).lean();
      if (isEmpty(user)) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "User not found",
          }),
        );
        return;
      }

      if (isUserAssignedToGroup(user, link.group_id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "You are already a member of this group",
          }),
        );
        return;
      }

      if (link.requires_approval === false) {
        const assignmentResult = await groupUtil.assignOneUser(
          {
            params: { grp_id: link.group_id, user_id: userId },
            query: { tenant },
            user: request.user,
          },
          next,
        );

        if (!assignmentResult || assignmentResult.success !== true) {
          return assignmentResult;
        }

        await GroupJoinLinkModel(tenant).modify({
          filter: { _id: link._id },
          update: { $inc: { uses_count: 1 } },
        });

        ActivityLogger.logActivity({
          tenant,
          group_id: link.group_id,
          activity_type: "JOIN_LINK_USED",
          actor: { user_id: userId, email: user.email },
          details: "Joined instantly via join link",
        });

        return {
          success: true,
          message: "You have joined the group",
          status: httpStatus.OK,
          data: assignmentResult.data,
        };
      }

      const accessRequestResponse = await AccessRequestModel(tenant).register(
        {
          user_id: userId,
          email: user.email,
          targetId: link.group_id,
          status: "pending",
          requestType: "group",
          source: "join_link",
          source_link_id: link._id,
        },
        next,
      );

      if (accessRequestResponse.success === true) {
        await GroupJoinLinkModel(tenant).modify({
          filter: { _id: link._id },
          update: { $inc: { uses_count: 1 } },
        });

        ActivityLogger.logActivity({
          tenant,
          group_id: link.group_id,
          activity_type: "JOIN_LINK_USED",
          actor: { user_id: userId, email: user.email },
          details: "Requested to join via join link — pending approval",
        });

        return {
          success: true,
          message:
            "Your request to join has been submitted and is pending approval",
          status: httpStatus.OK,
          data: accessRequestResponse.data,
        };
      }

      return accessRequestResponse;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
};

module.exports = joinLinkUtil;
