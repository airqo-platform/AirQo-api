const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;

const generateFilter = require("./generate-filter");

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
    it("should generate filter object with host_id and transaction_id fields", () => {
      const req = {
        query: {
          host_id: "12345",
          transaction_id: "67890",
        },
      };

      const result = generateFilter.transactions(req);

      expect(result).to.be.an("object");
      expect(result).to.have.property("host_id", "12345");
      expect(result).to.have.property("transaction_id", "67890");
    });

    it("should generate filter object with _id and status fields", () => {
      const req = {
        query: {
          id: "12345",
          status: "completed",
        },
      };

      const result = generateFilter.transactions(req);

      expect(result).to.be.an("object");
      expect(result).to.have.property("_id", "12345");
      expect(result).to.have.property("status", "completed");
    });

    it("should return empty filter object if no parameters provided", () => {
      const req = {
        query: {},
      };

      const result = generateFilter.transactions(req);

      expect(result).to.be.an("object");
      expect(result).to.be.empty;
    });
  });

  // Add more test cases for other methods in generateFilter
});
