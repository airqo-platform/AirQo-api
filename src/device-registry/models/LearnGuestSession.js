const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- learn-guest-session-model`
);

// Word lists + icon set used to give every guest a friendly, anonymous
// identity for leaderboard display instead of exposing their raw guest_id
// (e.g. "guest_lz3k9f2a"). Picked once at session creation and kept for the
// lifetime of the guest session so the name/icon stay stable across requests.
const NAME_ADJECTIVES = [
  "Curious", "Bright", "Swift", "Gentle", "Bold", "Sunny", "Clever", "Calm",
  "Vivid", "Windy", "Misty", "Breezy", "Cosmic", "Cheerful", "Fearless",
];
const NAME_ANIMALS = [
  "Falcon", "Otter", "Panda", "Heron", "Fox", "Koala", "Toucan", "Lynx",
  "Dolphin", "Sparrow", "Badger", "Gazelle", "Owl", "Rabbit", "Wolf",
];
const AVATAR_ICONS = [
  "🦊", "🦦", "🐼", "🦅", "🐨", "🦜", "🐬", "🦉", "🐇", "🦋", "🐸", "🦩",
];

function generateGuestIdentity() {
  const adjective =
    NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const animal = NAME_ANIMALS[Math.floor(Math.random() * NAME_ANIMALS.length)];
  const suffix = Math.floor(Math.random() * 900 + 100); // 3-digit tail avoids collisions reading like real usernames
  const avatar_icon = AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)];
  return { display_name: `${adjective} ${animal} ${suffix}`, avatar_icon };
}

const learnGuestSessionSchema = new Schema(
  {
    device_id: {
      type: String,
      required: [true, "device_id is required"],
      trim: true,
    },
    guest_id: {
      type: String,
      required: [true, "guest_id is required"],
      unique: true,
      trim: true,
    },
    display_name: {
      type: String,
      trim: true,
    },
    avatar_icon: {
      type: String,
      trim: true,
    },
    // Client-chosen name that overrides display_name on the leaderboard once
    // set (e.g. the in-person "stall" quiz flow, where a participant types
    // their own name instead of keeping the random adjective+animal one).
    username: {
      type: String,
      trim: true,
      minlength: 3,
      maxlength: 30,
      default: null,
    },
    // Opaque scope id for one-off quiz events (e.g. a specific forum/stall).
    // Username uniqueness is enforced per event_id, not globally, so the
    // same chosen name can be reused across unrelated events.
    event_id: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    app_version: {
      type: String,
      trim: true,
    },
    platform: {
      type: String,
      enum: ["android", "ios", null],
      default: null,
    },
    linked_user_id: {
      type: String,
      default: null,
    },
    linked_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

learnGuestSessionSchema.index({ device_id: 1 }, { unique: true });
// Scopes username uniqueness to a single event_id (docs without a username
// are excluded via the partial filter so untouched guest sessions never
// collide on this index).
learnGuestSessionSchema.index(
  { event_id: 1, username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: "string" } } }
);

learnGuestSessionSchema.statics = {
  async register(args, next) {
    try {
      const created = await this.create({ ...args });
      if (!isEmpty(created)) {
        return {
          success: true,
          data: created._doc,
          message: "guest session created",
          status: httpStatus.CREATED,
        };
      }
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: "guest session not created despite successful operation",
        })
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(error.keyPattern) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key]) => {
          response[key] = "duplicate value";
          response.message = "duplicate value";
        });
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response.message = value.message;
        });
      }
      next(new HttpError(message, status, response));
    }
  },

  async assertUsernameAvailable({ event_id = null, username, excludeId } = {}) {
    if (typeof username !== "string") return;
    const filter = { event_id: event_id || null, username };
    if (excludeId) filter._id = { $ne: excludeId };
    const clash = await this.findOne(filter).lean();
    if (clash) {
      const error = new Error("this username is already taken for this event");
      error.isUsernameConflict = true;
      throw error;
    }
  },

  async findOrCreate(args, next) {
    try {
      const { device_id, username, event_id } = args;
      const existing = await this.findOne({ device_id }).lean();

      if (existing) {
        const wantsUsernameChange =
          typeof username === "string" && username !== existing.username;
        if (!wantsUsernameChange) {
          return {
            success: true,
            data: existing,
            message: "guest session retrieved",
            status: httpStatus.OK,
          };
        }

        const scopeEventId = event_id !== undefined ? event_id : existing.event_id;
        try {
          await this.assertUsernameAvailable({
            event_id: scopeEventId,
            username,
            excludeId: existing._id,
          });
          const updated = await this.findOneAndUpdate(
            { _id: existing._id },
            { username, ...(event_id !== undefined ? { event_id } : {}) },
            { new: true }
          ).lean();
          return {
            success: true,
            data: updated,
            message: "guest session updated",
            status: httpStatus.OK,
          };
        } catch (updateError) {
          if (updateError.isUsernameConflict || updateError.code === 11000) {
            next(
              new HttpError("Bad Request Error", httpStatus.CONFLICT, {
                username: "this username is already taken for this event",
              })
            );
            return;
          }
          throw updateError;
        }
      }

      const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const guest_id = `guest_${suffix}`;
      const { display_name, avatar_icon } = generateGuestIdentity();

      try {
        await this.assertUsernameAvailable({ event_id, username });

        const created = await this.create({
          ...args,
          guest_id,
          display_name,
          avatar_icon,
        });
        return {
          success: true,
          data: created._doc,
          message: "guest session created",
          status: httpStatus.CREATED,
        };
      } catch (createError) {
        if (createError.isUsernameConflict) {
          next(
            new HttpError("Bad Request Error", httpStatus.CONFLICT, {
              username: "this username is already taken for this event",
            })
          );
          return;
        }
        if (createError.code === 11000) {
          if (createError.keyPattern && createError.keyPattern.username) {
            next(
              new HttpError("Bad Request Error", httpStatus.CONFLICT, {
                username: "this username is already taken for this event",
              })
            );
            return;
          }
          // Concurrent request won the device_id race — re-fetch and return the winner's doc
          const race = await this.findOne({ device_id }).lean();
          if (race) {
            return {
              success: true,
              data: race,
              message: "guest session retrieved",
              status: httpStatus.OK,
            };
          }
        }
        throw createError;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  async modify({ filter = {}, update = {}, opts = { new: true } } = {}, next) {
    try {
      const modifiedUpdate = { ...update };
      delete modifiedUpdate._id;
      const updated = await this.findOneAndUpdate(filter, modifiedUpdate, opts);
      if (!isEmpty(updated)) {
        return {
          success: true,
          data: updated._doc,
          message: "successfully modified the guest session",
          status: httpStatus.OK,
        };
      }
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "No guest session found for this operation",
        })
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
};

const LearnGuestSessionModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("learnguestsessions");
  } catch (error) {
    return getModelByTenant(
      dbTenant,
      "learnguestsession",
      learnGuestSessionSchema
    );
  }
};

LearnGuestSessionModel.AVATAR_ICONS = AVATAR_ICONS;

module.exports = LearnGuestSessionModel;
