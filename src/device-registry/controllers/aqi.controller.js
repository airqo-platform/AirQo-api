// aqi.controller.js
const httpStatus = require("http-status");
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");
const aqiUtil = require("@utils/aqi.util");
const SystemConfigModel = require("@models/SystemConfig");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- aqi-controller`);
const {
  runAqiCategoryBackfillJob,
} = require("@bin/jobs/aqi-category-backfill-job");

const resolveTenant = (req) => {
  const tenant = req.query.tenant;
  return isEmpty(tenant) ? constants.DEFAULT_TENANT || "airqo" : tenant;
};

const resolvePollutant = (req) => {
  const pollutant = req.query.pollutant;
  return isEmpty(pollutant) ? aqiUtil.DEFAULT_POLLUTANT : pollutant;
};

// Fire-and-forget — reconciles already-stored readings'/signals' aqi_category
// etc. against the config that was just written, so they stop looking stale
// promptly rather than waiting for the daily safety-net schedule. Never
// awaited from the request handler: the backfill can take longer than an
// HTTP request should, and a failure here must not fail the PUT/DELETE that
// already succeeded.
//
// PM2.5-only: aqi_category/aqi_index/aqi_color on Reading/Signal documents
// are computed exclusively from pm2_5 at ingestion (see models/Event.js,
// bin/jobs/store-readings-job.js) — there is no per-reading PM10 (or other
// pollutant) category to backfill, so this is skipped for any other
// pollutant's range override.
function triggerAqiCategoryBackfill(tenant) {
  runAqiCategoryBackfillJob(tenant).catch((error) => {
    logger.error(
      `🐛🐛 aqi-category-backfill trigger failed: ${error.message}`
    );
  });
}

const aqiController = {
  listRanges: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const tenant = resolveTenant(req);
      const pollutant = resolvePollutant(req);
      const resolved = await aqiUtil.resolveActiveAqiRanges(tenant, pollutant);
      const result = aqiUtil.listRanges(resolved, pollutant);

      res.status(httpStatus.OK).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  updateRanges: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const tenant = resolveTenant(req);
      const pollutant = resolvePollutant(req);
      const value = { ranges: buildRangesWithDerivedMin(req.body.ranges) };

      await SystemConfigModel(tenant).upsert(
        aqiUtil.getAqiRangesConfigKey(pollutant),
        value,
        req.body.updated_by || null
      );
      // Invalidate after the write succeeds, not before, so a concurrent
      // read can't be caught between an invalidated cache and the new value
      // actually landing in Mongo.
      aqiUtil.invalidateAqiRangesCache(tenant, pollutant);
      if (pollutant === aqiUtil.DEFAULT_POLLUTANT) {
        triggerAqiCategoryBackfill(tenant);
      }

      const resolved = await aqiUtil.resolveActiveAqiRanges(tenant, pollutant);
      const result = aqiUtil.listRanges(resolved, pollutant);

      res.status(httpStatus.OK).json({
        success: true,
        message: "Successfully updated AQI ranges",
        data: result.data,
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  deleteRanges: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const tenant = resolveTenant(req);
      const pollutant = resolvePollutant(req);
      await SystemConfigModel(tenant).deleteOne({
        key: aqiUtil.getAqiRangesConfigKey(pollutant),
      });
      aqiUtil.invalidateAqiRangesCache(tenant, pollutant);
      if (pollutant === aqiUtil.DEFAULT_POLLUTANT) {
        triggerAqiCategoryBackfill(tenant);
      }

      const resolved = await aqiUtil.resolveActiveAqiRanges(tenant, pollutant);
      const result = aqiUtil.listRanges(resolved, pollutant);

      res.status(httpStatus.OK).json({
        success: true,
        message: "Successfully reverted AQI ranges to defaults",
        data: result.data,
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

// good.min_value is always 0; every other category's min_value is the
// previous category's max_value. Derived server-side rather than accepted
// from the caller — see the "min_value not accepted" note in aqi.validators.js.
function buildRangesWithDerivedMin(ranges) {
  let prevMax = 0;
  return ranges.map((range, index) => {
    const min_value = index === 0 ? 0 : prevMax;
    prevMax = range.max_value;
    return {
      key: range.key,
      label: range.label,
      min_value,
      max_value: range.max_value,
      color: range.color.replace(/^#/, ""), // stored bare, listRanges() re-adds the #
      color_name: range.color_name || null,
    };
  });
}

module.exports = aqiController;
