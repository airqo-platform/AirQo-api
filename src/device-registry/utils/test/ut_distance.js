require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const distanceUtil = require("@utils/distance");

describe("distanceUtil", () => {
  describe("findNearestDevices", () => {
    it("should return nearest devices within the given radius", () => {
      const devices = [
        {
          latitude: 37.7749,
          longitude: -122.4194,
          isActive: true,
          isPrimaryInLocation: true,
        },
        {
          latitude: 40.7128,
          longitude: -74.006,
          isActive: true,
          isPrimaryInLocation: true,
        },
        {
          latitude: 34.0522,
          longitude: -118.2437,
          isActive: true,
          isPrimaryInLocation: true,
        },
        // Add more devices...
      ];

      const radius = 10000; // 10 kilometers
      const latitude = 37.7749;
      const longitude = -122.4194;

      const result = distanceUtil.findNearestDevices(
        devices,
        radius,
        latitude,
        longitude
      );

      // Ensure only the device at index 0 is included since it's the nearest one.
      expect(result).to.have.lengthOf(1);
      expect(result[0].latitude).to.equal(37.7749);
      expect(result[0].longitude).to.equal(-122.4194);
    });

    it("should not include devices outside the given radius", () => {
      const devices = [
        {
          latitude: 37.7749,
          longitude: -122.4194,
          isActive: true,
          isPrimaryInLocation: true,
        },
        {
          latitude: 40.7128,
          longitude: -74.006,
          isActive: true,
          isPrimaryInLocation: true,
        },
        {
          latitude: 34.0522,
          longitude: -118.2437,
          isActive: true,
          isPrimaryInLocation: true,
        },
        // Add more devices...
      ];

      const radius = 5000; // 5 kilometers
      const latitude = 37.7749;
      const longitude = -122.4194;

      const result = distanceUtil.findNearestDevices(
        devices,
        radius,
        latitude,
        longitude
      );

      // Ensure no devices are included since the radius is too small.
      expect(result).to.have.lengthOf(0);
    });

    // Add more test cases...
  });
  describe("getDistance", () => {
    it("should calculate the distanceUtil between two points correctly", () => {
      const lat1 = 37.7749; // San Francisco latitude
      const lon1 = -122.4194; // San Francisco longitude
      const lat2 = 40.7128; // New York City latitude
      const lon2 = -74.006; // New York City longitude

      // Calculate the distanceUtil between San Francisco and New York City
      const result = distanceUtil.getDistance(lat1, lon1, lat2, lon2);

      // We can expect a rough distanceUtil since the Earth is not a perfect sphere.
      // The actual value may vary slightly depending on the calculation method.
      expect(result).to.be.closeTo(4138608, 1000); // Expected distanceUtil: around 4138608 meters
    });

    it("should return 0 when calculating the distanceUtil between the same point", () => {
      const lat1 = 37.7749; // San Francisco latitude
      const lon1 = -122.4194; // San Francisco longitude

      // Calculate the distanceUtil between the same point (San Francisco)
      const result = distanceUtil.getDistance(lat1, lon1, lat1, lon1);

      expect(result).to.equal(0);
    });

    // Add more test cases...
  });
  describe("filterSitesByRadius", () => {
    const sites = [
      {
        id: 1,
        latitude: 37.7749, // San Francisco latitude
        longitude: -122.4194, // San Francisco longitude
      },
      {
        id: 2,
        latitude: 40.7128, // New York City latitude
        longitude: -74.006, // New York City longitude
      },
      // Add more site data...
    ];

    it("should filter sites within the specified radius", () => {
      const lat = 37.7749; // San Francisco latitude
      const lon = -122.4194; // San Francisco longitude
      const radius = 5000000; // 5000 kilometers

      // Stub the distanceUtil.getDistance function to return a fixed distanceUtil
      const getDistanceStub = sinon.stub(distanceUtil, "getDistance");
      getDistanceStub.returns(4000000); // 4000 kilometers

      // Call the filterSitesByRadius function
      const filteredSites = distanceUtil.filterSitesByRadius({
        sites,
        lat,
        lon,
        radius,
      });

      // The first site should be within the specified radius (distanceUtil < 5000 km)
      expect(filteredSites).to.have.lengthOf(1);
      expect(filteredSites[0].id).to.equal(1);

      // Restore the stubbed function
      getDistanceStub.restore();
    });

    it("should return an empty array if no sites are within the specified radius", () => {
      const lat = 37.7749; // San Francisco latitude
      const lon = -122.4194; // San Francisco longitude
      const radius = 100; // 100 meters

      // Stub the distanceUtil.getDistance function to return a distanceUtil greater than the radius
      const getDistanceStub = sinon.stub(distanceUtil, "getDistance");
      getDistanceStub.returns(200); // 200 meters

      // Call the filterSitesByRadius function
      const filteredSites = distanceUtil.filterSitesByRadius({
        sites,
        lat,
        lon,
        radius,
      });

      // No sites should be within the specified radius (distanceUtil > 100 meters)
      expect(filteredSites).to.be.an("array").that.is.empty;

      // Restore the stubbed function
      getDistanceStub.restore();
    });

    // Add more test cases...
  });
  describe("calculateDistance", () => {
    it("should calculate the correct distanceUtil between two coordinates", () => {
      // Coordinates of San Francisco, California
      const latitude1 = 37.7749;
      const longitude1 = -122.4194;

      // Coordinates of New York City, New York
      const latitude2 = 40.7128;
      const longitude2 = -74.006;

      // Expected distanceUtil between the two coordinates (in kilometers)
      // Calculated using a trusted distanceUtil calculator
      const expectedDistance = 4137.85;

      // Call the calculateDistance function
      const distanceResult = distanceUtil.calculateDistance(
        latitude1,
        longitude1,
        latitude2,
        longitude2
      );

      // Check if the calculated distanceUtil is close to the expected distanceUtil
      expect(distanceResult).to.be.approximately(expectedDistance, 0.01);
    });

    // Add more test cases...
  });
  describe("distanceBtnTwoPoints", () => {
    it("should calculate the correct distanceUtil between two sets of coordinates", () => {
      // Coordinates of Los Angeles, California
      const latitude1 = 34.0522;
      const longitude1 = -118.2437;

      // Coordinates of Chicago, Illinois
      const latitude2 = 41.8781;
      const longitude2 = -87.6298;

      // Expected distanceUtil between the two coordinates (in kilometers)
      // Calculated using a trusted distanceUtil calculator
      const expectedDistance = 2796.34;

      // Call the distanceBtnTwoPoints function
      const distanceResult = distanceUtil.distanceBtnTwoPoints(
        latitude1,
        longitude1,
        latitude2,
        longitude2
      );

      // Check if the calculated distanceUtil is close to the expected distanceUtil
      expect(distanceResult).to.be.approximately(expectedDistance, 0.01);
    });

    // Add more test cases...
  });
  describe("degreesToRadians", () => {
    it("should convert degrees to radians correctly", () => {
      // Test with a known degree value (90 degrees)
      const degrees = 90;

      // Expected result of converting 90 degrees to radians
      const expectedRadians = Math.PI / 2;

      // Call the degreesToRadians function
      const radiansResult = distanceUtil.degreesToRadians(degrees);

      // Check if the calculated radians is equal to the expected value
      expect(radiansResult).to.equal(expectedRadians);
    });

    // Add more test cases...
  });
  describe("radiansToDegrees", () => {
    it("should convert radians to degrees correctly", () => {
      // Test with a known radians value (π/4)
      const radians = Math.PI / 4;

      // Expected result of converting π/4 radians to degrees
      const expectedDegrees = 45;

      // Call the radiansToDegrees function
      const degreesResult = distanceUtil.radiansToDegrees(radians);

      // Check if the calculated degrees is equal to the expected value
      expect(degreesResult).to.equal(expectedDegrees);
    });

    // Add more test cases...
  });
  describe("generateRandomNumbers", () => {
    it("should generate random integer when min and max are integers", () => {
      const min = 1;
      const max = 10;

      // Call the generateRandomNumbers function
      const result = distanceUtil.generateRandomNumbers({ min, max });

      // Check if the result is an integer within the range [min, max]
      expect(result)
        .to.be.an("number")
        .that.is.within(min, max);
    });

    it("should generate random decimal number when min and max are floats", () => {
      const min = 1.5;
      const max = 5.5;
      const places = 2;

      // Call the generateRandomNumbers function
      const result = distanceUtil.generateRandomNumbers({ min, max, places });

      // Check if the result is a number within the range [min, max] with specified decimal places
      expect(result)
        .to.be.a("number")
        .that.is.within(min, max);

      // Check if the result has the correct number of decimal places
      expect(result.toString().split(".")[1].length).to.equal(places);
    });

    it("should throw an error if min and max are not numbers", () => {
      const min = "not_a_number";
      const max = "also_not_a_number";

      // Call the generateRandomNumbers function and expect it to throw an error
      expect(() => distanceUtil.generateRandomNumbers({ min, max })).to.throw(
        "Minimum value is not a number."
      );
    });

    it("should throw an error if places is not an integer", () => {
      const min = 1;
      const max = 5;
      const places = "not_an_integer";

      // Call the generateRandomNumbers function and expect it to throw an error
      expect(() =>
        distanceUtil.generateRandomNumbers({ min, max, places })
      ).to.throw("Number of decimal places is not a number.");
    });

    it("should throw an error if places is not greater than 0", () => {
      const min = 1;
      const max = 5;
      const places = 0;

      // Call the generateRandomNumbers function and expect it to throw an error
      expect(() =>
        distanceUtil.generateRandomNumbers({ min, max, places })
      ).to.throw("Number of decimal places must be at least 1.");
    });

    // Add more test cases...
  });
  describe("createApproximateCoordinates", () => {
    it("should return approximate coordinates with provided latitude and longitude", () => {
      const latitude = 10.123;
      const longitude = 20.456;
      const approximate_distance_in_km = 0.5;

      // Stub the generateRandomNumbers function to return a fixed bearing value
      const bearingStub = sinon.stub(distanceUtil, "generateRandomNumbers");
      bearingStub.returns(0.123); // Set the bearing value to a fixed value

      // Call the createApproximateCoordinates function
      const result = distanceUtil.createApproximateCoordinates({
        latitude,
        longitude,
        approximate_distance_in_km,
      });

      // Restore the stub after the test
      bearingStub.restore();

      // Check if the result contains the expected keys
      expect(result).to.have.keys([
        "approximate_latitude",
        "approximate_longitude",
        "approximate_distance_in_km",
        "bearing_in_radians",
        "provided_latitude",
        "provided_longitude",
      ]);

      // Check if the calculated approximate latitude and longitude are within the expected range
      expect(result.approximate_latitude)
        .to.be.a("number")
        .that.is.within(
          latitude - approximate_distance_in_km,
          latitude + approximate_distance_in_km
        );
      expect(result.approximate_longitude)
        .to.be.a("number")
        .that.is.within(
          longitude - approximate_distance_in_km,
          longitude + approximate_distance_in_km
        );

      // Check if the bearing_in_radians is equal to the stubbed value
      expect(result.bearing_in_radians).to.equal(0.123);

      // Check if the provided latitude and longitude are correctly assigned
      expect(result.provided_latitude).to.equal(latitude);
      expect(result.provided_longitude).to.equal(longitude);
    });

    // Add more test cases...
  });
});
