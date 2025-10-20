const { logText } = require("@utils/shared");

/**
 * Transforms Readings collection response to match Events collection response format
 * @param {Object} readingsResponse - Response from Readings collection
 * @param {Object} originalFilter - Original query filter
 * @returns {Object} - Transformed response matching Events format
 */
function transformReadingsToEventsFormat(readingsResponse, originalFilter) {
  if (!readingsResponse || !readingsResponse.success) {
    return readingsResponse;
  }

  // Readings response format: { success, message, data: [{meta, data}], status }
  // Events response format: same structure

  // If already in correct format, return as-is
  if (Array.isArray(readingsResponse.data) && readingsResponse.data[0]?.meta) {
    return readingsResponse;
  }

  // Handle different response formats
  const transformedData = readingsResponse.data.map((reading) => {
    // Readings already have the correct structure at root level
    // Just ensure field names match Events format
    return {
      ...reading,
      // Ensure compatibility fields exist
      time: reading.time,
      device: reading.device,
      device_id: reading.device_id,
      site_id: reading.site_id,
      // Pre-computed fields are already present
      aqi_color: reading.aqi_color,
      aqi_category: reading.aqi_category,
      aqi_color_name: reading.aqi_color_name,
      health_tips: reading.health_tips || [],
      // Device/Site details
      siteDetails: reading.siteDetails,
      deviceDetails: reading.deviceDetails,
      site_image: reading.site_image,
    };
  });

  return {
    ...readingsResponse,
    data: transformedData,
  };
}

/**
 * Ensures response metadata matches Events format
 * @param {Object} response - Response object
 * @param {Object} originalFilter - Original filter used for query
 * @returns {Object} - Response with properly formatted metadata
 */
function ensureMetadataFormat(response, originalFilter) {
  if (!response || !response.data || !Array.isArray(response.data)) {
    return response;
  }

  // Check if we have the meta/data structure
  if (response.data[0]?.meta && response.data[0]?.data) {
    return response;
  }

  // Wrap in meta/data structure
  const total = response.data.length;

  //Ensure limit is never zero to prevent division by zero
  const safeLimit = originalFilter.limit > 0 ? originalFilter.limit : 1000;
  const skip = originalFilter.skip || 0;

  return {
    ...response,
    data: [
      {
        meta: {
          total: total,
          skip: skip,
          limit: safeLimit,
          page: safeLimit > 0 ? Math.floor(skip / safeLimit) + 1 : 1,
          pages: safeLimit > 0 ? Math.ceil(total / safeLimit) || 1 : 1,
          startTime: originalFilter["values.time"]?.$gte,
          endTime: originalFilter["values.time"]?.$lte,
          optimized: true,
          source: "readings_collection",
        },
        data: response.data,
      },
    ],
  };
}

module.exports = {
  transformReadingsToEventsFormat,
  ensureMetadataFormat,
};
