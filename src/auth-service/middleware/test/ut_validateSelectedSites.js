require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const validateSelectedSites = require("@middleware/validateSelectedSites");
const { logText, logObject } = require("@utils/log");

describe("validateSelectedSites Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };
    next = sinon.stub();
    sinon.stub(logText);
    sinon.stub(logObject);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("when selected_sites is not defined", () => {
    it("should call next() if selected_sites is undefined", () => {
      const middleware = validateSelectedSites([
        "site_id",
        "name",
        "search_name",
      ]);
      middleware(req, res, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("when selected_sites is not an array or object", () => {
    it("should return a 400 error if selected_sites is neither an array nor an object", () => {
      req.body.selected_sites = "not an array or object";

      const middleware = validateSelectedSites([
        "site_id",
        "name",
        "search_name",
      ]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message:
            "Request body(field) for Selected Sites should contain either an array of Site objects or be omitted.",
        })
      ).to.be.true;
      expect(next.notCalled).to.be.true;
    });
  });

  describe("when a site is null or undefined", () => {
    it("should return a 400 error for null site value", () => {
      req.body.selected_sites = [null];

      const middleware = validateSelectedSites([
        "site_id",
        "name",
        "search_name",
      ]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": ["Site value must not be null or undefined"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
      expect(next.notCalled).to.be.true;
    });
  });

  describe("when required fields are missing", () => {
    it("should return a 400 error for missing required fields", () => {
      req.body.selected_sites = [{}];

      const middleware = validateSelectedSites([
        "site_id",
        "name",
        "search_name",
      ]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": [
              'Field "site_id" is missing',
              'Field "name" is missing',
              'Field "search_name" is missing',
            ],
          },
          message: "bad request errors",
        })
      ).to.be.true;
      expect(next.notCalled).to.be.true;
    });
  });

  describe("when fields are of invalid types", () => {
    it("should return a 400 error for invalid site_id format", () => {
      req.body.selected_sites = [{ site_id: 123 }];

      const middleware = validateSelectedSites(["site_id"]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": ["site_id must be a non-empty string"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
      expect(next.notCalled).to.be.true;
    });

    it("should return a 400 error for invalid latitude value", () => {
      req.body.selected_sites = [{ latitude: "invalid" }];

      const middleware = validateSelectedSites(["latitude"]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": ["latitude must be between -90 and 90"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });

    it("should return a 400 error for invalid longitude value", () => {
      req.body.selected_sites = [{ longitude: "invalid" }];

      const middleware = validateSelectedSites(["longitude"]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": ["longitude must be between -180 and 180"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });

    it("should return a 400 error for non-array site_tags", () => {
      req.body.selected_sites = [{ site_tags: "not_an_array" }];

      const middleware = validateSelectedSites(["site_tags"]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": ["site_tags must be an array"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });

    it("should return a 400 error for invalid isFeatured value", () => {
      req.body.selected_sites = [{ isFeatured: "not_a_boolean" }];

      const middleware = validateSelectedSites(["isFeatured"]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": ["isFeatured must be a boolean"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });
  });

  describe("when duplicate values are found", () => {
    it("should return a 400 error for duplicate site_id", () => {
      req.body.selected_sites = [
        { site_id: "site1", name: "Site 1", search_name: "Search 1" },
        { site_id: "site1", name: "Site 2", search_name: "Search 2" },
      ];

      const middleware = validateSelectedSites([
        "site_id",
        "name",
        "search_name",
      ]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[1]": ["Duplicate site_id: site1"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });

    it("should return a 400 error for duplicate search_name", () => {
      req.body.selected_sites = [
        { site_id: "site1", name: "Site 1", search_name: "Search" },
        { site_id: "site2", name: "Site 2", search_name: "Search" },
      ];

      const middleware = validateSelectedSites([
        "site_id",
        "name",
        "search_name",
      ]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[1]": ["Duplicate search_name: Search"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });

    it("should return a 400 error for duplicate name", () => {
      req.body.selected_sites = [
        { site_id: "site1", name: "Site", search_name: "Search 1" },
        { site_id: "site2", name: "Site", search_name: "Search 2" },
      ];

      const middleware = validateSelectedSites([
        "site_id",
        "name",
        "search_name",
      ]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[1]": ["Duplicate name: Site"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });
  });

  describe("when all validations pass", () => {
    it("should call next() when all validations are successful", () => {
      req.body.selected_sites = [
        {
          site_id: "site1",
          name: "Valid Site",
          search_name: "Valid Search",
          latitude: -1.2345,
          longitude: 34.5678,
          approximate_latitude: -1.2345,
          approximate_longitude: 34.5678,
          site_tags: ["tag1", "tag2"],
          country: "Country Name",
          isFeatured: true,
        },
      ];

      const middleware = validateSelectedSites([
        "site_id",
        "name",
        "search_name",
      ]);
      middleware(req, res, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("when allowId is true", () => {
    it("should allow _id field and validate it as a MongoDB ObjectId", () => {
      req.body.selected_sites = [
        {
          _id: "507f1f77bcf86cd799439011",
          site_id: "site1",
          name: "Valid Site",
          search_name: "Valid Search",
        },
      ];

      const middleware = validateSelectedSites(
        ["site_id", "name", "search_name"],
        true
      );
      middleware(req, res, next);

      expect(next.calledOnce).to.be.true;
    });

    it("should return a 400 error for invalid _id format", () => {
      req.body.selected_sites = [
        {
          _id: "invalid_id",
          site_id: "site1",
          name: "Valid Site",
          search_name: "Valid Search",
        },
      ];

      const middleware = validateSelectedSites(
        ["site_id", "name", "search_name"],
        true
      );
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": ["_id must be a valid MongoDB ObjectId"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });
  });

  describe("when selected_sites is a single object", () => {
    it("should validate a single object when selected_sites is not an array", () => {
      req.body.selected_sites = {
        site_id: "site1",
        name: "Valid Site",
        search_name: "Valid Search",
      };

      const middleware = validateSelectedSites([
        "site_id",
        "name",
        "search_name",
      ]);
      middleware(req, res, next);

      expect(next.calledOnce).to.be.true;
    });
  });
});
