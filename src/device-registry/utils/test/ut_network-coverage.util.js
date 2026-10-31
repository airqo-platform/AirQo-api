require("module-alias/register");
const chai = require("chai");
const proxyquire = require("proxyquire");
const httpStatus = require("http-status");

const { expect } = chai;

const lean = (value) => ({ lean: async () => value });

const SITES = [
  {
    _id: "site-nbo-1",
    name: "Westlands",
    city: "Nairobi",
    country: "Kenya",
    approximate_latitude: -1.26,
    approximate_longitude: 36.8,
    isOnline: true,
    network: "airqo",
  },
  {
    _id: "site-nbo-2",
    name: "Kibera",
    city: "Nairobi",
    country: "Kenya",
    approximate_latitude: -1.32,
    approximate_longitude: 36.78,
    isOnline: false,
    network: "airqo",
  },
  {
    _id: "site-ksm-1",
    name: "Kisumu Central",
    city: "Kisumu",
    country: "Kenya",
    approximate_latitude: -0.1,
    approximate_longitude: 34.75,
    isOnline: true,
    network: "airqo",
  },
  {
    _id: "site-bjl-1",
    name: "Banjul",
    city: "Banjul",
    country: "The Gambia",
    approximate_latitude: 13.45,
    approximate_longitude: -16.58,
    isOnline: true,
    network: "airqo",
  },
];

function loadUtil({ siteById = null, registerResult, hasActiveDevice = true, sites = SITES } = {}) {
  const DeviceModel = () => ({
    aggregate: async () =>
      sites.map((s) => ({ _id: s._id, category: "lowcost" })),
    exists: async () => (hasActiveDevice ? { _id: "device-1" } : null),
  });
  DeviceModel["@noCallThru"] = true;

  const SiteModel = () => ({
    find: () => lean(sites),
    findById: () => lean(siteById),
  });
  SiteModel["@noCallThru"] = true;

  const RegistryModel = () => ({
    find: () => lean([]),
    register: async () => registerResult,
  });
  RegistryModel.MONITOR_TYPES = ["Reference", "LCS", "Inactive"];
  RegistryModel.MONITOR_STATUSES = ["active", "inactive"];
  RegistryModel["@noCallThru"] = true;

  const emptyModel = () => ({ find: () => lean([]), aggregate: async () => [] });
  emptyModel["@noCallThru"] = true;

  return proxyquire("@utils/network-coverage.util", {
    "@models/Device": DeviceModel,
    "@models/Site": SiteModel,
    "@models/NetworkCoverageRegistry": RegistryModel,
    "@models/Grid": emptyModel,
    "@models/SdgCity": emptyModel,
    "@models/CityPopulationRegistry": emptyModel,
  });
}

describe("networkCoverageUtil", () => {
  describe("list", () => {
    it("returns city-level matches for a city search", async () => {
      const util = loadUtil();
      const result = await util.list({
        query: { tenant: "airqo", search: "nairobi" },
      });

      expect(result.success).to.be.true;
      expect(result.data.meta.totalMonitors).to.equal(2);
      expect(result.data.cityMatches).to.have.lengthOf(1);
      const [match] = result.data.cityMatches;
      expect(match).to.include({
        city: "Nairobi",
        country: "Kenya",
        countryId: "kenya",
        iso2: "KE",
        total: 2,
        active: 1,
        inactive: 1,
      });
      expect(match.center.latitude).to.be.closeTo(-1.29, 1e-9);
      expect(match.center.longitude).to.be.closeTo(36.79, 1e-9);
    });

    it("does not list cities that matched only through their country", async () => {
      const util = loadUtil();
      const result = await util.list({
        query: { tenant: "airqo", search: "kenya" },
      });

      expect(result.data.meta.totalMonitors).to.equal(3);
      expect(result.data.cityMatches).to.deep.equal([]);
    });

    it("groups a city across differently cased country names", async () => {
      const util = loadUtil({
        sites: [...SITES, { ...SITES[0], _id: "site-nbo-3", country: "KENYA" }],
      });
      const result = await util.list({
        query: { tenant: "airqo", search: "nairobi" },
      });

      expect(result.data.cityMatches).to.have.lengthOf(1);
      expect(result.data.cityMatches[0].total).to.equal(3);
    });

    it("omits cityMatches when no search is supplied", async () => {
      const util = loadUtil();
      const result = await util.list({ query: { tenant: "airqo" } });

      expect(result.data.cityMatches).to.be.undefined;
    });

    it("matches ISO2 codes exactly", async () => {
      const util = loadUtil();
      const result = await util.list({ query: { tenant: "airqo", search: "GM" } });

      expect(result.data.meta.totalMonitors).to.equal(1);
      expect(result.data.countries[0]).to.include({
        country: "The Gambia",
        iso2: "GM",
      });
    });
  });

  describe("upsertRegistry", () => {
    it("returns monitorId, countryId and iso2 for a standalone entry", async () => {
      const util = loadUtil({
        registerResult: {
          success: true,
          status: httpStatus.CREATED,
          message: "Registry record created successfully",
          data: { _id: "reg-1", name: "US Embassy", country: "Uganda", iso2: "" },
        },
      });
      const result = await util.upsertRegistry({
        query: { tenant: "airqo" },
        body: { name: "US Embassy", country: "Uganda" },
      });

      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.data).to.include({
        _id: "reg-1",
        monitorId: "reg-1",
        countryId: "uganda",
        iso2: "UG",
        availability: "available",
      });
    });

    it("uses the Site id and country for a site enrichment entry", async () => {
      const util = loadUtil({
        siteById: { _id: "site-nbo-1", country: "Kenya" },
        registerResult: {
          success: true,
          status: httpStatus.OK,
          data: { _id: "reg-2", site_id: "site-nbo-1", country: "", iso2: "" },
        },
      });
      const result = await util.upsertRegistry({
        query: { tenant: "airqo" },
        body: { site_id: "site-nbo-1" },
      });

      expect(result.data).to.include({
        monitorId: "site-nbo-1",
        countryId: "kenya",
        iso2: "KE",
        availability: "available",
      });
    });

    it("reports pending availability when the site has no active device", async () => {
      const util = loadUtil({
        hasActiveDevice: false,
        siteById: { _id: "site-nbo-1", country: "Kenya" },
        registerResult: {
          success: true,
          status: httpStatus.OK,
          data: { _id: "reg-3", site_id: "site-nbo-1", country: "", iso2: "" },
        },
      });
      const result = await util.upsertRegistry({
        query: { tenant: "airqo" },
        body: { site_id: "site-nbo-1" },
      });

      expect(result.data).to.include({
        monitorId: "site-nbo-1",
        availability: "pending",
      });
    });

    it("passes failures through unchanged", async () => {
      const failure = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Invalid registry data",
        errors: { message: "bad latitude" },
      };
      const util = loadUtil({ registerResult: failure });
      const result = await util.upsertRegistry({
        query: { tenant: "airqo" },
        body: { name: "x" },
      });

      expect(result).to.deep.equal(failure);
    });

    it("returns 404 when the linked site does not exist", async () => {
      const util = loadUtil({ siteById: null });
      const result = await util.upsertRegistry({
        query: { tenant: "airqo" },
        body: { site_id: "missing" },
      });

      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });
  });
});
