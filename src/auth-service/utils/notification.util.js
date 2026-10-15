const NotificationModel = require("@models/Notification");
const UserModel = require("@models/User");
const GroupModel = require("@models/Group");
const crypto = require("crypto");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- notification-util`,
);

const INSERT_BATCH_SIZE = 1000;

const internalError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error ${error.message}`);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: error.message,
    }),
  );
};

const buildNotificationDoc = (user_id, payload) => {
  const doc = {
    user_id,
    category: payload.category,
    event: payload.event,
    title: payload.title,
    message: payload.message,
    link: payload.link,
    priority: payload.priority,
    group_id: payload.group_id,
    sender_id: payload.sender_id,
    broadcast_id: payload.broadcast_id,
    metadata: payload.metadata,
    expires_at: payload.expires_at,
  };
  // Drop unset fields so schema defaults (category, priority, expiry) apply.
  Object.keys(doc).forEach((key) => doc[key] === undefined && delete doc[key]);
  return doc;
};

const insertInBatches = async (tenant, userIds, payload) => {
  let insertedCount = 0;
  for (let i = 0; i < userIds.length; i += INSERT_BATCH_SIZE) {
    const docs = userIds
      .slice(i, i + INSERT_BATCH_SIZE)
      .map((id) => buildNotificationDoc(id, payload));
    const result = await NotificationModel(tenant).createMany(docs);
    if (result && result.success === true) {
      insertedCount += result.data.insertedCount;
    } else {
      logger.error(
        `Failed to insert notification batch ${i / INSERT_BATCH_SIZE}: ${
          result && result.message
        }`,
      );
    }
  }
  return insertedCount;
};

// Streams recipients from a cursor so an "everyone" broadcast never loads
// the full user list into memory.
const insertFromCursor = async (tenant, cursor, payload) => {
  let insertedCount = 0;
  let batch = [];
  for await (const user of cursor) {
    batch.push(user._id);
    if (batch.length >= INSERT_BATCH_SIZE) {
      insertedCount += await insertInBatches(tenant, batch, payload);
      batch = [];
    }
  }
  if (batch.length > 0) {
    insertedCount += await insertInBatches(tenant, batch, payload);
  }
  return insertedCount;
};

const pickPayload = (body) => ({
  category: body.category,
  event: body.event,
  title: body.title,
  message: body.message,
  link: body.link,
  priority: body.priority,
  metadata: body.metadata,
  expires_at: body.expires_at,
});

const notification = {
  /**
   * Internal entry point for other utils (e.g. access requests). Best-effort:
   * it never throws, so a notification failure can't break the caller's flow.
   */
  notifyUsers: async ({ tenant, user_ids = [], ...payload } = {}) => {
    try {
      const uniqueIds = [
        ...new Set(
          user_ids.filter((id) => !isEmpty(id)).map((id) => id.toString()),
        ),
      ];
      if (uniqueIds.length === 0) {
        return { success: true, data: { insertedCount: 0 } };
      }
      const insertedCount = await insertInBatches(tenant, uniqueIds, payload);
      return { success: true, data: { insertedCount } };
    } catch (error) {
      logger.error(`Non-critical: failed to create notifications -- ${error.message}`);
      return { success: false, message: error.message };
    }
  },

  list: async (request, next) => {
    try {
      const { query, user } = request;
      const { tenant, limit, skip, read, category } = query;

      const filter = { user_id: user._id };
      if (read === "true" || read === "false") {
        filter.read = read === "true";
      }
      if (!isEmpty(category)) {
        filter.category = category;
      }

      return await NotificationModel(tenant).list({ filter, limit, skip });
    } catch (error) {
      internalError(error, next);
    }
  },

  getUnreadCount: async (request, next) => {
    try {
      const { query, user } = request;
      return await NotificationModel(query.tenant).countUnread({
        user_id: user._id,
      });
    } catch (error) {
      internalError(error, next);
    }
  },

  markRead: async (request, next) => {
    try {
      const { query, params, user } = request;
      // Scoping by user_id means a user can only touch their own notifications.
      return await NotificationModel(query.tenant).markRead({
        filter: { _id: params.notification_id, user_id: user._id },
      });
    } catch (error) {
      internalError(error, next);
    }
  },

  markAllRead: async (request, next) => {
    try {
      const { query, user } = request;
      return await NotificationModel(query.tenant).markAllRead({
        user_id: user._id,
      });
    } catch (error) {
      internalError(error, next);
    }
  },

  delete: async (request, next) => {
    try {
      const { query, params, user } = request;
      return await NotificationModel(query.tenant).remove({
        filter: { _id: params.notification_id, user_id: user._id },
      });
    } catch (error) {
      internalError(error, next);
    }
  },

  sendToGroup: async (request, next) => {
    try {
      const { query, params, body, user } = request;
      const { tenant } = query;
      const { grp_id } = params;

      const group = await GroupModel(tenant)
        .findById(grp_id)
        .select("_id grp_title")
        .lean();
      if (isEmpty(group)) {
        return {
          success: false,
          message: "Group not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Group ${grp_id} does not exist` },
        };
      }

      const members = await UserModel(tenant)
        .find({ "group_roles.group": grp_id })
        .select("_id")
        .lean();

      const broadcast_id = crypto.randomUUID();
      const insertedCount = await insertInBatches(
        tenant,
        members.map((m) => m._id),
        {
          ...pickPayload(body),
          category: body.category || "announcement",
          group_id: group._id,
          sender_id: user._id,
          broadcast_id,
        },
      );

      return {
        success: true,
        message: `Notification sent to ${insertedCount} member(s) of ${group.grp_title}`,
        status: httpStatus.CREATED,
        data: {
          broadcast_id,
          group_id: group._id,
          recipients: members.length,
          delivered: insertedCount,
        },
      };
    } catch (error) {
      internalError(error, next);
    }
  },

  broadcast: async (request, next) => {
    try {
      const { query, body, user } = request;
      const { tenant } = query;
      const { audience, user_ids } = body;

      const broadcast_id = crypto.randomUUID();
      const payload = {
        ...pickPayload(body),
        category: body.category || "announcement",
        sender_id: user._id,
        broadcast_id,
      };

      if (audience === "users") {
        const recipients = await UserModel(tenant)
          .find({ _id: { $in: user_ids } })
          .select("_id")
          .lean();
        const insertedCount = await insertInBatches(
          tenant,
          recipients.map((r) => r._id),
          payload,
        );
        return {
          success: true,
          message: `Notification sent to ${insertedCount} user(s)`,
          status: httpStatus.CREATED,
          data: {
            broadcast_id,
            audience,
            recipients: recipients.length,
            delivered: insertedCount,
            not_found: user_ids.length - recipients.length,
          },
        };
      }

      // audience === "all": only verified accounts can sign in to see it.
      const allUsersFilter = { verified: true };
      const recipients = await UserModel(tenant).countDocuments(allUsersFilter);

      // Fan-out runs in the background so a large audience can't hold the
      // request open past the gateway timeout.
      const cursor = UserModel(tenant)
        .find(allUsersFilter)
        .select("_id")
        .lean()
        .cursor();
      insertFromCursor(tenant, cursor, payload)
        .then((insertedCount) =>
          logger.info(
            `Broadcast ${broadcast_id} delivered to ${insertedCount}/${recipients} users`,
          ),
        )
        .catch((error) =>
          logger.error(
            `🐛🐛 Broadcast ${broadcast_id} failed part-way -- ${error.message}`,
          ),
        );

      return {
        success: true,
        message: `Broadcast queued for ${recipients} user(s)`,
        status: httpStatus.ACCEPTED,
        data: { broadcast_id, audience, recipients },
      };
    } catch (error) {
      internalError(error, next);
    }
  },
};

module.exports = notification;
