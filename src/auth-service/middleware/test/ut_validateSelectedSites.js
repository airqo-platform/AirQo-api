require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const validateSelectedSites = require("@middleware/validateSelectedSites");
const { logText } = require("@utils/log");

describe("validateSelectedSites Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {
        selected_sites: [],
      },
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };
    next = sinon.stub();
    sinon.stub(logText); // Mock logText function
  });

  afterEach(() => {
    sinon.restore(); // Restore the original functionality of stubbed methods
  });

  describe("when selected_sites is not an array", () => {
    it("should return a 400 error if selected_sites is not an array", () => {
      req.body.selected_sites = "not an array";

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
          message: "selected_sites should be a non-empty array",
        })
      ).to.be.true;
      expect(next.notCalled).to.be.true;
    });
  });

  describe("when selected_sites is an empty array", () => {
    it("should return a 400 error if selected_sites is an empty array", () => {
      req.body.selected_sites = [];

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
          message: "selected_sites should be a non-empty array",
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
      req.body.selected_sites = [{}]; // Site object with no fields

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
      req.body.selected_sites = [{ site_id: "invalid_id" }];

      const middleware = validateSelectedSites(["site_id"]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": ["site_id must be a valid MongoDB ObjectId"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
      expect(next.notCalled).to.be.true;
    });

    it("should return a 400 error for non-string name field", () => {
      req.body.selected_sites = [{ name: 123 }];

      const middleware = validateSelectedSites(["name"]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": ["name must be a non-empty string"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
      expect(next.notCalled).to.be.true;
    });

    it("should return a 400 error for invalid latitude value", () => {
      req.body.selected_sites = [{ latitude: 100 }]; // Invalid latitude

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
      req.body.selected_sites = [{ longitude: -200 }]; // Invalid longitude

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

    it("should return a 400 error for invalid approximate_latitude value", () => {
      req.body.selected_sites = [{ approximate_latitude: 100 }]; // Invalid approximate_latitude

      const middleware = validateSelectedSites(["approximate_latitude"]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": [
              "approximate_latitude must be between -90 and 90",
            ],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });

    it("should return a 400 error for invalid approximate_longitude value", () => {
      req.body.selected_sites = [{ approximate_longitude: -200 }]; // Invalid approximate_longitude

      const middleware = validateSelectedSites(["approximate_longitude"]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": [
              "approximate_longitude must be between -180 and 180",
            ],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });

    it("should return a 400 error for non-array site_tags", () => {
      req.body.selected_sites = [{ site_tags: "not_an_array" }]; // Invalid site_tags

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

    it("should return a 400 error for non-string tags in site_tags", () => {
      req.body.selected_sites = [{ site_tags: [123] }]; // Invalid tag

      const middleware = validateSelectedSites(["site_tags"]);
      middleware(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          errors: {
            "selected_sites[0]": ["site_tags[0] must be a string"],
          },
          message: "bad request errors",
        })
      ).to.be.true;
    });

    it("should return a 400 error for invalid isFeatured value", () => {
      req.body.selected_sites = [{ isFeatured: "not_a_boolean" }]; // Invalid isFeatured

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

  describe("when all validations pass", () => {
    it("should call next() when all validations are successful", () => {
      req.body.selected_sites = [
        {
          site_id: "610a43c1909756001e235e93",
          name: "Valid Site",
          search_name: "Valid Search",
          latitude: -1.2345,
          longitude: 34.5678,
          approximate_latitude: -1.2345,
          approximate_longitude: 34.5678,
          site_tags: ["tag1", "tag2"],
          country: "Country Name",
        },
      ];

      const middleware = validateSelectedSites([
        "site_id",
        "name",
        "search_name",
      ]);

      middleware(req, res, next);

      expect(next.calledOnce).to.be.true; // Ensure next() is called
    });
  });
});