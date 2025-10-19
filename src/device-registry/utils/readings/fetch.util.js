const EventModel = require("@models/Event");
const ReadingModel = require("@models/Reading");
const { logText, logObject } = require("@utils/shared");
const {
  determineCollectionRoute,
  convertEventsFilterToReadingsFilter,
} = require("./routing.util");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- fetch-util`);

/**
 * Intelligent fetch that routes to Readings or Events based on query
 * @param {String} tenant - Tenant identifier
 * @param {Object} filter - Query filter in Events format
 * @param {Number} limit - Result limit
 * @param {Number} skip - Records to skip
 * @param {Number} page - Page number (optional)
 * @returns {Object} - Response in Events format
 */
async function intelligentFetch(
  tenant,
  filter,
  limit = 1000,
  skip = 0,
  page = null
) {
  try {
    const route = determineCollectionRoute(filter);

    logText(
      `📍 API Query Routing: ${route.useReadings ? "Readings" : "Events"} - ${
        route.reason
      }`
    );

    if (route.useReadings) {
      return await fetchFromReadings(tenant, filter, limit, skip, page);
    } else {
      return await fetchFromEvents(tenant, filter, limit, skip, page);
    }
  } catch (error) {
    logText(`⚠️ Routing error, falling back to Events: ${error.message}`);
    return await fetchFromEvents(tenant, filter, limit, skip, page);
  }
}

/**
 * Fetch from Readings collection (optimized for recent data)
 */
async function fetchFromReadings(
  tenant,
  eventsFilter,
  limit = 1000,
  skip = 0,
  page = null
) {
  try {
    const readingsFilter = convertEventsFilterToReadingsFilter(eventsFilter);

    const { metadata, active, internal, brief } = eventsFilter;

    logObject("Readings filter", readingsFilter);
    logText(`Using limit: ${limit}, skip: ${skip}`);

    const pipeline = [];

    pipeline.push({ $match: readingsFilter });

    if (active === "yes") {
      pipeline.push({
        $lookup: {
          from: "devices",
          localField: "device_id",
          foreignField: "_id",
          as: "device_check",
        },
      });
      pipeline.push({
        $match: { "device_check.isActive": true },
      });
    }

    if (internal !== "yes") {
      pipeline.push({
        $lookup: {
          from: "devices",
          localField: "device_id",
          foreignField: "_id",
          as: "device_for_cohort",
        },
      });
      pipeline.push({
        $lookup: {
          from: "cohorts",
          localField: "device_for_cohort.cohorts",
          foreignField: "_id",
          as: "cohort_check",
        },
      });
      pipeline.push({
        $match: { "cohort_check.visibility": { $ne: false } },
      });
    }

    let groupBy = null;
    if (eventsFilter.recent === "yes" || !eventsFilter.recent) {
      if (metadata === "site_id" || metadata === "site") {
        groupBy = "$site_id";
      } else if (metadata === "device_id") {
        groupBy = "$device_id";
      } else {
        groupBy = "$device";
      }

      pipeline.push(
        { $sort: { time: -1 } },
        {
          $group: {
            _id: groupBy,
            doc: { $first: "$$ROOT" },
          },
        },
        { $replaceRoot: { newRoot: "$doc" } }
      );
    } else {
      pipeline.push({ $sort: { time: -1 } });
    }

    if (brief === "yes") {
      pipeline.push({
        $project: {
          _id: 0,
          device: 1,
          device_id: 1,
          site_id: 1,
          time: 1,
          pm2_5: 1,
          pm10: 1,
          no2: 1,
          frequency: 1,
          aqi_color: 1,
          aqi_category: 1,
          aqi_color_name: 1,
          health_tips: 1,
          siteDetails: 1,
        },
      });
    }

    pipeline.push({
      $facet: {
        total: [{ $count: "count" }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    });

    const result = await ReadingModel(tenant)
      .aggregate(pipeline)
      .allowDiskUse(true);

    const totalCount = result[0]?.total[0]?.count || 0;
    const data = result[0]?.data || [];

    const response = {
      success: true,
      message: "Successfully retrieved measurements from Readings collection",
      data: [
        {
          meta: {
            total: totalCount,
            skip: skip,
            limit: limit,
            page: page || Math.floor(skip / limit) + 1,
            pages: Math.ceil(totalCount / limit) || 1,
            startTime: eventsFilter["values.time"]?.$gte,
            endTime: eventsFilter["values.time"]?.$lte,
            optimized: true,
            source: "readings",
          },
          data: data,
        },
      ],
      status: 200,
    };

    logText(`✅ Fetched ${data.length} records from Readings (optimized)`);

    return response;
  } catch (error) {
    logText(
      `⚠️ Readings fetch error, falling back to Events: ${error.message}`
    );
    return await fetchFromEvents(tenant, eventsFilter, limit, skip, page);
  }
}

/**
 * Fetch from Events collection (original implementation)
 */
async function fetchFromEvents(
  tenant,
  filter,
  limit = 1000,
  skip = 0,
  page = null
) {
  logText("📊 Fetching from Events collection");
  return await EventModel(tenant).list({ filter, limit, skip, page });
}

module.exports = {
  intelligentFetch,
  fetchFromReadings,
  fetchFromEvents,
};
