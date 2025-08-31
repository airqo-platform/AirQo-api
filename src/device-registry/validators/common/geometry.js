const { logObject, logText, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- geometry-util`
);

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
    const fixedCoordinates = coordinates.map((ring) => ensureClosedRing(ring));
    return {
      ...shape,
      coordinates: fixedCoordinates,
    };
  } else if (type === "MultiPolygon") {
    const fixedCoordinates = coordinates.map((polygon) =>
      polygon.map((ring) => ensureClosedRing(ring))
    );
    return {
      ...shape,
      coordinates: fixedCoordinates,
    };
  }

  return shape;
}

/**
 * Ensures a coordinate ring is closed by adding the first coordinate as the last if needed
 * @param {Array} ring - Array of coordinate pairs [lng, lat]
 * @returns {Array} - Closed coordinate ring
 */
function ensureClosedRing(ring) {
  if (!Array.isArray(ring) || ring.length < 3) {
    throw new Error("Polygon ring must contain at least 3 coordinates");
  }

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
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * Validates polygon coordinates without fixing them
 * @param {Object} shape - The shape object containing type and coordinates
 * @param {number} tolerance - Tolerance for coordinate matching (default: 0.000001)
 * @returns {boolean} - True if valid, throws error if invalid
 */
function validatePolygonClosure(shape, tolerance = 0.000001) {
  if (!shape || !shape.coordinates || !shape.type) {
    throw new Error("Invalid shape object provided");
  }

  const { type, coordinates } = shape;

  if (type === "Polygon") {
    coordinates.forEach((ring, ringIndex) => {
      if (!Array.isArray(ring) || ring.length < 3) {
        throw new Error(
          `Polygon ring ${ringIndex} must contain at least 3 coordinates`
        );
      }

      const first = ring[0];
      const last = ring[ring.length - 1];

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
        if (!Array.isArray(ring) || ring.length < 3) {
          throw new Error(
            `MultiPolygon ${polygonIndex}, ring ${ringIndex} must contain at least 3 coordinates`
          );
        }

        const first = ring[0];
        const last = ring[ring.length - 1];

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
  }

  return true;
}

module.exports = {
  validateAndFixPolygon,
  ensureClosedRing,
  validateCoordinates,
  validatePolygonClosure,
};
