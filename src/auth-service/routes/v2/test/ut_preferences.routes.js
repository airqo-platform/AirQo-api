const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// Mock the router
const sinon = require("sinon");
const createPreferenceController = {
  create: sinon.stub(),
  list: sinon.stub(),
  delete: sinon.stub(),
  addSelectedSites: sinon.stub(),
  updateSelectedSite: sinon.stub(),
  deleteSelectedSite: sinon.stub(),
};

describe("Preference Controller Tests", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.query = {};
      req.body = {};
      req.params = {};
      next();
    });

    // Import and apply middleware
    const { validatePagination, headers } = require("./middleware");

    app.use(validatePagination);
    app.use(headers);

    // Import routes
    const router = require("./routes");
    app.use("/api/preferences", router);
  });

  describe("POST /api/preferences", () => {
    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/preferences")
        .send({
          user_id: "1234567890abcdef1234567890abcdef",
          chartTitle: "Test Chart Title",
          period: {},
          site_ids: ["1234567890abcdef1234567890abcdef"],
          device_ids: ["1234567890abcdef1234567890abcdef"],
          selected_sites: [],
        })
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it("should fail validation for missing required fields", async () => {
      await request(app).post("/api/preferences").send({}).expect(400);
    });

    it("should handle partial valid data", async () => {
      const response = await request(app)
        .post("/api/preferences")
        .send({
          user_id: "1234567890abcdef1234567890abcdef",
          chartTitle: "Partial Data Test",
        })
        .expect(200);

      expect(response.body).toBeDefined();
      // Add more specific assertions based on your API's behavior with partial data
    });

    it("should reject invalid data types", async () => {
      const response = await request(app)
        .post("/api/preferences")
        .send({
          user_id: 12345, // Should be a string
          chartTitle: ["Invalid Title"], // Should be a string
          period: "Invalid Period", // Should be an object
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      // Add more specific assertions based on your error response structure
    });

    it("should return the correct response structure", async () => {
      const response = await request(app)
        .post("/api/preferences")
        .send({
          // ... valid data ...
        })
        .expect(200);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("user_id");
      // Add more assertions to check all expected properties
    });
  });

  describe("GET /api/preferences", () => {
    it("should return preferences", async () => {
      const response = await request(app).get("/api/preferences").expect(200);
      expect(response.body).toBeDefined();
    });
  });

  describe("DELETE /api/preferences/:user_id", () => {
    it("should delete preference", async () => {
      const response = await request(app)
        .delete("/api/preferences/1234567890abcdef1234567890abcdef")
        .expect(204);
      expect(createPreferenceController.delete).toHaveBeenCalled();
    });
  });

  describe("GET /api/preferences/selected-sites", () => {
    it("should return selected sites", async () => {
      const response = await request(app)
        .get("/api/preferences/selected-sites")
        .expect(200);
      expect(createPreferenceController.listSelectedSites).toHaveBeenCalled();
    });
  });

  describe("POST /api/preferences/selected-sites", () => {
    it("should add selected sites", async () => {
      const response = await request(app)
        .post("/api/preferences/selected-sites")
        .send({
          selected_sites: [
            {
              _id: "1234567890abcdef1234567890abcdef",
              search_name: "Test Site",
              name: "Test Name",
              latitude: 37.7749,
              longitude: -122.4194,
              approximate_latitude: 37.775,
              approximate_longitude: -122.42,
              search_radius: 100,
              site_tags: ["tag1", "tag2"],
            },
          ],
        })
        .expect(200);
      expect(createPreferenceController.addSelectedSites).toHaveBeenCalled();
    });
  });

  describe("PUT /api/preferences/selected-sites/:site_id", () => {
    it("should update selected site", async () => {
      const response = await request(app)
        .put("/api/preferences/selected-sites/1234567890abcdef1234567890abcdef")
        .send({
          selected_site: {
            _id: "1234567890abcdef1234567890abcdef",
            search_name: "Updated Test Site",
            name: "Updated Test Name",
            latitude: 37.775,
            longitude: -122.42,
            approximate_latitude: 37.775,
            approximate_longitude: -122.42,
            search_radius: 100,
            site_tags: ["updated_tag1", "updated_tag2"],
          },
        })
        .expect(200);
      expect(createPreferenceController.updateSelectedSite).toHaveBeenCalled();
    });
  });

  describe("DELETE /api/preferences/selected-sites/:site_id", () => {
    it("should delete selected site", async () => {
      const response = await request(app)
        .delete(
          "/api/preferences/selected-sites/1234567890abcdef1234567890abcdef"
        )
        .expect(204);
      expect(createPreferenceController.deleteSelectedSite).toHaveBeenCalled();
    });
  });

  describe("GET /api/preferences/:user_id", () => {
    it("should return preference details", async () => {
      const response = await request(app)
        .get("/api/preferences/1234567890abcdef1234567890abcdef")
        .expect(200);
      expect(response.body).toBeDefined();
    });
  });
});
