require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");

const rewireToken = rewire("@utils/token.util");

describe("token util", () => {
  let req, next;
  let origAccessTokenModel,
    origBlacklistedIPModel,
    origBlacklistedIPRangeModel,
    origBlacklistedIPPrefixModel,
    origWhitelistedIPModel,
    origBlockedDomainModel,
    origApiUsageCounterModel,
    origGenerateFilter,
    origClientModel,
    origUserModel;

  beforeEach(() => {
    req = {
      body: {},
      query: { tenant: "airqo" },
      params: {},
      headers: {},
    };
    next = sinon.stub();

    origAccessTokenModel = rewireToken.__get__("AccessTokenModel");
    origBlacklistedIPModel = rewireToken.__get__("BlacklistedIPModel");
    origBlacklistedIPRangeModel = rewireToken.__get__("BlacklistedIPRangeModel");
    origBlacklistedIPPrefixModel = rewireToken.__get__("BlacklistedIPPrefixModel");
    origWhitelistedIPModel = rewireToken.__get__("WhitelistedIPModel");
    origBlockedDomainModel = rewireToken.__get__("BlockedDomainModel");
    origApiUsageCounterModel = rewireToken.__get__("ApiUsageCounterModel");
    origGenerateFilter = rewireToken.__get__("generateFilter");
    origClientModel = rewireToken.__get__("ClientModel");
    origUserModel = rewireToken.__get__("UserModel");
  });

  afterEach(() => {
    rewireToken.__set__("AccessTokenModel", origAccessTokenModel);
    rewireToken.__set__("BlacklistedIPModel", origBlacklistedIPModel);
    rewireToken.__set__("BlacklistedIPRangeModel", origBlacklistedIPRangeModel);
    rewireToken.__set__("BlacklistedIPPrefixModel", origBlacklistedIPPrefixModel);
    rewireToken.__set__("WhitelistedIPModel", origWhitelistedIPModel);
    rewireToken.__set__("BlockedDomainModel", origBlockedDomainModel);
    rewireToken.__set__("ApiUsageCounterModel", origApiUsageCounterModel);
    rewireToken.__set__("generateFilter", origGenerateFilter);
    rewireToken.__set__("ClientModel", origClientModel);
    rewireToken.__set__("UserModel", origUserModel);
    sinon.restore();
  });

  describe("listAccessToken()", () => {
    it("should return access tokens on success", async () => {
      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        tokens: sinon.stub().returns({}),
      });
      rewireToken.__set__("AccessTokenModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: [{ token: "tok1" }],
        }),
      }));

      const result = await rewireToken.listAccessToken(req, next);

      expect(result.success).to.equal(true);
      expect(result.data).to.be.an("array");
    });

    it("should call next on unexpected error", async () => {
      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        tokens: sinon.stub().returns({}),
      });
      rewireToken.__set__("AccessTokenModel", () => ({
        list: sinon.stub().throws(new Error("DB failure")),
      }));

      req.query.token = "some-token";

      await rewireToken.listAccessToken(req, next);

      expect(next.called).to.equal(true);
    });
  });

  describe("blackListIp()", () => {
    it("should blacklist an IP and return success", async () => {
      req.body = { ip: "192.168.1.100" };

      rewireToken.__set__("BlacklistedIPModel", () => ({
        register: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: { ip: "192.168.1.100" },
        }),
      }));

      const result = await rewireToken.blackListIp(req, next);

      expect(result.success).to.equal(true);
    });

    it("should call next on error", async () => {
      req.body = { ip: "10.0.0.1" };

      rewireToken.__set__("BlacklistedIPModel", () => ({
        register: sinon.stub().throws(new Error("DB failure")),
      }));

      await rewireToken.blackListIp(req, next);

      expect(next.calledOnce).to.equal(true);
    });
  });

  describe("removeBlacklistedIp()", () => {
    it("should remove a blacklisted IP and return success", async () => {
      req.params = { ip: "10.0.0.1" };

      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        blacklistedIPs: sinon.stub().returns({ ip: "10.0.0.1" }),
      });
      rewireToken.__set__("BlacklistedIPModel", () => ({
        remove: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: {},
        }),
      }));

      const result = await rewireToken.removeBlacklistedIp(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("listBlacklistedIp()", () => {
    it("should list blacklisted IPs", async () => {
      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        blacklistedIPs: sinon.stub().returns({}),
      });
      rewireToken.__set__("BlacklistedIPModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: [{ ip: "1.2.3.4" }],
        }),
      }));

      const result = await rewireToken.listBlacklistedIp(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("whiteListIp()", () => {
    it("should whitelist an IP and return success", async () => {
      req.body = { ip: "10.0.0.2" };

      rewireToken.__set__("WhitelistedIPModel", () => ({
        register: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: { ip: "10.0.0.2" },
        }),
      }));

      const result = await rewireToken.whiteListIp(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("removeWhitelistedIp()", () => {
    it("should remove a whitelisted IP", async () => {
      req.params = { ip: "10.0.0.2" };

      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        whitelistedIPs: sinon.stub().returns({ ip: "10.0.0.2" }),
      });
      rewireToken.__set__("WhitelistedIPModel", () => ({
        remove: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: {},
        }),
      }));

      const result = await rewireToken.removeWhitelistedIp(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("listWhitelistedIp()", () => {
    it("should list whitelisted IPs", async () => {
      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        whitelistedIPs: sinon.stub().returns({}),
      });
      rewireToken.__set__("WhitelistedIPModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: [{ ip: "10.0.0.2" }],
        }),
      }));

      const result = await rewireToken.listWhitelistedIp(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("blackListIpRange()", () => {
    it("should blacklist an IP range and return success", async () => {
      req.body = { range_start: "192.168.1.0", range_end: "192.168.1.255" };

      rewireToken.__set__("BlacklistedIPRangeModel", () => ({
        register: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: {},
        }),
      }));

      const result = await rewireToken.blackListIpRange(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("removeBlacklistedIpRange()", () => {
    it("should remove an IP range", async () => {
      req.params = { range_id: "rangeid1" };

      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        blacklistedIPRanges: sinon.stub().returns({ _id: "rangeid1" }),
      });
      rewireToken.__set__("BlacklistedIPRangeModel", () => ({
        remove: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: {},
        }),
      }));

      const result = await rewireToken.removeBlacklistedIpRange(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("listBlacklistedIpRange()", () => {
    it("should list blacklisted IP ranges", async () => {
      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        blacklistedIPRanges: sinon.stub().returns({}),
      });
      rewireToken.__set__("BlacklistedIPRangeModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: [],
        }),
      }));

      const result = await rewireToken.listBlacklistedIpRange(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("blackListIpPrefix()", () => {
    it("should blacklist an IP prefix and return success", async () => {
      req.body = { prefix: "192.168.1" };

      rewireToken.__set__("BlacklistedIPPrefixModel", () => ({
        register: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: { prefix: "192.168.1" },
        }),
      }));

      const result = await rewireToken.blackListIpPrefix(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("listBlacklistedIpPrefix()", () => {
    it("should list blacklisted IP prefixes", async () => {
      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        blacklistedIPPrefixes: sinon.stub().returns({}),
      });
      rewireToken.__set__("BlacklistedIPPrefixModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: [],
        }),
      }));

      const result = await rewireToken.listBlacklistedIpPrefix(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("extractAndNormalizeDomain()", () => {
    it("should extract domain from a full URL", () => {
      const domain = rewireToken.extractAndNormalizeDomain("https://example.com/path?q=1");
      expect(domain).to.equal("example.com");
    });

    it("should handle a bare hostname", () => {
      const domain = rewireToken.extractAndNormalizeDomain("example.com");
      expect(domain).to.equal("example.com");
    });

    it("should return null for a completely invalid URL", () => {
      const domain = rewireToken.extractAndNormalizeDomain(":::invalid");
      expect(domain).to.equal(null);
    });
  });

  describe("createBlockedDomain()", () => {
    it("should create a blocked domain and return success", async () => {
      req.body = { domain: "spam.com" };

      rewireToken.__set__("BlockedDomainModel", () => ({
        register: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: { domain: "spam.com" },
        }),
      }));

      const result = await rewireToken.createBlockedDomain(req, next);

      expect(result).to.not.equal(undefined);
      expect(result.success).to.equal(true);
    });
  });

  describe("listBlockedDomains()", () => {
    it("should list blocked domains", async () => {
      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        blockedDomains: sinon.stub().returns({}),
      });
      rewireToken.__set__("BlockedDomainModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: [{ domain: "spam.com" }],
        }),
      }));

      const result = await rewireToken.listBlockedDomains(req, next);

      expect(result).to.not.equal(undefined);
      expect(result.success).to.equal(true);
    });
  });

  describe("deleteAccessToken()", () => {
    it("should delete an access token and return success", async () => {
      req.params = { token: "tok123" };

      rewireToken.__set__("generateFilter", {
        ...origGenerateFilter,
        tokens: sinon.stub().returns({ token: "tok123" }),
      });
      rewireToken.__set__("AccessTokenModel", () => ({
        remove: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: {},
        }),
      }));

      const result = await rewireToken.deleteAccessToken(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("updateAccessToken()", () => {
    it("should update an access token and return success", async () => {
      req.body = { name: "Updated Token" };
      req.params = { token: "tok123" };
      req.user = { email: "admin@airqo.net", _id: "uid1" };

      const tokenRecord = { _id: "tid1", token: "tok123", client_id: "cid1" };
      const updatedToken = { _id: "tid1", name: "Updated Token" };
      const origConstants = rewireToken.__get__("constants");

      rewireToken.__set__("constants", {
        ...origConstants,
        SUPER_ADMIN_EMAIL_ALLOWLIST: ["admin@airqo.net"],
      });

      rewireToken.__set__("AccessTokenModel", () => ({
        find: sinon.stub().returns({
          lean: sinon.stub().resolves([tokenRecord]),
        }),
        findByIdAndUpdate: sinon.stub().returns({
          lean: sinon.stub().resolves(updatedToken),
        }),
      }));

      let result;
      try {
        result = await rewireToken.updateAccessToken(req, next);
      } finally {
        rewireToken.__set__("constants", origConstants);
      }

      expect(result).to.not.equal(undefined);
      expect(result).to.have.property("success", true);
    });
  });

  describe("updateAccessToken() - bypass field admin gating", () => {
    it("strips bypass_* fields for a non-admin owner but keeps other fields", async () => {
      req.body = {
        name: "Updated Token",
        bypass_compromise_detection: true,
        bypass_ip_blacklist_expires_at: "2050-01-01T00:00:00Z",
      };
      req.params = { token: "tok123" };
      req.user = { email: "owner@example.com", _id: "uid1" };

      const tokenRecord = { _id: "tid1", token: "tok123", client_id: "cid1" };
      const updatedToken = { _id: "tid1", name: "Updated Token" };
      const origConstants = rewireToken.__get__("constants");

      rewireToken.__set__("constants", {
        ...origConstants,
        SUPER_ADMIN_EMAIL_ALLOWLIST: ["admin@airqo.net"],
      });
      rewireToken.__set__("ClientModel", () => ({
        findById: sinon.stub().returns({
          select: sinon.stub().returns({
            lean: sinon.stub().resolves({ user_id: "uid1" }),
          }),
        }),
      }));

      let capturedUpdate;
      rewireToken.__set__("AccessTokenModel", () => ({
        find: sinon.stub().returns({
          lean: sinon.stub().resolves([tokenRecord]),
        }),
        findByIdAndUpdate: sinon.stub().callsFake((id, update) => {
          capturedUpdate = update;
          return { lean: sinon.stub().resolves(updatedToken) };
        }),
      }));

      let result;
      try {
        result = await rewireToken.updateAccessToken(req, next);
      } finally {
        rewireToken.__set__("constants", origConstants);
      }

      expect(result).to.have.property("success", true);
      expect(capturedUpdate).to.not.have.property("bypass_compromise_detection");
      expect(capturedUpdate).to.not.have.property("bypass_ip_blacklist_expires_at");
      expect(capturedUpdate).to.have.property("name", "Updated Token");
    });

    it("allows an admin to set bypass_* fields and their expiry", async () => {
      req.body = {
        bypass_ip_blacklist: true,
        bypass_ip_blacklist_expires_at: "2050-01-01T00:00:00Z",
      };
      req.params = { token: "tok123" };
      req.user = { email: "admin@airqo.net", _id: "uid1" };

      const tokenRecord = { _id: "tid1", token: "tok123", client_id: "cid1" };
      const updatedToken = {
        _id: "tid1",
        bypass_ip_blacklist: true,
        bypass_ip_blacklist_expires_at: "2050-01-01T00:00:00Z",
      };
      const origConstants = rewireToken.__get__("constants");

      rewireToken.__set__("constants", {
        ...origConstants,
        SUPER_ADMIN_EMAIL_ALLOWLIST: ["admin@airqo.net"],
      });

      let capturedUpdate;
      rewireToken.__set__("AccessTokenModel", () => ({
        find: sinon.stub().returns({
          lean: sinon.stub().resolves([tokenRecord]),
        }),
        findByIdAndUpdate: sinon.stub().callsFake((id, update) => {
          capturedUpdate = update;
          return { lean: sinon.stub().resolves(updatedToken) };
        }),
      }));

      let result;
      try {
        result = await rewireToken.updateAccessToken(req, next);
      } finally {
        rewireToken.__set__("constants", origConstants);
      }

      expect(result).to.have.property("success", true);
      expect(capturedUpdate).to.have.property("bypass_ip_blacklist", true);
      expect(capturedUpdate).to.have.property(
        "bypass_ip_blacklist_expires_at",
        "2050-01-01T00:00:00Z"
      );
    });
  });

  describe("_isBypassActive()", () => {
    const isBypassActive = rewireToken.__get__("_isBypassActive");

    it("returns false when the flag is false", () => {
      expect(isBypassActive(false, null)).to.equal(false);
    });

    it("returns true when the flag is true and no expiry is set", () => {
      expect(isBypassActive(true, null)).to.equal(true);
    });

    it("returns true when the flag is true and the expiry is in the future", () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      expect(isBypassActive(true, future)).to.equal(true);
    });

    it("returns false when the flag is true but the expiry is in the past", () => {
      const past = new Date(Date.now() - 60 * 60 * 1000);
      expect(isBypassActive(true, past)).to.equal(false);
    });
  });

  describe("listActiveBypasses()", () => {
    it("returns an empty array when no tokens have an active bypass", async () => {
      rewireToken.__set__("AccessTokenModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({ lean: sinon.stub().resolves([]) }),
        }),
      }));

      const result = await rewireToken.listActiveBypasses("airqo");
      expect(result).to.deep.equal([]);
    });

    it("excludes bypasses whose expiry has already passed and resolves owner info", async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const past = new Date(Date.now() - 60 * 60 * 1000);
      const docs = [
        {
          _id: "t1",
          name: "Tok One",
          token: "abcd1234wxyzWXYZ",
          client_id: "cid1",
          bypass_anomaly_detection: true,
          bypass_anomaly_detection_expires_at: future,
          bypass_compromise_detection: true,
          bypass_compromise_detection_expires_at: past,
          bypass_ip_blacklist: false,
          bypass_ip_blacklist_expires_at: null,
        },
      ];

      rewireToken.__set__("AccessTokenModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({ lean: sinon.stub().resolves(docs) }),
        }),
      }));
      rewireToken.__set__("ClientModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({
            lean: sinon.stub().resolves([{ _id: "cid1", user_id: "uid1" }]),
          }),
        }),
      }));
      rewireToken.__set__("UserModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({
            lean: sinon.stub().resolves([
              { _id: "uid1", email: "owner@example.com", firstName: "O", lastName: "Wner" },
            ]),
          }),
        }),
      }));

      const result = await rewireToken.listActiveBypasses("airqo");

      expect(result).to.have.lengthOf(1);
      expect(result[0].owner_email).to.equal("owner@example.com");
      expect(result[0].bypasses).to.have.lengthOf(1);
      expect(result[0].bypasses[0].type).to.equal("bypass_anomaly_detection");
    });
  });

  describe("getApiUsageStats()", () => {
    it("should return usage stats with hourly/daily/monthly structure", async () => {
      rewireToken.__set__("ApiUsageCounterModel", () => ({
        findOne: sinon.stub().returns({
          select: sinon.stub().returnsThis(),
          lean: sinon.stub().resolves({ count: 5 }),
        }),
      }));

      const result = await rewireToken.getApiUsageStats("user-id-123", "Free");

      expect(result).to.have.property("hourly");
      expect(result).to.have.property("daily");
      expect(result).to.have.property("monthly");
    });
  });

  describe("invalidateBlockedAsnCache()", () => {
    it("should call without throwing", async () => {
      let threw = false;
      try {
        await rewireToken.invalidateBlockedAsnCache("airqo");
      } catch {
        threw = true;
      }
      expect(threw).to.equal(false);
    });
  });
});
