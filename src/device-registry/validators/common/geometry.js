const { logObject, logText, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- geometry-util`
);

// Tolerance levels for different validation scenarios
const TOLERANCE_LEVELS = {
  STRICT: 0.000001, // Almost exact match required
  NORMAL: 0.001, // Default - good for most cases
  LENIENT: 0.01, // More forgiving - good for imported data
  VERY_LENIENT: 0.1, // Very forgiving - for rough/legacy data
};

/**
 * Validates coordinate values to ensure they're within valid ranges
 * @param {Array} coordinates - Coordinate pair [lng, lat]
 * @returns {boolean} - True if valid, false otherwise
 */
function validateCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }

  const [lng, lat] = coordinates;

  // Longitude should be between -180 and 180
  // Latitude should be between -90 and 90
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    !isNaN(lng) &&
    !isNaN(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * Ensures a coordinate ring is closed by adding the first coordinate as the last if needed
 * @param {Array} ring - Array of coordinate pairs [lng, lat]
 * @returns {Array} - Closed coordinate ring
 */
function ensureClosedRing(ring) {
  if (!Array.isArray(ring) || ring.length < 3) {
    throw new Error(
      "Polygon ring must contain at least 3 coordinates before closure"
    );
  }

  // Validate each coordinate before processing
  ring.forEach((c, i) => {
    if (!validateCoordinates(c)) {
      throw new Error(`Invalid coordinate at ring index ${i}`);
    }
  });

  const firstCoord = ring[0];
  const lastCoord = ring[ring.length - 1];

  // Check if the ring is already closed
  if (firstCoord[0] === lastCoord[0] && firstCoord[1] === lastCoord[1]) {
    return ring;
  }

  // Close the ring by adding the first coordinate as the last
  const closedRing = [...ring, firstCoord];

  logger.info(
    `Fixed unclosed polygon ring. Added closing coordinate: [${
      firstCoord[0]
    }, ${firstCoord[1]}]`
  );

  return closedRing;
}

/**
 * Validates and fixes polygon coordinates to ensure they form a closed loop
 * @param {Object} shape - The shape object containing type and coordinates
 * @returns {Object} - The validated and fixed shape object
 */
function validateAndFixPolygon(shape) {
  if (!shape || !shape.coordinates || !shape.type) {
    throw new Error("Invalid shape object provided");
  }

  const { type, coordinates } = shape;

  if (type === "Polygon") {
    if (!Array.isArray(coordinates)) {
      throw new Error("Polygon coordinates must be an array of rings");
    }
    const fixedCoordinates = coordinates.map((ring, ringIndex) => {
      if (!Array.isArray(ring) || ring.length < 3) {
        throw new Error(
          `Polygon ring ${ringIndex} must contain at least 3 coordinates before closure`
        );
      }
      ring.forEach((c, i) => {
        if (!validateCoordinates(c)) {
          throw new Error(
            `Invalid coordinate at ring ${ringIndex}, index ${i}; expected [lng, lat] within ranges`
          );
        }
      });
      return ensureClosedRing(ring);
    });
    return {
      ...shape,
      coordinates: fixedCoordinates,
    };
  } else if (type === "MultiPolygon") {
    if (!Array.isArray(coordinates)) {
      throw new Error("MultiPolygon coordinates must be an array of polygons");
    }
    const fixedCoordinates = coordinates.map((polygon, pIdx) => {
      if (!Array.isArray(polygon) || polygon.length === 0) {
        throw new Error(`MultiPolygon ${pIdx} must contain at least one ring`);
      }
      return polygon.map((ring, rIdx) => {
        if (!Array.isArray(ring) || ring.length < 3) {
          throw new Error(
            `MultiPolygon ${pIdx}, ring ${rIdx} must contain at least 3 coordinates before closure`
          );
        }
        ring.forEach((c, i) => {
          if (!validateCoordinates(c)) {
            throw new Error(
              `Invalid coordinate at polygon ${pIdx}, ring ${rIdx}, index ${i}`
            );
          }
        });
        return ensureClosedRing(ring);
      });
    });
    return {
      ...shape,
      coordinates: fixedCoordinates,
    };
  }

  return shape;
}

/**
 * Validates polygon coordinates without fixing them
 * @param {Object} shape - The shape object containing type and coordinates
 * @param {number} tolerance - Tolerance for coordinate matching (default: TOLERANCE_LEVELS.STRICT)
 * @returns {boolean} - True if valid, throws error if invalid
 */
function validatePolygonClosure(shape, tolerance = TOLERANCE_LEVELS.STRICT) {
  if (!shape || !shape.coordinates || !shape.type) {
    throw new Error("Invalid shape object provided");
  }

  const { type, coordinates } = shape;

  if (type === "Polygon") {
    coordinates.forEach((ring, ringIndex) => {
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new Error(
          `Polygon ring ${ringIndex} must contain at least 4 coordinates (closed linear ring)`
        );
      }

      const first = ring[0];
      const last = ring[ring.length - 1];

      if (!validateCoordinates(first) || !validateCoordinates(last)) {
        throw new Error(
          `Invalid endpoint coordinate(s) in ring ${ringIndex} (expected numeric [lng, lat])`
        );
      }

      if (
        Math.abs(first[0] - last[0]) > tolerance ||
        Math.abs(first[1] - last[1]) > tolerance
      ) {
        throw new Error(
          `Invalid polygon detected: ring ${ringIndex} is not closed. ` +
            `First: [${first[0]}, ${first[1]}], Last: [${last[0]}, ${last[1]}]`
        );
      }
    });
  } else if (type === "MultiPolygon") {
    coordinates.forEach((polygon, polygonIndex) => {
      polygon.forEach((ring, ringIndex) => {
        if (!Array.isArray(ring) || ring.length < 4) {
          throw new Error(
            `MultiPolygon ${polygonIndex}, ring ${ringIndex} must contain at least 4 coordinates (closed linear ring)`
          );
        }

        const first = ring[0];
        const last = ring[ring.length - 1];

        if (!validateCoordinates(first) || !validateCoordinates(last)) {
          throw new Error(
            `Invalid endpoint coordinate(s) in polygon ${polygonIndex}, ring ${ringIndex}`
          );
        }

        if (
          Math.abs(first[0] - last[0]) > tolerance ||
          Math.abs(first[1] - last[1]) > tolerance
        ) {
          throw new Error(
            `Invalid multipolygon detected: polygon ${polygonIndex}, ring ${ringIndex} is not closed. ` +
              `First: [${first[0]}, ${first[1]}], Last: [${last[0]}, ${
                last[1]
              }]`
          );
        }
      });
    });
  } else {
    throw new Error(`Unsupported shape type: ${type}`);
  }

  return true;
}

module.exports = {
  validateAndFixPolygon,
  ensureClosedRing,
  validateCoordinates,
  validatePolygonClosure,
  TOLERANCE_LEVELS,
};
