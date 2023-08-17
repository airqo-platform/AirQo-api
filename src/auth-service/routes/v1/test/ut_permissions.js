require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const { expect } = chai;
chai.use(chaiHttp);
const router = require("@routes/v1/permissions");
const supertest = require("supertest");
const express = require("express");
const { validationResult } = require("express-validator");
const createPermissionController = require("@controllers/create-permission");

describe("Permission Router API Tests", () => {
  let app;
  let request;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", router);
    request = supertest(app);
  });
  describe("GET /", () => {
    it("should return a list of permissions", async () => {
      // Mocked data and behavior for createPermissionController.list
      const fakePermissions = [
        { name: "permission1" },
        { name: "permission2" },
      ];
      createPermissionController.list = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ permissions: fakePermissions });
      };

      const response = await request.get("/").expect(200);

      expect(response.body.permissions).to.deep.equal(fakePermissions);
    });

    it("should return a 400 error if invalid query parameters are provided", async () => {
      // Mocked data and behavior for createPermissionController.list
      createPermissionController.list = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ permissions: [] });
      };

      const response = await request
        .get("/")
        .query({ tenant: "invalid-tenant" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });

    // ... more test cases
  });

  describe("POST /", () => {
    it("should create a new permission", async () => {
      // Mocked data and behavior for createPermissionController.create
      const fakePermission = { _id: "fake-id", permission: "permission1" };
      createPermissionController.create = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ permission: fakePermission });
      };

      const response = await request
        .post("/")
        .send({
          permission: "new_permission",
          network_id: "valid-mongo-id",
          description: "Description of the permission",
        })
        .expect(201);

      expect(response.body.permission).to.deep.equal(fakePermission);
    });

    it("should return a 400 error if invalid body parameters are provided", async () => {
      // Mocked data and behavior for createPermissionController.create
      createPermissionController.create = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ permission: {} });
      };

      const response = await request
        .post("/")
        .send({
          permission: "",
          network_id: "invalid-mongo-id",
          description: "",
        })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the permission must not be empty"
      );
      expect(response.body.errors[1].msg).to.equal(
        "network_id must be an object ID"
      );
      expect(response.body.errors[2].msg).to.equal(
        "the description must not be empty"
      );
    });

    // ... more test cases
  });

  describe("PUT /:permission_id", () => {
    it("should update a permission", async () => {
      // Mocked data and behavior for createPermissionController.update
      const fakeUpdatedPermission = {
        _id: "fake-id",
        permission: "updated_permission",
      };
      createPermissionController.update = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ permission: fakeUpdatedPermission });
      };

      const response = await request
        .put("/fake-id")
        .send({
          network_id: "valid-mongo-id",
          description: "Updated description",
        })
        .expect(200);

      expect(response.body.permission).to.deep.equal(fakeUpdatedPermission);
    });

    it("should return a 400 error if invalid body parameters are provided", async () => {
      // Mocked data and behavior for createPermissionController.update
      createPermissionController.update = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ permission: {} });
      };

      const response = await request
        .put("/fake-id")
        .send({
          network_id: "invalid-mongo-id",
          description: "",
        })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "network_id must be an object ID"
      );
      expect(response.body.errors[1].msg).to.equal(
        "description should not be empty if provided"
      );
    });

    // ... more test cases
  });

  describe("DELETE /:permission_id", () => {
    it("should delete a permission", async () => {
      // Mocked data and behavior for createPermissionController.delete
      createPermissionController.delete = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(204).end();
      };

      await request.delete("/fake-id").expect(204);
    });

    it("should return a 400 error if invalid query parameters are provided", async () => {
      // Mocked data and behavior for createPermissionController.delete
      createPermissionController.delete = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(204).end();
      };

      const response = await request
        .delete("/fake-id?tenant=invalid-tenant")
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });

    // ... more test cases
  });

  describe("GET /:permission_id", () => {
    it("should get permission details", async () => {
      // Mocked data and behavior for createPermissionController.list
      createPermissionController.list = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ permission: "permission details" });
      };

      await request.get("/fake-id").expect(200);
    });

    it("should return a 400 error if invalid query parameters are provided", async () => {
      // Mocked data and behavior for createPermissionController.list
      createPermissionController.list = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ permission: "permission details" });
      };

      const response = await request
        .get("/fake-id?tenant=invalid-tenant")
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });

    // ... more test cases
  });

  // Dummy test to keep Mocha from exiting prematurely
  it("Dummy test to keep Mocha from exiting prematurely", () => {
    expect(true).to.equal(true);
  });
});
