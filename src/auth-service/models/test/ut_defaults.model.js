require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const DefaultsSchema = require("@models/Defaults");
const mongoose = require("mongoose");

describe("DefaultsSchema - Statics", () => {
  describe("Static Method: register", () => {
    it("should create a new default and return success response", async () => {
      // Mock input data
      const args = {
        pollutant: "CO2",
        frequency: "hourly",
        user: mongoose.Types.ObjectId(),
        airqloud: mongoose.Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(),
        chartType: "line",
        chartTitle: "Default Chart",
        chartSubTitle: "Default Chart Subtitle",
        sites: [mongoose.Types.ObjectId(), mongoose.Types.ObjectId()],
        network_id: mongoose.Types.ObjectId(),
        period: {
          value: "2023-07-01T00:00:00.000Z",
          label: "July 2023",
          unitValue: 1,
          unit: "month",
        },
      };

      // Call the register static method
      const result = await DefaultsSchema.register(args);

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "default created successfully with no issues detected",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("object");
      // Add more assertions to verify the result
    });

    it("should handle duplicate values and return conflict response", async () => {
      // Mock input data with duplicate values
      const args = {
        pollutant: "CO2",
        frequency: "hourly",
        user: mongoose.Types.ObjectId(),
        airqloud: mongoose.Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(),
        chartType: "line",
        chartTitle: "Default Chart",
        chartSubTitle: "Default Chart Subtitle",
        sites: [mongoose.Types.ObjectId(), mongoose.Types.ObjectId()],
        network_id: mongoose.Types.ObjectId(),
        period: {
          value: "2023-07-01T00:00:00.000Z",
          label: "July 2023",
          unitValue: 1,
          unit: "month",
        },
      };

      // Call the register static method
      const result = await DefaultsSchema.register(args);

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: false,
        message: "duplicate values provided",
        status: httpStatus.CONFLICT,
      });
      expect(result).to.have.property("errors").that.is.an("object");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  describe("Static Method: list", () => {
    it("should return a list of defaults", async () => {
      // Mock input data (optional)
      const filter = { frequency: "hourly" };
      const skip = 0;
      const limit = 20;

      // Call the list static method
      const result = await DefaultsSchema.list({ filter, skip, limit });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "successfully listed the defaults",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("array");
      // Add more assertions to verify the result
    });

    it("should handle error and return conflict response", async () => {
      // Mock input data (optional)
      const filter = { pollutant: "CO2" };
      const skip = 0;
      const limit = 20;

      // Call the list static method
      const result = await DefaultsSchema.list({ filter, skip, limit });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: false,
        message: "Data conflicts detected",
        status: httpStatus.CONFLICT,
      });
      expect(result).to.have.property("errors").that.is.an("object");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  describe("Static Method: modify", () => {
    it("should modify the default and return success response", async () => {
      // Mock input data
      const filter = { pollutant: "CO2" };
      const update = { frequency: "daily" };

      // Call the modify static method
      const result = await DefaultsSchema.modify({ filter, update });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "successfully modified the default",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("object");
      // Add more assertions to verify the result
    });

    it("should handle error and return conflict response", async () => {
      // Mock input data
      const filter = { pollutant: "CO2" };
      const update = { frequency: "daily" };

      // Call the modify static method
      const result = await DefaultsSchema.modify({ filter, update });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: false,
        message: "duplicate values provided",
        status: httpStatus.CONFLICT,
      });
      expect(result).to.have.property("errors").that.is.an("object");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  describe("Static Method: remove", () => {
    it("should remove the default and return success response", async () => {
      // Mock input data
      const filter = { pollutant: "CO2" };

      // Call the remove static method
      const result = await DefaultsSchema.remove({ filter });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "successfully removed the default",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("object");
      // Add more assertions to verify the result
    });

    it("should handle error and return conflict response", async () => {
      // Mock input data
      const filter = { pollutant: "CO2" };

      // Call the remove static method
      const result = await DefaultsSchema.remove({ filter });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: false,
        message: "Data conflicts detected",
        status: httpStatus.CONFLICT,
      });
      expect(result).to.have.property("errors").that.is.an("object");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });
});

describe("DefaultsSchema - Methods", () => {
  describe("Method: toJSON", () => {
    it("should return the JSON representation of the default object", () => {
      // Mock a default object
      const defaultObj = new DefaultsSchema({
        _id: mongoose.Types.ObjectId(),
        pollutant: "CO2",
        frequency: "hourly",
        user: mongoose.Types.ObjectId(),
        airqloud: mongoose.Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(),
        chartType: "line",
        chartTitle: "Default Chart",
        chartSubTitle: "Default Chart Subtitle",
        sites: [mongoose.Types.ObjectId(), mongoose.Types.ObjectId()],
        network_id: mongoose.Types.ObjectId(),
        period: {
          value: "2023-07-01T00:00:00.000Z",
          label: "July 2023",
          unitValue: 1,
          unit: "month",
        },
        createdAt: new Date(),
      });

      // Call the toJSON method
      const result = defaultObj.toJSON();

      // Assertions
      expect(result).to.be.an("object").that.includes({
        _id: defaultObj._id,
        pollutant: defaultObj.pollutant,
        frequency: defaultObj.frequency,
        user: defaultObj.user,
        airqloud: defaultObj.airqloud,
        startDate: defaultObj.startDate,
        endDate: defaultObj.endDate,
        chartType: defaultObj.chartType,
        chartTitle: defaultObj.chartTitle,
        chartSubTitle: defaultObj.chartSubTitle,
        sites: defaultObj.sites,
        network_id: defaultObj.network_id,
        period: defaultObj.period,
        createdAt: defaultObj.createdAt,
      });
      // Add more assertions to verify the result
    });

    it("should not include the _id field in the JSON representation", () => {
      // Mock a default object
      const defaultObj = new DefaultsSchema({
        _id: mongoose.Types.ObjectId(),
        pollutant: "CO2",
        frequency: "hourly",
        user: mongoose.Types.ObjectId(),
        airqloud: mongoose.Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(),
        chartType: "line",
        chartTitle: "Default Chart",
        chartSubTitle: "Default Chart Subtitle",
        sites: [mongoose.Types.ObjectId(), mongoose.Types.ObjectId()],
        network_id: mongoose.Types.ObjectId(),
        period: {
          value: "2023-07-01T00:00:00.000Z",
          label: "July 2023",
          unitValue: 1,
          unit: "month",
        },
        createdAt: new Date(),
      });

      // Call the toJSON method
      const result = defaultObj.toJSON();

      // Assertions
      expect(result).to.be.an("object").that.does.not.have.property("_id");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios if needed
  });
});
