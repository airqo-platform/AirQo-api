require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const { expect } = chai;
const {
  validateTenant,
  validateAirqoTenantOnly,
  validateTokenParam,
  validateTokenCreate,
  validateTokenUpdate,
  validateSingleIp,
  validateMultipleIps,
  validatePagination,
  validateIpRange,
  validateMultipleIpRanges,
  validateIpRangeIdParam,
  validateIpParam,
  validateIpPrefix,
  validateMultipleIpPrefixes,
  validateIdParam,
} = require("@validators/token.validators");

chai.use(sinonChai);

describe("Validation Functions", () => {
  describe("validateTenant", () => {
    it("should validate KCCA tenant", () => {
      const result = validateTenant({ tenant: "KCCA" });
      expect(result).to.be.undefined;
    });

    it("should reject invalid tenants", () => {
      const result = validateTenant({ tenant: "invalid" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the tenant value is not among the expected ones");
    });
  });

  describe("validateAirqoTenantOnly", () => {
    it("should validate AIRQO tenant", () => {
      const result = validateAirqoTenantOnly({ tenant: "AIRQO" });
      expect(result).to.be.undefined;
    });

    it("should reject invalid tenants", () => {
      const result = validateAirqoTenantOnly({ tenant: "invalid" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the tenant value is not among the expected ones");
    });
  });

  describe("validateTokenParam", () => {
    it("should validate token parameter", () => {
      const result = validateTokenParam({ token: "valid-token" });
      expect(result).to.be.undefined;
    });

    it("should reject missing token", () => {
      const result = validateTokenParam({});
      expect(result)
        .to.have.property("msg")
        .that.equals("the token parameter is missing in the request");
    });

    it("should reject empty token", () => {
      const result = validateTokenParam({ token: "" });
      expect(result)
        .to.have.property("msg")
        .that.equals("token must not be empty");
    });
  });

  describe("validateTokenCreate", () => {
    it("should validate name field", () => {
      const result = validateTokenCreate([{ name: "Valid Name" }]);
      expect(result).to.be.undefined;
    });

    it("should reject missing name", () => {
      const result = validateTokenCreate([]);
      expect(result)
        .to.have.property("msg")
        .that.equals("the name is missing in your request");
    });

    it("should validate client_id", () => {
      const result = validateTokenCreate([
        { client_id: "1234567890abcdef1234567890abcdef" },
      ]);
      expect(result).to.be.undefined;
    });

    it("should reject invalid client_id", () => {
      const result = validateTokenCreate([{ client_id: "invalid" }]);
      expect(result)
        .to.have.property("msg")
        .that.equals("this client_id cannot be empty");
    });

    it("should sanitize client_id", () => {
      const result = validateTokenCreate([
        { client_id: "1234567890abcdef1234567890abcdef" },
      ]);
      expect(result[0].client_id).to.equal("1234567890abcdef1234567890abcdef");
    });

    it("should validate expires field", () => {
      const result = validateTokenCreate([{ expires: "2023-12-31T23:59:59Z" }]);
      expect(result).to.be.undefined;
    });

    it("should reject invalid expires format", () => {
      const result = validateTokenCreate([{ expires: "invalid-date" }]);
      expect(result)
        .to.have.property("msg")
        .that.equals("expires must be a valid datetime.");
    });

    it("should reject future dates", () => {
      const result = validateTokenCreate([{ expires: "2050-01-01T00:00:00Z" }]);
      expect(result)
        .to.have.property("msg")
        .that.equals("the date should not be before the current date");
    });
  });

  describe("validateTokenUpdate", () => {
    it("should validate expires field", () => {
      const result = validateTokenUpdate([{ expires: "2023-12-31T23:59:59Z" }]);
      expect(result).to.be.undefined;
    });

    it("should reject invalid expires format", () => {
      const result = validateTokenUpdate([{ expires: "invalid-date" }]);
      expect(result)
        .to.have.property("msg")
        .that.equals("expires must be a valid datetime.");
    });

    it("should reject future dates", () => {
      const result = validateTokenUpdate([{ expires: "2050-01-01T00:00:00Z" }]);
      expect(result)
        .to.have.property("msg")
        .that.equals("the date should not be before the current date");
    });
  });

  describe("validateSingleIp", () => {
    it("should validate single IP", () => {
      const result = validateSingleIp({ ip: "192.168.1.1" });
      expect(result).to.be.undefined;
    });

    it("should reject missing IP", () => {
      const result = validateSingleIp({});
      expect(result)
        .to.have.property("msg")
        .that.equals("the ip is missing in your request body");
    });

    it("should reject empty IP", () => {
      const result = validateSingleIp({ ip: "" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the ip should not be empty if provided");
    });

    it("should reject invalid IP", () => {
      const result = validateSingleIp({ ip: "256.256.256.256" });
      expect(result).to.have.property("msg").that.equals("Invalid IP address");
    });
  });

  describe("validateMultipleIps", () => {
    it("should validate multiple IPs", () => {
      const result = validateMultipleIps({ ips: ["192.168.1.1", "10.0.0.1"] });
      expect(result).to.be.undefined;
    });

    it("should reject missing IPs", () => {
      const result = validateMultipleIps({});
      expect(result)
        .to.have.property("msg")
        .that.equals("the ips are missing in your request body");
    });

    it("should reject empty IPs", () => {
      const result = validateMultipleIps({ ips: [] });
      expect(result)
        .to.have.property("msg")
        .that.equals("the ips should not be empty in the request body");
    });

    it("should reject non-array IPs", () => {
      const result = validateMultipleIps({ ips: "not-an-array" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the ips should be an array");
    });

    it("should reject individual empty IPs", () => {
      const result = validateMultipleIps({ ips: ["", "192.168.1.1"] });
      expect(result)
        .to.have.property("msg")
        .that.equals("Provided ips should NOT be empty");
    });

    it("should reject invalid IP", () => {
      const result = validateMultipleIps({
        ips: ["192.168.1.1", "256.256.256.256"],
      });
      expect(result)
        .to.have.property("msg")
        .that.equals("IP address provided must be a valid IP address");
    });
  });

  describe("validatePagination", () => {
    it("should set default values for pagination", () => {
      const req = {};
      validatePagination(req, {}, () => {});
      expect(req.query.limit).to.equal(100);
      expect(req.query.skip).to.equal(0);
    });

    it("should set custom limit", () => {
      const req = { query: { limit: 50 } };
      validatePagination(req, {}, () => {});
      expect(req.query.limit).to.equal(50);
    });

    it("should set custom skip", () => {
      const req = { query: { skip: 25 } };
      validatePagination(req, {}, () => {});
      expect(req.query.skip).to.equal(25);
    });

    it("should clamp limit below 1", () => {
      const req = { query: { limit: 0 } };
      validatePagination(req, {}, () => {});
      expect(req.query.limit).to.equal(1);
    });

    it("should clamp skip below 0", () => {
      const req = { query: { skip: -5 } };
      validatePagination(req, {}, () => {});
      expect(req.query.skip).to.equal(0);
    });
  });

  describe("validateIpParam", () => {
    it("should validate IP parameter", () => {
      const result = validateIpParam({ ip: "192.168.1.1" });
      expect(result).to.be.undefined;
    });

    it("should reject missing IP", () => {
      const result = validateIpParam({});
      expect(result)
        .to.have.property("msg")
        .that.equals("the ip parameter is missing in the request");
    });

    it("should reject empty IP", () => {
      const result = validateIpParam({ ip: "" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the ip must not be empty");
    });

    it("should reject invalid IP", () => {
      const result = validateIpParam({ ip: "256.256.256.256" });
      expect(result).to.have.property("msg").that.equals("Invalid IP address");
    });
  });

  describe("validateIpRange", () => {
    it("should validate IP range", () => {
      const result = validateIpRange({ range: "192.168.0.0-192.168.255.255" });
      expect(result).to.be.undefined;
    });

    it("should reject missing range", () => {
      const result = validateIpRange({});
      expect(result)
        .to.have.property("msg")
        .that.equals("the range is missing in your request body");
    });

    it("should reject empty range", () => {
      const result = validateIpRange({ range: "" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the range should not be empty if provided");
    });

    it("should reject invalid range format", () => {
      const result = validateIpRange({ range: "invalid-range" });
      expect(result).to.have.property("msg").that.equals("Invalid IP address");
    });
  });

  describe("validateMultipleIpRanges", () => {
    it("should validate multiple IP ranges", () => {
      const result = validateMultipleIpRanges({
        ranges: ["192.168.0.0-192.168.255.255", "10.0.0.0-10.255.255.255"],
      });
      expect(result).to.be.undefined;
    });

    it("should reject missing ranges", () => {
      const result = validateMultipleIpRanges({});
      expect(result)
        .to.have.property("msg")
        .that.equals("the ranges are missing in your request body");
    });

    it("should reject empty ranges", () => {
      const result = validateMultipleIpRanges({ ranges: [] });
      expect(result)
        .to.have.property("msg")
        .that.equals("the ranges should not be empty in the request body");
    });

    it("should reject non-array ranges", () => {
      const result = validateMultipleIpRanges({ ranges: "not-an-array" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the ranges should be an array");
    });

    it("should reject individual empty ranges", () => {
      const result = validateMultipleIpRanges({
        ranges: ["", "192.168.0.0-192.168.255.255"],
      });
      expect(result)
        .to.have.property("msg")
        .that.equals("Provided range should NOT be empty");
    });

    it("should reject invalid IP range", () => {
      const result = validateMultipleIpRanges({
        ranges: ["192.168.0.0-192.168.255.255", "256.256.256.256-257.0.0.0"],
      });
      expect(result)
        .to.have.property("msg")
        .that.equals("IP address provided must be a valid IP address");
    });
  });

  describe("validateIpRangeIdParam", () => {
    it("should validate IP range ID parameter", () => {
      const result = validateIpRangeIdParam({
        id: "1234567890abcdef1234567890abcdef",
      });
      expect(result).to.be.undefined;
    });

    it("should reject missing ID", () => {
      const result = validateIpRangeIdParam({});
      expect(result)
        .to.have.property("msg")
        .that.equals("the id param is missing in the request");
    });

    it("should reject empty ID", () => {
      const result = validateIpRangeIdParam({ id: "" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the id cannot be empty when provided");
    });

    it("should reject invalid ID", () => {
      const result = validateIpRangeIdParam({ id: "invalid" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the id must be an object ID");
    });

    it("should sanitize ID", () => {
      const result = validateIpRangeIdParam({
        id: "1234567890abcdef1234567890abcdef",
      });
      expect(result.id).to.equal("1234567890abcdef1234567890abcdef");
    });
  });

  describe("validateIpPrefix", () => {
    it("should validate IP prefix", () => {
      const result = validateIpPrefix({ prefix: "/24" });
      expect(result).to.be.undefined;
    });

    it("should reject missing prefix", () => {
      const result = validateIpPrefix({});
      expect(result)
        .to.have.property("msg")
        .that.equals("the prefix is missing in your request body");
    });

    it("should reject empty prefix", () => {
      const result = validateIpPrefix({ prefix: "" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the prefix should not be empty if provided");
    });

    it("should reject invalid prefix format", () => {
      const result = validateIpPrefix({ prefix: "invalid-prefix" });
      expect(result).to.have.property("msg").that.equals("Invalid IP address");
    });
  });

  describe("validateMultipleIpPrefixes", () => {
    it("should validate multiple IP prefixes", () => {
      const result = validateMultipleIpPrefixes({ prefixes: ["/24", "/16"] });
      expect(result).to.be.undefined;
    });

    it("should reject missing prefixes", () => {
      const result = validateMultipleIpPrefixes({});
      expect(result)
        .to.have.property("msg")
        .that.equals("the prefixes are missing in your request body");
    });

    it("should reject empty prefixes", () => {
      const result = validateMultipleIpPrefixes({ prefixes: [] });
      expect(result)
        .to.have.property("msg")
        .that.equals("the prefixes should not be empty in the request body");
    });

    it("should reject non-array prefixes", () => {
      const result = validateMultipleIpPrefixes({ prefixes: "not-an-array" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the prefixes should be an array");
    });

    it("should reject individual empty prefixes", () => {
      const result = validateMultipleIpPrefixes({ prefixes: ["", "/24"] });
      expect(result)
        .to.have.property("msg")
        .that.equals("Provided prefix should NOT be empty");
    });

    it("should reject invalid IP prefix", () => {
      const result = validateMultipleIpPrefixes({ prefixes: ["/", "/24"] });
      expect(result)
        .to.have.property("msg")
        .that.equals("IP address provided must be a valid IP address");
    });
  });

  describe("validateIdParam", () => {
    it("should validate ID parameter", () => {
      const result = validateIdParam({
        id: "1234567890abcdef1234567890abcdef",
      });
      expect(result).to.be.undefined;
    });

    it("should reject missing ID", () => {
      const result = validateIdParam({});
      expect(result)
        .to.have.property("msg")
        .that.equals("the id param is missing in the request");
    });

    it("should reject empty ID", () => {
      const result = validateIdParam({ id: "" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the id cannot be empty when provided");
    });

    it("should reject invalid ID", () => {
      const result = validateIdParam({ id: "invalid" });
      expect(result)
        .to.have.property("msg")
        .that.equals("the id must be an object ID");
    });

    it("should sanitize ID", () => {
      const result = validateIdParam({
        id: "1234567890abcdef1234567890abcdef",
      });
      expect(result.id).to.equal("1234567890abcdef1234567890abcdef");
    });
  });
});
