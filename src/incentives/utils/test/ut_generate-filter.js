const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;

const generateFilter = require("@utils/generate-filter");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

describe("generateFilter", () => {
  describe("hosts", () => {
    it("should generate filter object with _id field", () => {
      const req = {
        query: {
          id: "12345",
        },
        params: {},
      };

      const result = generateFilter.hosts(req);

      expect(result).to.be.an("object");
      expect(result).to.have.property("_id", "12345");
    });

    it("should generate filter object with _id field from params", () => {
      const req = {
        query: {},
        params: {
          host_id: "67890",
        },
      };

      const result = generateFilter.hosts(req);

      expect(result).to.be.an("object");
      expect(result).to.have.property("_id", "67890");
    });

    it("should return empty filter object if no id or host_id provided", () => {
      const req = {
        query: {},
        params: {},
      };

      const result = generateFilter.hosts(req);

      expect(result).to.be.an("object");
      expect(result).to.be.empty;
    });
  });

  describe("transactions", () => {
    it("should generate valid filter object based on parameters", () => {
      const req = {
        params: {
          id: "fakeId",
          status: "completed",
          transaction_id: "fakeTransactionId",
          host_id: "fakeHostId",
        },
      };

      const fakeFilter = {
        _id: ObjectId("fakeId"),
        status: "completed",
        transaction_id: "fakeTransactionId",
        host_id: ObjectId("fakeHostId"),
      };

      const result = generateFilter.transactions(req);

      expect(result).to.deep.equal(fakeFilter);
    });

    it("should generate empty filter object when no parameters are provided", () => {
      const req = {
        params: {},
      };

      const fakeFilter = {};

      const result = generateFilter.transactions(req);

      expect(result).to.deep.equal(fakeFilter);
    });

    it("should handle error and return error response", () => {
      const req = {
        params: {
          id: "fakeId",
        },
      };

      const fakeErrorMessage = "An error occurred";

      const ObjectIdStub = sinon
        .stub(ObjectId, "isValid")
        .throws(new Error(fakeErrorMessage));

      const result = generateFilter.transactions(req);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server error");
      expect(result.errors.message).to.equal(fakeErrorMessage);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      ObjectIdStub.restore();
    });
  });

  // Add more test cases for other methods in generateFilter
});
