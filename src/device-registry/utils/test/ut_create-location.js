require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const createLocation = require("@utils/create-location"); // Replace this with the correct path to your createLocation file
const LocationSchema = require("@models/Location"); // Replace this with the correct path to your LocationSchema file
const { getModelByTenant } = require("@config/database"); // Replace this with the correct path to your getModelByTenant file
const httpStatus = require("http-status");

const expect = chai.expect;

describe("createLocation", () => {
  describe("initialIsCapital", () => {
    it("should return true for a word with the initial letter capitalized", () => {
      const result = createLocation.initialIsCapital("Word");
      expect(result).to.be.true;
    });

    it("should return false for a word with the initial letter in lowercase", () => {
      const result = createLocation.initialIsCapital("word");
      expect(result).to.be.false;
    });

    // Add more test cases as needed
  });

  describe("hasNoWhiteSpace", () => {
    it("should return true for a word with no white space", () => {
      const result = createLocation.hasNoWhiteSpace("Word");
      expect(result).to.be.true;
    });

    it("should return false for a word with white space", () => {
      const result = createLocation.hasNoWhiteSpace("Word with space");
      expect(result).to.be.false;
    });

    // Add more test cases as needed
  });

  describe("create", () => {
    it("should create a location and send message to Kafka", async () => {
      // Mock the request object
      const request = {
        body: {
          // Replace with the necessary properties for location creation
        },
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the LocationSchema register method to return a successful response
      const registerResponseMock = {
        success: true,
        data: {
          // Replace with the necessary properties for the created location
        },
      };
      const locationModelMock = {
        register: sinon.stub().resolves(registerResponseMock),
      };

      // Mock Kafka producer methods
      const kafkaProducerMock = {
        connect: sinon.stub().resolves(),
        send: sinon.stub().resolves(),
        disconnect: sinon.stub().resolves(),
      };
      const kafkaMock = {
        producer: sinon.stub().returns(kafkaProducerMock),
      };

      // Call the function and assert
      const result = await createLocation.create(request, {
        getModelByTenant: sinon.stub().resolves(locationModelMock),
        kafka: kafkaMock,
      });

      expect(result).to.deep.equal(registerResponseMock);
      expect(locationModelMock.register.calledOnceWith(request.body)).to.be
        .true;
      expect(
        kafkaMock.producer.calledOnceWith({
          groupId: "unique_producer_group",
        })
      ).to.be.true;
      expect(kafkaProducerMock.connect.calledOnce).to.be.true;
      expect(kafkaProducerMock.send.calledOnce).to.be.true;
      expect(kafkaProducerMock.disconnect.calledOnce).to.be.true;
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle errors during location creation", async () => {
      // Mock the request object
      const request = {
        body: {
          // Replace with the necessary properties for location creation
        },
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the LocationSchema register method to return an error response
      const registerErrorResponseMock = {
        success: false,
        message: "unable to create location",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: "Error message",
        },
      };
      const locationModelMock = {
        register: sinon.stub().rejects(new Error("Error message")),
      };

      // Call the function and assert
      const result = await createLocation.create(request, {
        getModelByTenant: sinon.stub().resolves(locationModelMock),
      });

      expect(result).to.deep.equal(registerErrorResponseMock);
      expect(locationModelMock.register.calledOnceWith(request.body)).to.be
        .true;
      // Add more assertions based on your error handling logic
    });

    // Add more test cases for different scenarios, e.g., Kafka errors, etc.
  });

  describe("update", () => {
    it("should update a location", async () => {
      // Mock the request object
      const request = {
        body: {
          // Replace with the necessary properties for location update
        },
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the LocationSchema modify method to return a successful response
      const modifyResponseMock = {
        success: true,
        data: {
          // Replace with the necessary properties for the updated location
        },
      };
      const locationModelMock = {
        modify: sinon.stub().resolves(modifyResponseMock),
      };

      // Call the function and assert
      const result = await updateLocation.update(request, {
        getModelByTenant: sinon.stub().resolves(locationModelMock),
      });

      expect(result).to.deep.equal(modifyResponseMock);
      expect(
        locationModelMock.modify.calledOnceWith({
          filter: sinon.match.object, // Replace this with the expected filter object
          update: request.body,
        })
      ).to.be.true;
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle errors during location update", async () => {
      // Mock the request object
      const request = {
        body: {
          // Replace with the necessary properties for location update
        },
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the LocationSchema modify method to return an error response
      const modifyErrorResponseMock = {
        success: false,
        message: "unable to update location",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: "Error message",
        },
      };
      const locationModelMock = {
        modify: sinon.stub().rejects(new Error("Error message")),
      };

      // Call the function and assert
      const result = await updateLocation.update(request, {
        getModelByTenant: sinon.stub().resolves(locationModelMock),
      });

      expect(result).to.deep.equal(modifyErrorResponseMock);
      expect(
        locationModelMock.modify.calledOnceWith({
          filter: sinon.match.object, // Replace this with the expected filter object
          update: request.body,
        })
      ).to.be.true;
      // Add more assertions based on your error handling logic
    });

    // Add more test cases for different scenarios, e.g., invalid input, etc.
  });

  describe("delete", () => {
    it("should delete a location", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the LocationSchema remove method to return a successful response
      const removeResponseMock = {
        success: true,
        data: {
          // Replace with the necessary properties for the deleted location
        },
      };
      const locationModelMock = {
        remove: sinon.stub().resolves(removeResponseMock),
      };

      // Call the function and assert
      const result = await deleteLocation.delete(request, {
        getModelByTenant: sinon.stub().resolves(locationModelMock),
      });

      expect(result).to.deep.equal(removeResponseMock);
      expect(
        locationModelMock.remove.calledOnceWith({
          filter: sinon.match.object, // Replace this with the expected filter object
        })
      ).to.be.true;
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle errors during location deletion", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the LocationSchema remove method to return an error response
      const removeErrorResponseMock = {
        success: false,
        message: "unable to delete location",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: "Error message",
        },
      };
      const locationModelMock = {
        remove: sinon.stub().rejects(new Error("Error message")),
      };

      // Call the function and assert
      const result = await deleteLocation.delete(request, {
        getModelByTenant: sinon.stub().resolves(locationModelMock),
      });

      expect(result).to.deep.equal(removeErrorResponseMock);
      expect(
        locationModelMock.remove.calledOnceWith({
          filter: sinon.match.object, // Replace this with the expected filter object
        })
      ).to.be.true;
      // Add more assertions based on your error handling logic
    });

    // Add more test cases for different scenarios, e.g., invalid input, etc.
  });

  describe("list", () => {
    it("should list locations", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
          skip: 0,
        },
      };

      // Mock the LocationSchema list method to return a successful response
      const listResponseMock = {
        success: true,
        data: [
          // Replace with the necessary location data objects
        ],
      };
      const locationModelMock = {
        list: sinon.stub().resolves(listResponseMock),
      };

      // Call the function and assert
      const result = await listLocation.list(request, {
        getModelByTenant: sinon.stub().resolves(locationModelMock),
      });

      expect(result).to.deep.equal(listResponseMock);
      expect(
        locationModelMock.list.calledOnceWith({
          filter: sinon.match.object, // Replace this with the expected filter object
          limit: 1000,
          skip: 0,
        })
      ).to.be.true;
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle errors during location listing", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
          skip: 0,
        },
      };

      // Mock the LocationSchema list method to return an error response
      const listErrorResponseMock = {
        success: false,
        message: "unable to list location",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: "Error message",
        },
      };
      const locationModelMock = {
        list: sinon.stub().rejects(new Error("Error message")),
      };

      // Call the function and assert
      const result = await listLocation.list(request, {
        getModelByTenant: sinon.stub().resolves(locationModelMock),
      });

      expect(result).to.deep.equal(listErrorResponseMock);
      expect(
        locationModelMock.list.calledOnceWith({
          filter: sinon.match.object, // Replace this with the expected filter object
          limit: 1000,
          skip: 0,
        })
      ).to.be.true;
      // Add more assertions based on your error handling logic
    });

    // Add more test cases for different scenarios, e.g., pagination, filters, etc.
  });

  // Add more describe blocks and test cases for other utility functions as needed

  // ...
});

// Add more high-level describe blocks and test cases for other modules as needed

// ...
