require("module-alias/register");
// Import necessary modules
const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const SearchController = require("@controllers/perform-search");

// Import middleware
const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST");
  next();
};

// Mock route handlers
const mockSearchHandler = sinon.stub(SearchController, "search").resolves({
  status: 200,
  body: [
    { id: 1, title: "Test Result 1", content: "Content 1" },
    { id: 2, title: "Test Result 2", content: "Content 2" },
  ],
});

const mockAutocompleteHandler = sinon
  .stub(SearchController, "autocomplete")
  .resolves({
    status: 200,
    body: ["Test Result 1", "Test Result 2"],
  });

const mockFilterHandler = sinon.stub(SearchController, "filter").resolves({
  status: 200,
  body: [
    { id: 1, title: "Filtered Result 1", content: "Filtered Content 1" },
    { id: 2, title: "Filtered Result 2", content: "Filtered Content 2" },
  ],
});

const mockPaginateHandler = sinon.stub(SearchController, "paginate").resolves({
  status: 200,
  body: {
    items: [
      { id: 1, title: "Paginated Result 1", content: "Paginated Content 1" },
      { id: 2, title: "Paginated Result 2", content: "Paginated Content 2" },
    ],
    meta: { limit: 100, skip: 0, total: 2 },
  },
});

describe("Search and Filter Routes", () => {
  describe("GET /", () => {
    it("should perform a search", async () => {
      const req = {
        query: { searchTerm: "test" },
      };
      const res = {};

      await router.get("/", validateSearchQuery)(req, res);

      expect(mockSearchHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        {
          id: expect.any(Number),
          title: expect.any(String),
          content: expect.any(String),
        },
        {
          id: expect.any(Number),
          title: expect.any(String),
          content: expect.any(String),
        },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.get("/", validateSearchQuery)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /autocomplete", () => {
    it("should return autocomplete suggestions", async () => {
      const req = {
        query: { searchTerm: "test" },
      };
      const res = {};

      await router.get("/autocomplete")(req, res);

      expect(mockAutocompleteHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal(["Test Result 1", "Test Result 2"]);
    });

    it("should handle empty search terms", async () => {
      const req = {
        query: { searchTerm: "" },
      };
      const res = {};

      await router.get("/autocomplete")(req, res);

      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([]);
    });
  });

  describe("GET /filter", () => {
    it("should filter search results", async () => {
      const req = {
        query: { searchTerm: "test", filter: "example" },
      };
      const res = {};

      await router.get("/filter", validateSearchQuery)(req, res);

      expect(mockFilterHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        {
          id: expect.any(Number),
          title: expect.any(String),
          content: expect.any(String),
        },
        {
          id: expect.any(Number),
          title: expect.any(String),
          content: expect.any(String),
        },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.get("/filter", validateSearchQuery)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /paginate", () => {
    it("should paginate search results", async () => {
      const req = {
        query: { searchTerm: "test", page: 1, limit: 20 },
      };
      const res = {};

      await router.get("/paginate", validateSearchQuery)(req, res);

      expect(mockPaginateHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        items: [
          {
            id: expect.any(Number),
            title: expect.any(String),
            content: expect.any(String),
          },
          {
            id: expect.any(Number),
            title: expect.any(String),
            content: expect.any(String),
          },
        ],
        meta: { limit: 20, skip: 0, total: 2 },
      });
    });

    it("should handle invalid pagination parameters", async () => {
      const req = {
        query: { searchTerm: "test", page: "invalid", limit: "invalid" },
      };
      const res = {};

      await router.get("/paginate", validateSearchQuery)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });
});

// Cleanup
afterEach(() => {
  sinon.restore();
});
