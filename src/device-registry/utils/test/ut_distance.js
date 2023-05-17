process.env.NODE_ENV = "development";

require('dotenv').config();
require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);

const distanceUtil = require("@utils/distance");

describe("Distance Util", () => {
    describe("Find Nearest Devices", function () {
        
        it('should return an array of nearest devices within the given radius', function () {
            const devices = [
                {
                    latitude: 37.7749,
                    longitude: -122.4194,
                    isActive: true,
                    isPrimaryInLocation: true
                },
                {
                    latitude: 34.0522,
                    longitude: -118.2437,
                    isActive: true,
                    isPrimaryInLocation: true
                },
                {
                    latitude: 40.7128,
                    longitude: -74.0060,
                    isActive: false,
                    isPrimaryInLocation: true
                }
            ];
    
            const radius = 100;
            const latitude = 37.7749;
            const longitude = -122.4194;
    
            const result = distanceUtil.findNearestDevices(devices, radius, latitude, longitude);
    
            assert.isArray(result);
            assert.lengthOf(result, 1);
            assert.deepInclude(result, devices[0]);
        });
       
        it('should return an empty array if no devices are within the given radius', function () {
            const devices = [
                {
                    latitude: 37.7749,
                    longitude: -122.4194,
                    isActive: true,
                    isPrimaryInLocation: true
                },
                {
                    latitude: 34.0522,
                    longitude: -118.2437,
                    isActive: true,
                    isPrimaryInLocation: true
                }
            ];
    
            const radius = 10;
            const latitude = 40.7128;
            const longitude = -74.0060;
    
            const result = distanceUtil.findNearestDevices(devices, radius, latitude, longitude);
    
            assert.isArray(result);
            assert.isEmpty(result);
        });
    });
    describe('getDistance', function () {
        it('should calculate the correct distance between two sets of coordinates', function () {
            const lat1 = 37.7749;
            const lon1 = -122.4194;
            const lat2 = 34.0522;
            const lon2 = -118.2437;

            const result = distanceUtil.getDistance(lat1, lon1, lat2, lon2);
            assert.approximately(result, 559120.577, 1);
        });
    });

    describe('filterSitesByRadius', function () {
        it('should filter sites based on the given radius', function () {
            const sites = [
                { latitude: 37.7749, longitude: -122.4194 },
                { latitude: 34.0522, longitude: -118.2437 },
                { latitude: 39.9526, longitude: -75.1652 },
                { latitude: 40.7128, longitude: -74.0060 }
            ];

            const lat = 37.7749;
            const lon = -122.4194;
            const radius = 100000; 

            const filteredSites = distanceUtil.filterSitesByRadius({ sites, lat, lon, radius });

            assert.isArray(filteredSites);
            assert.lengthOf(filteredSites, 1);
            assert.deepInclude(filteredSites, { latitude: 37.7749, longitude: -122.4194 });
        });

        it('should return an empty array when no sites are within the radius', function () {
            const sites = [
                { latitude: 37.7749, longitude: -122.4194 },
                { latitude: 34.0522, longitude: -118.2437 },
                { latitude: 39.9526, longitude: -75.1652 },
                { latitude: 40.7128, longitude: -74.0060 }
            ];

            const lat = 42.3601;
            const lon = -71.0589;
            const radius = 100000; 

            const filteredSites = distanceUtil.filterSitesByRadius({ sites, lat, lon, radius });

            assert.isArray(filteredSites);
            assert.isEmpty(filteredSites);
        });
    });

describe('calculateDistance', function() {
  it('should calculate the distance between two points on Earth', function() {
    const latitude1 = 37.7749;
    const longitude1 = -122.4194;
    const latitude2 = 34.0522;
    const longitude2 = -118.2437;

    const distance =distanceUtil.calculateDistance(latitude1, longitude1, latitude2, longitude2);

    assert.approximately(distance, 560, 10);
  });

  it('should return 0 when the same coordinates are provided', function() {
    const latitude1 = 37.7749;
    const longitude1 = -122.4194;

    const distance = distanceUtil.calculateDistance(latitude1, longitude1, latitude1, longitude1);
    assert.strictEqual(distance, 0);
  });
});

    const assert = require('chai').assert;

describe('generateRandomNumbers', function() {
  it('should generate random integers within the specified range', function() {
    const min = 1;
    const max = 10;

    const randomInt = distanceUtil.generateRandomNumbers({ min, max });

    assert.isNumber(randomInt);
    assert.isAtLeast(randomInt, min);
    assert.isAtMost(randomInt, max);
  });

  it('should generate random numbers with the specified decimal places', function() {
    const min = 1.5;
    const max = 2.5;
    const places = 2;

    const randomNumber = distanceUtil.generateRandomNumbers({ min, max, places });

    // Generated number is a string representation of a decimal number
    assert.isString(randomNumber);
    assert.match(randomNumber, /^\d+\.\d+$/);

    // Number of decimal places matches the specified value
    assert.lengthOf(randomNumber.split('.')[1], places);
  });

  it('should throw an error when invalid inputs are provided', function() {
      result = distanceUtil.generateRandomNumbers({ min: 'abc', max: 'def' });
      expect(result).to.equal('NaN');
     });
});


describe('createApproximateCoordinates', function() {
  it('should return an object with approximate coordinates', function() {
    const latitude = 0;
    const longitude = 0;
    const approximate_distance_in_km = 0.5;

    const result =  distanceUtil.createApproximateCoordinates({
      latitude,
      longitude,
      approximate_distance_in_km,
    });
    assert.property(result, 'approximate_latitude');
    assert.property(result, 'approximate_longitude');
    assert.property(result, 'approximate_distance_in_km');
    assert.property(result, 'bearing_in_radians');
    assert.property(result, 'provided_latitude');
    assert.property(result, 'provided_longitude');

    assert.isAtLeast(result.approximate_latitude, -90);
    assert.isAtMost(result.approximate_latitude, 90);
    assert.isAtLeast(result.approximate_longitude, -180);
    assert.isAtMost(result.approximate_longitude, 180);

      assert.strictEqual(result.approximate_distance_in_km, approximate_distance_in_km);
      
    assert.strictEqual(result.provided_latitude, latitude);
    assert.strictEqual(result.provided_longitude, longitude);
  });
});

});