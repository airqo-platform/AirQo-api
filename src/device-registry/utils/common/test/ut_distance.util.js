require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const distance = require("@utils/common/distance");

const SAN_FRANCISCO = { latitude: 37.7749, longitude: -122.4194 };
const NEW_YORK = { latitude: 40.7128, longitude: -74.006 };
const LOS_ANGELES = { latitude: 34.0522, longitude: -118.2437 };
const CHICAGO = { latitude: 41.8781, longitude: -87.6298 };

describe("distance", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("findNearestDevices", () => {
    const devices = [SAN_FRANCISCO, NEW_YORK, LOS_ANGELES].map((c) => ({
      ...c,
      isActive: true,
      isPrimaryInLocation: true,
    }));

    it("should return nearest devices within the given radius (km)", () => {
      const result = distance.findNearestDevices({
        devices: devices.map((d) => ({ ...d })),
        radius: 10,
        latitude: SAN_FRANCISCO.latitude,
        longitude: SAN_FRANCISCO.longitude,
      });

      expect(result).to.have.lengthOf(1);
      expect(result[0].latitude).to.equal(SAN_FRANCISCO.latitude);
      expect(result[0].longitude).to.equal(SAN_FRANCISCO.longitude);
    });

    it("should set each device's distance to the computed km value", () => {
      const result = distance.findNearestDevices({
        devices: devices.map((d) => ({ ...d })),
        radius: 5000,
        latitude: SAN_FRANCISCO.latitude,
        longitude: SAN_FRANCISCO.longitude,
      });

      const byLat = Object.fromEntries(result.map((d) => [d.latitude, d]));
      expect(byLat[SAN_FRANCISCO.latitude].distance).to.equal(0);
      expect(byLat[NEW_YORK.latitude].distance).to.be.closeTo(4129.09, 0.01);
      // Must survive JSON serialisation as a number (it is an API response).
      expect(JSON.parse(JSON.stringify(result))[1].distance).to.be.a("number");
    });

    it("should skip inactive or non-primary devices", () => {
      const result = distance.findNearestDevices({
        devices: [
          { ...SAN_FRANCISCO, isActive: false, isPrimaryInLocation: true },
          { ...SAN_FRANCISCO, isActive: true, isPrimaryInLocation: false },
        ],
        radius: 10,
        latitude: SAN_FRANCISCO.latitude,
        longitude: SAN_FRANCISCO.longitude,
      });

      expect(result).to.have.lengthOf(0);
    });
  });

  describe("getDistance", () => {
    it("should calculate the distance between two points in meters", () => {
      const result = distance.getDistance({
        lat1: SAN_FRANCISCO.latitude,
        lon1: SAN_FRANCISCO.longitude,
        lat2: NEW_YORK.latitude,
        lon2: NEW_YORK.longitude,
      });

      // Great-circle distance SF -> NYC is ~4,129 km.
      expect(result).to.be.closeTo(4129086, 1000);
    });

    it("should return 0 when calculating the distance between the same point", () => {
      const result = distance.getDistance({
        lat1: SAN_FRANCISCO.latitude,
        lon1: SAN_FRANCISCO.longitude,
        lat2: SAN_FRANCISCO.latitude,
        lon2: SAN_FRANCISCO.longitude,
      });

      expect(result).to.equal(0);
    });
  });

  describe("filterSitesByRadius", () => {
    const sites = [
      { id: 1, ...SAN_FRANCISCO },
      { id: 2, ...NEW_YORK },
    ];

    it("should filter sites within the specified radius (meters)", () => {
      const filteredSites = distance.filterSitesByRadius({
        sites,
        lat: SAN_FRANCISCO.latitude,
        lon: SAN_FRANCISCO.longitude,
        radius: 1000000, // 1,000 km: includes SF, excludes NYC
      });

      expect(filteredSites).to.have.lengthOf(1);
      expect(filteredSites[0].id).to.equal(1);
    });

    it("should return an empty array if no sites are within the specified radius", () => {
      sinon.stub(distance, "getDistance").returns(200);

      const filteredSites = distance.filterSitesByRadius({
        sites,
        lat: SAN_FRANCISCO.latitude,
        lon: SAN_FRANCISCO.longitude,
        radius: 100,
      });

      expect(filteredSites).to.be.an("array").that.is.empty;
    });
  });

  describe("calculateDistance", () => {
    it("should calculate the correct distance between two coordinates in km", () => {
      const result = distance.calculateDistance({
        latitude1: SAN_FRANCISCO.latitude,
        longitude1: SAN_FRANCISCO.longitude,
        latitude2: NEW_YORK.latitude,
        longitude2: NEW_YORK.longitude,
      });

      expect(result).to.be.closeTo(4129.09, 0.01);
    });
  });

  describe("distanceBtnTwoPoints", () => {
    it("should calculate the correct distance between two sets of coordinates in km", () => {
      const result = distance.distanceBtnTwoPoints({
        latitude1: LOS_ANGELES.latitude,
        longitude1: LOS_ANGELES.longitude,
        latitude2: CHICAGO.latitude,
        longitude2: CHICAGO.longitude,
      });

      expect(result).to.be.closeTo(2803.97, 0.01);
    });
  });

  describe("degreesToRadians", () => {
    it("should convert degrees to radians correctly", () => {
      expect(distance.degreesToRadians(90)).to.equal(Math.PI / 2);
    });
  });

  describe("radiansToDegrees", () => {
    it("should convert radians to degrees correctly", () => {
      expect(distance.radiansToDegrees(Math.PI / 4)).to.equal(45);
    });
  });

  describe("generateRandomNumbers", () => {
    it("should generate random integer when min and max are integers", () => {
      const min = 1;
      const max = 10;

      const result = distance.generateRandomNumbers({ min, max });

      expect(result).to.be.a("number").that.is.within(min, max);
    });

    it("should return a number within [min, max) rounded to `places`", () => {
      for (let i = 0; i < 200; i++) {
        const result = distance.generateRandomNumbers({
          min: 1.5,
          max: 5.5,
          places: 2,
        });

        expect(result).to.be.a("number");
        expect(result).to.be.at.least(1.5).and.at.most(5.5);
        expect(Number(result.toFixed(2))).to.equal(result);
      }
    });

    it("should keep the default bearing within [0, 2π]", () => {
      for (let i = 0; i < 200; i++) {
        expect(distance.generateRandomNumbers()).to.be.within(0, 6.28319);
      }
    });

    it("should throw if min is not a number", () => {
      expect(() =>
        distance.generateRandomNumbers({ min: "abc", max: 5.5 }),
      ).to.throw("Minimum value is not a number.");
    });

    it("should throw if max is not a number", () => {
      expect(() =>
        distance.generateRandomNumbers({ min: 1.5, max: "abc" }),
      ).to.throw("Maximum value is not a number.");
    });

    it("should throw if places is not an integer", () => {
      expect(() =>
        distance.generateRandomNumbers({ min: 1.5, max: 5.5, places: "2" }),
      ).to.throw("Number of decimal places is not a number.");
    });

    it("should throw if places is not greater than 0", () => {
      expect(() =>
        distance.generateRandomNumbers({ min: 1.5, max: 5.5, places: 0 }),
      ).to.throw("Number of decimal places must be at least 1.");
    });
  });

  describe("createApproximateCoordinates", () => {
    it("should return approximate coordinates with provided latitude and longitude", () => {
      const latitude = 10.123;
      const longitude = 20.456;
      const approximate_distance_in_km = 0.5;
      sinon.stub(distance, "generateRandomNumbers").returns(0.123);

      const result = distance.createApproximateCoordinates({
        latitude,
        longitude,
        approximate_distance_in_km,
      });

      expect(result).to.have.keys([
        "approximate_latitude",
        "approximate_longitude",
        "approximate_distance_in_km",
        "bearing_in_radians",
        "provided_latitude",
        "provided_longitude",
      ]);
      expect(result.approximate_latitude)
        .to.be.a("number")
        .that.is.within(
          latitude - approximate_distance_in_km,
          latitude + approximate_distance_in_km,
        );
      expect(result.approximate_longitude)
        .to.be.a("number")
        .that.is.within(
          longitude - approximate_distance_in_km,
          longitude + approximate_distance_in_km,
        );
      expect(result.bearing_in_radians).to.equal(0.123);
      expect(result.provided_latitude).to.equal(latitude);
      expect(result.provided_longitude).to.equal(longitude);
    });
  });
});
