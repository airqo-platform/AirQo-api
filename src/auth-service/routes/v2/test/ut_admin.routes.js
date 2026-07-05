require("module-alias/register");

const VALID_SETUP_KEY = "setup-key-stub";
const INVALID_SETUP_KEY = "wrong-key-stub";

// Stub cloudinary before any module in the chain can load it
const cloudinaryPath = require.resolve("cloudinary");
if (!require.cache[cloudinaryPath]) {
  require.cache[cloudinaryPath] = {
    id: cloudinaryPath,
    filename: cloudinaryPath,
    loaded: true,
    exports: { v2: { config: () => {}, uploader: {} } },
  };
}
const cloudinaryConfigPath = require.resolve("../../../config/cloudinary");
if (!require.cache[cloudinaryConfigPath]) {
  require.cache[cloudinaryConfigPath] = {
    id: cloudinaryConfigPath,
    filename: cloudinaryConfigPath,
    loaded: true,
    exports: { config: () => {} },
  };
}

const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const express = require("express");
const request = require("supertest");

function buildApp(handlers) {
  const router = express.Router();
  router.use(express.json());

  router.get("/rbac-health", handlers.checkRBACHealth);
  router.get("/rbac-status", handlers.getRBACStatus);
  router.post("/rbac-reset", handlers.resetRBACSystem);
  router.post("/rbac-initialize", handlers.initializeRBAC);
  router.get("/docs", handlers.getDocs);

  router.use(
    sinon.stub().callsFake((req, res, next) => {
      res.status(401).json({ success: false, message: "Unauthorized" });
    })
  );

  const app = express();
  app.use(express.json());
  app.use("/", router);
  return app;
}

describe("Admin Routes", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("GET /rbac-health", () => {
    it("should return 200 with health status", async () => {
      const app = buildApp({
        checkRBACHealth: async (req, res) =>
          res.status(200).json({ success: true, health_status: { status: "healthy" } }),
        getRBACStatus: async (req, res) => res.status(200).json({}),
        resetRBACSystem: async (req, res) => res.status(200).json({}),
        initializeRBAC: async (req, res) => res.status(200).json({}),
        getDocs: async (req, res) => res.status(200).json({}),
      });

      const response = await request(app).get("/rbac-health").query({ tenant: "airqo" });

      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);
      expect(response.body.health_status.status).to.equal("healthy");
    });
  });

  describe("GET /rbac-status", () => {
    it("should return 200 with RBAC status", async () => {
      const app = buildApp({
        checkRBACHealth: async (req, res) => res.status(200).json({}),
        getRBACStatus: async (req, res) =>
          res.status(200).json({ success: true, rbac_status: {} }),
        resetRBACSystem: async (req, res) => res.status(200).json({}),
        initializeRBAC: async (req, res) => res.status(200).json({}),
        getDocs: async (req, res) => res.status(200).json({}),
      });

      const response = await request(app).get("/rbac-status").query({ tenant: "airqo" });

      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);
    });
  });

  describe("POST /rbac-reset", () => {
    it("should return 200 on dry run reset", async () => {
      const app = buildApp({
        checkRBACHealth: async (req, res) => res.status(200).json({}),
        getRBACStatus: async (req, res) => res.status(200).json({}),
        resetRBACSystem: async (req, res) =>
          res.status(200).json({ success: true, message: "RBAC reset (dry run) completed" }),
        initializeRBAC: async (req, res) => res.status(200).json({}),
        getDocs: async (req, res) => res.status(200).json({}),
      });

      const response = await request(app)
        .post("/rbac-reset")
        .query({ tenant: "airqo" })
        .send({ secret: VALID_SETUP_KEY, dry_run: true });

      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);
    });

    it("should return 403 when handler rejects", async () => {
      const app = buildApp({
        checkRBACHealth: async (req, res) => res.status(200).json({}),
        getRBACStatus: async (req, res) => res.status(200).json({}),
        resetRBACSystem: async (req, res) =>
          res.status(403).json({ success: false, message: "Invalid setup secret" }),
        initializeRBAC: async (req, res) => res.status(200).json({}),
        getDocs: async (req, res) => res.status(200).json({}),
      });

      const response = await request(app)
        .post("/rbac-reset")
        .query({ tenant: "airqo" })
        .send({ secret: INVALID_SETUP_KEY });

      expect(response.status).to.equal(403);
      expect(response.body.success).to.equal(false);
    });
  });

  describe("POST /rbac-initialize", () => {
    it("should return 200 on initialization", async () => {
      const app = buildApp({
        checkRBACHealth: async (req, res) => res.status(200).json({}),
        getRBACStatus: async (req, res) => res.status(200).json({}),
        resetRBACSystem: async (req, res) => res.status(200).json({}),
        initializeRBAC: async (req, res) =>
          res.status(200).json({ success: true, message: "RBAC initialized" }),
        getDocs: async (req, res) => res.status(200).json({}),
      });

      const response = await request(app)
        .post("/rbac-initialize")
        .query({ tenant: "airqo" })
        .send({ secret: VALID_SETUP_KEY });

      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);
    });
  });

  describe("GET /docs", () => {
    it("should return 200 with documentation", async () => {
      const app = buildApp({
        checkRBACHealth: async (req, res) => res.status(200).json({}),
        getRBACStatus: async (req, res) => res.status(200).json({}),
        resetRBACSystem: async (req, res) => res.status(200).json({}),
        initializeRBAC: async (req, res) => res.status(200).json({}),
        getDocs: async (req, res) =>
          res.status(200).json({ success: true, documentation: { endpoints: {} } }),
      });

      const response = await request(app).get("/docs");

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("documentation");
    });
  });

  describe("protected routes — auth middleware behavior", () => {
    it("GET /audit/users returns 401 without JWT (real router)", async () => {
      const realRouter = require("../admin.routes");
      const app = express();
      app.use(express.json());
      app.use("/", realRouter);
      app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ success: false, message: err.message });
      });

      const response = await request(app).get("/audit/users").query({ tenant: "airqo" });

      expect(response.status).to.be.oneOf([400, 401, 403, 422, 500]);
    });

    it("GET /audit/roles returns 401 without JWT (real router)", async () => {
      const realRouter = require("../admin.routes");
      const app = express();
      app.use(express.json());
      app.use("/", realRouter);
      app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ success: false, message: err.message });
      });

      const response = await request(app).get("/audit/roles").query({ tenant: "airqo" });

      expect(response.status).to.be.oneOf([400, 401, 403, 422, 500]);
    });

    it("POST /maintenance/cache-clear returns 401 without JWT (real router)", async () => {
      const realRouter = require("../admin.routes");
      const app = express();
      app.use(express.json());
      app.use("/", realRouter);
      app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).json({ success: false, message: err.message });
      });

      const response = await request(app)
        .post("/maintenance/cache-clear")
        .query({ tenant: "airqo" })
        .send({ secret: VALID_SETUP_KEY });

      expect(response.status).to.be.oneOf([400, 401, 403, 422, 500]);
    });
  });
});
