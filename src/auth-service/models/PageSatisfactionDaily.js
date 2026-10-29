const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- page-satisfaction-daily-model`,
);

/**
 * One document per (tenant, app, platform, page, UTC day). Page-satisfaction
 * ratings are not stored as individual Feedback items — the submission is
 * emailed to support and only these pre-aggregated counters are kept, written
 * with $inc upserts so the collection grows with active page-days, never with
 * submission volume. No submitter email or message text is stored here.
 *
 *  ratings       { "<1-5>": count }   (sparse)
 *  migrated_ids  ids of legacy Feedback items folded in by
 *                page-satisfaction-migration-job; guards against double counts
 */
const PageSatisfactionDailySchema = new Schema(
  {
    tenant: { type: String, required: true, lowercase: true, trim: true },
    // Page label derived from the submission subject, e.g.
    // "CSIR International Convention Center".
    page: { type: String, required: true, trim: true, maxlength: 200 },
    app: { type: String, default: "unknown", trim: true },
    platform: { type: String, default: "web", trim: true },
    // "YYYY-MM-DD" (UTC). Lexically sortable, so range queries stay simple.
    day: { type: String, required: true },
    submissions: { type: Number, default: 0 },
    rated_count: { type: Number, default: 0 },
    rating_sum: { type: Number, default: 0 },
    ratings: { type: Schema.Types.Mixed, default: undefined },
    with_message: { type: Number, default: 0 },
    with_screenshot: { type: Number, default: 0 },
    first_at: { type: Date },
    last_at: { type: Date },
    migrated_ids: { type: [Schema.Types.ObjectId], default: undefined },
  },
  { timestamps: false },
);

PageSatisfactionDailySchema.index(
  { tenant: 1, app: 1, platform: 1, page: 1, day: 1 },
  { unique: true },
);
PageSatisfactionDailySchema.index({ tenant: 1, day: 1 });

const toDay = (date) => date.toISOString().slice(0, 10);

const buildKey = ({ tenant, app, platform, page, at }) => ({
  tenant,
  app: isEmpty(app) ? "unknown" : app,
  platform: isEmpty(platform) ? "web" : platform,
  page,
  day: toDay(at),
});

const buildUpdate = ({ rating, hasMessage, hasScreenshot, at }) => {
  const inc = {
    submissions: 1,
    with_message: hasMessage ? 1 : 0,
    with_screenshot: hasScreenshot ? 1 : 0,
  };
  const numericRating = Number(rating);
  if (Number.isInteger(numericRating) && numericRating >= 1 && numericRating <= 5) {
    inc.rated_count = 1;
    inc.rating_sum = numericRating;
    inc[`ratings.${numericRating}`] = 1;
  }
  return { $inc: inc, $min: { first_at: at }, $max: { last_at: at } };
};

const round = (value, places = 2) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? null
    : Number(value.toFixed(places));

// Sums the counters of a group of daily docs into one shape.
const COUNTER_GROUP = {
  submissions: { $sum: "$submissions" },
  rated_count: { $sum: "$rated_count" },
  rating_sum: { $sum: "$rating_sum" },
  r1: { $sum: { $ifNull: ["$ratings.1", 0] } },
  r2: { $sum: { $ifNull: ["$ratings.2", 0] } },
  r3: { $sum: { $ifNull: ["$ratings.3", 0] } },
  r4: { $sum: { $ifNull: ["$ratings.4", 0] } },
  r5: { $sum: { $ifNull: ["$ratings.5", 0] } },
  with_message: { $sum: "$with_message" },
  with_screenshot: { $sum: "$with_screenshot" },
  first_at: { $min: "$first_at" },
  last_at: { $max: "$last_at" },
};

const shapeCounters = (row = {}) => {
  const rated = row.rated_count || 0;
  const positive = (row.r4 || 0) + (row.r5 || 0);
  const negative = (row.r1 || 0) + (row.r2 || 0);
  return {
    submissions: row.submissions || 0,
    rated_count: rated,
    average_rating: rated ? round(row.rating_sum / rated) : null,
    distribution: {
      1: row.r1 || 0,
      2: row.r2 || 0,
      3: row.r3 || 0,
      4: row.r4 || 0,
      5: row.r5 || 0,
    },
    // Share of rated submissions scoring 4-5 / 1-2, as percentages.
    satisfaction_rate: rated ? round((positive / rated) * 100, 1) : null,
    dissatisfaction_rate: rated ? round((negative / rated) * 100, 1) : null,
    // Net score in the style of NPS: % satisfied minus % dissatisfied.
    net_satisfaction: rated
      ? round(((positive - negative) / rated) * 100, 1)
      : null,
    with_message: row.with_message || 0,
    with_screenshot: row.with_screenshot || 0,
    first_at: row.first_at || null,
    last_at: row.last_at || null,
  };
};

PageSatisfactionDailySchema.statics = {
  async record({
    tenant,
    page,
    app,
    platform,
    rating,
    hasMessage,
    hasScreenshot,
    at = new Date(),
  }) {
    try {
      const data = await this.findOneAndUpdate(
        buildKey({ tenant, app, platform, page, at }),
        buildUpdate({ rating, hasMessage, hasScreenshot, at }),
        { upsert: true, new: true, lean: true },
      ).exec();
      return { success: true, data };
    } catch (err) {
      logger.error(`record failed: ${err.message}`);
      return { success: false, message: err.message };
    }
  },

  // Folds one legacy Feedback item into the counters exactly once. The
  // `migrated_ids: { $ne }` guard means a re-run matches nothing and the
  // upsert collides with the unique key instead of counting the item twice.
  async recordLegacy({ sourceId, ...args }) {
    const at = args.at || new Date();
    const update = buildUpdate({ ...args, at });
    update.$push = { migrated_ids: sourceId };
    try {
      await this.findOneAndUpdate(
        { ...buildKey({ ...args, at }), migrated_ids: { $ne: sourceId } },
        update,
        { upsert: true, new: true, lean: true },
      ).exec();
      return { success: true, alreadyCounted: false };
    } catch (err) {
      if (err && err.code === 11000) {
        return { success: true, alreadyCounted: true };
      }
      logger.error(`recordLegacy failed for ${sourceId}: ${err.message}`);
      return { success: false, message: err.message };
    }
  },

  // Aggregates the daily counters for the admin stats endpoint.
  async summarize({ match = {}, topLimit = 5, minRatingsForRanking = 3 } = {}) {
    const [result] = await this.aggregate([
      { $match: match },
      {
        $facet: {
          overall: [{ $group: { _id: null, ...COUNTER_GROUP } }],
          by_app: [
            { $group: { _id: "$app", ...COUNTER_GROUP } },
            { $sort: { submissions: -1 } },
          ],
          by_platform: [
            { $group: { _id: "$platform", ...COUNTER_GROUP } },
            { $sort: { submissions: -1 } },
          ],
          by_page: [
            { $group: { _id: { page: "$page", app: "$app" }, ...COUNTER_GROUP } },
          ],
          daily: [
            { $group: { _id: "$day", ...COUNTER_GROUP } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]).exec();

    const pages = (result.by_page || []).map((row) => ({
      page: row._id.page,
      app: row._id.app,
      ...shapeCounters(row),
    }));
    const ranked = pages.filter((p) => p.rated_count >= minRatingsForRanking);

    return {
      ...shapeCounters((result.overall || [])[0]),
      pages_tracked: pages.length,
      top_pages: [...pages]
        .sort((a, b) => b.submissions - a.submissions)
        .slice(0, topLimit),
      best_rated_pages: [...ranked]
        .sort((a, b) => b.average_rating - a.average_rating || b.rated_count - a.rated_count)
        .slice(0, topLimit),
      lowest_rated_pages: [...ranked]
        .sort((a, b) => a.average_rating - b.average_rating || b.rated_count - a.rated_count)
        .slice(0, topLimit),
      by_app: (result.by_app || []).map((row) => ({
        app: row._id,
        ...shapeCounters(row),
      })),
      by_platform: (result.by_platform || []).map((row) => ({
        platform: row._id,
        ...shapeCounters(row),
      })),
      daily: (result.daily || []).map((row) => {
        const shaped = shapeCounters(row);
        return {
          day: row._id,
          submissions: shaped.submissions,
          rated_count: shaped.rated_count,
          average_rating: shaped.average_rating,
          satisfaction_rate: shaped.satisfaction_rate,
        };
      }),
      ranking_min_ratings: minRatingsForRanking,
    };
  },
};

const PageSatisfactionDailyModel = (tenant) =>
  getModelByTenant(
    isEmpty(tenant) ? constants.DEFAULT_TENANT || "airqo" : tenant,
    "page_satisfaction_daily",
    PageSatisfactionDailySchema,
  );

// "Page Satisfaction: CSIR International Convention Center" → page label.
const PAGE_SATISFACTION_SUBJECT_PREFIX = /^\s*page\s+satisfaction\s*[:\-–]\s*/i;
PageSatisfactionDailyModel.pageFromSubject = (subject) =>
  (subject || "").replace(PAGE_SATISFACTION_SUBJECT_PREFIX, "").trim().slice(0, 200) ||
  "unknown";

module.exports = PageSatisfactionDailyModel;
