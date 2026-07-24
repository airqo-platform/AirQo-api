require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const { expect } = chai;
chai.use(chaiHttp);
const sinon = require("sinon");
// .noCallThru() is required, not optional: without it, proxyquire's default
// "call thru" behavior always `Module._load()`s the REAL stubbed module (to
// merge in any keys missing from our stub), regardless of whether our stub
// is already complete. The real @controllers/request.controller,
// @middleware/passport, and @middleware/permissionAuth all transitively
// require @config/constants, which this test suite cannot survive (see the
// ut_index.js comment for the full explanation). noCallThru skips that real
// load entirely.
const proxyquire = require("proxyquire").noCallThru();
const supertest = require("supertest");
const express = require("express");
const { validationResult } = require("express-validator");

// Express captures each route handler by reference at router-registration
// time (which happens once, when this router is required), so reassigning
// `createRequestController.someMethod` etc. from inside a test has no effect
// on already-registered routes. Instead we register stable wrapper functions
// that delegate to a per-test-mutable variable, and stub the auth middleware
// (which otherwise requires a real JWT) to always call next(). We also stub
// `requirePermissions` from @middleware/permissionAuth, since the DELETE
// /expired route guards on it and the real implementation needs a real
// `req.user` (set by real passport auth, which we've bypassed) plus a live
// RBACService/DB lookup.
let requestAccessToGroupImpl;
let requestAccessToGroupByEmailImpl;
let acceptInvitationImpl;
let requestAccessToNetworkImpl;
let listImpl;
let listPendingAccessRequestsImpl;
let approveAccessRequestImpl;
let rejectAccessRequestImpl;
let listAccessRequestsForGroupImpl;
let listPendingInvitationsForUserImpl;
let acceptPendingInvitationImpl;
let rejectPendingInvitationImpl;
let listAccessRequestsForNetworkImpl;
let cleanupExpiredRequestsImpl;
let deleteImpl;
let updateImpl;

const createRequestControllerStub = {
  requestAccessToGroup: (req, res) => requestAccessToGroupImpl(req, res),
  requestAccessToGroupByEmail: (req, res) =>
    requestAccessToGroupByEmailImpl(req, res),
  acceptInvitation: (req, res) => acceptInvitationImpl(req, res),
  requestAccessToNetwork: (req, res) => requestAccessToNetworkImpl(req, res),
  list: (req, res) => listImpl(req, res),
  listPendingAccessRequests: (req, res) =>
    listPendingAccessRequestsImpl(req, res),
  approveAccessRequest: (req, res) => approveAccessRequestImpl(req, res),
  rejectAccessRequest: (req, res) => rejectAccessRequestImpl(req, res),
  listAccessRequestsForGroup: (req, res) =>
    listAccessRequestsForGroupImpl(req, res),
  listPendingInvitationsForUser: (req, res) =>
    listPendingInvitationsForUserImpl(req, res),
  acceptPendingInvitation: (req, res) => acceptPendingInvitationImpl(req, res),
  rejectPendingInvitation: (req, res) => rejectPendingInvitationImpl(req, res),
  listAccessRequestsForNetwork: (req, res) =>
    listAccessRequestsForNetworkImpl(req, res),
  cleanupExpiredRequests: (req, res) => cleanupExpiredRequestsImpl(req, res),
  delete: (req, res) => deleteImpl(req, res),
  update: (req, res) => updateImpl(req, res),
};

const passportStub = {
  enhancedJWTAuth: (req, res, next) => next(),
  optionalJWTAuth: (req, res, next) => next(),
};

const permissionAuthStub = {
  requirePermissions: (requiredPermissions, options) => (req, res, next) =>
    next(),
};

const router = proxyquire("@routes/v2/requests.routes", {
  "@controllers/request.controller": createRequestControllerStub,
  "@middleware/passport": passportStub,
  "@middleware/permissionAuth": permissionAuthStub,
});

// Realistic 24-char hex Mongo ObjectId strings, since the real validators
// reject anything that doesn't pass isMongoId().
const validGroupId = "60d21b4667d0d8992e610c85";
const validNetworkId = "60d21b4667d0d8992e610c86";
const validRequestId = "60d21b4667d0d8992e610c87";
const validTargetId = "60d21b4667d0d8992e610c88";

describe("Request Router API Tests", () => {
  let app;
  let request;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", router);
    request = supertest(app);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("POST /groups/:grp_id", () => {
    it("should request access to a group", async () => {
      requestAccessToGroupImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post(`/groups/${validGroupId}`)
        .send({})
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for a malformed grp_id", async () => {
      requestAccessToGroupImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post("/groups/not-a-valid-id")
        .send({})
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the grp_id is not a valid Object"
      );
    });
  });

  describe("POST /emails/groups/:grp_id", () => {
    it("should request access to a group by email", async () => {
      requestAccessToGroupByEmailImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post(`/emails/groups/${validGroupId}`)
        .send({ emails: ["test.user@example.com"] })
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error when emails is missing", async () => {
      requestAccessToGroupByEmailImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post(`/emails/groups/${validGroupId}`)
        .send({})
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the emails should be provided"
      );
    });
  });

  describe("POST /emails/accept", () => {
    it("should accept an invitation", async () => {
      acceptInvitationImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post("/emails/accept")
        .send({ target_id: validTargetId })
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error when target_id is missing", async () => {
      acceptInvitationImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post("/emails/accept")
        .send({})
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the target_id is missing in request"
      );
    });
  });

  describe("POST /networks/:net_id", () => {
    it("should request access to a network", async () => {
      requestAccessToNetworkImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post(`/networks/${validNetworkId}`)
        .send({})
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for a malformed net_id", async () => {
      requestAccessToNetworkImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post("/networks/not-a-valid-id")
        .send({})
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the net_id is not a valid Object"
      );
    });
  });

  describe("GET /", () => {
    it("should list access requests", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, requests: [] });
      };

      const response = await request.get("/").expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for an invalid tenant", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, requests: [] });
      };

      // validateTenant here is a plain query() chain (not wrapped in
      // express-validator's oneOf()), so unlike some sibling validator
      // files, the specific custom-thrown message IS the real top-level
      // errors[0].msg directly.
      const response = await request
        .get("/")
        .query({ tenant: "not-a-real-tenant" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "Invalid tenant. Must be one of: airqo"
      );
    });
  });

  describe("GET /pending", () => {
    it("should list pending access requests", async () => {
      listPendingAccessRequestsImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, requests: [] });
      };

      const response = await request.get("/pending").expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for an invalid tenant", async () => {
      listPendingAccessRequestsImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, requests: [] });
      };

      const response = await request
        .get("/pending")
        .query({ tenant: "not-a-real-tenant" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "Invalid tenant. Must be one of: airqo"
      );
    });
  });

  describe("POST /:request_id/approve", () => {
    it("should approve an access request", async () => {
      approveAccessRequestImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post(`/${validRequestId}/approve`)
        .send({ status: "approved" })
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for an invalid status", async () => {
      approveAccessRequestImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post(`/${validRequestId}/approve`)
        .send({ status: "bogus-status" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the status value is not among the expected ones which include: rejected, approved and pending"
      );
    });
  });

  describe("POST /:request_id/reject", () => {
    it("should reject an access request", async () => {
      rejectAccessRequestImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post(`/${validRequestId}/reject`)
        .send({ status: "rejected" })
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for a malformed request_id", async () => {
      rejectAccessRequestImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post("/not-a-valid-id/reject")
        .send({})
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the request_id should be an object ID"
      );
    });
  });

  describe("GET /groups", () => {
    it("should list access requests for a group", async () => {
      listAccessRequestsForGroupImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, requests: [] });
      };

      const response = await request.get("/groups").expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for an invalid tenant", async () => {
      listAccessRequestsForGroupImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, requests: [] });
      };

      const response = await request
        .get("/groups")
        .query({ tenant: "not-a-real-tenant" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "Invalid tenant. Must be one of: airqo"
      );
    });
  });

  describe("GET /pending/user", () => {
    it("should list pending invitations for the user (no field validators on this route)", async () => {
      listPendingInvitationsForUserImpl = (req, res) => {
        return res.status(200).json({ success: true, requests: [] });
      };

      const response = await request.get("/pending/user").expect(200);

      expect(response.body.success).to.equal(true);
    });
  });

  describe("POST /pending/:request_id/accept", () => {
    it("should accept a pending invitation", async () => {
      acceptPendingInvitationImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post(`/pending/${validRequestId}/accept`)
        .send({})
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for a malformed request_id", async () => {
      acceptPendingInvitationImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post("/pending/not-a-valid-id/accept")
        .send({})
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the request_id should be an object ID"
      );
    });
  });

  describe("POST /pending/:request_id/reject", () => {
    it("should reject a pending invitation", async () => {
      rejectPendingInvitationImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post(`/pending/${validRequestId}/reject`)
        .send({})
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for a malformed request_id", async () => {
      rejectPendingInvitationImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post("/pending/not-a-valid-id/reject")
        .send({})
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the request_id should be an object ID"
      );
    });
  });

  describe("GET /networks", () => {
    it("should list access requests for a network", async () => {
      listAccessRequestsForNetworkImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, requests: [] });
      };

      const response = await request.get("/networks").expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for an invalid tenant", async () => {
      listAccessRequestsForNetworkImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, requests: [] });
      };

      const response = await request
        .get("/networks")
        .query({ tenant: "not-a-real-tenant" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "Invalid tenant. Must be one of: airqo"
      );
    });
  });

  describe("DELETE /expired", () => {
    it("should clean up expired requests (requirePermissions stubbed to allow through)", async () => {
      cleanupExpiredRequestsImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request.delete("/expired").expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for an invalid tenant", async () => {
      cleanupExpiredRequestsImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .delete("/expired")
        .query({ tenant: "not-a-real-tenant" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "Invalid tenant. Must be one of: airqo"
      );
    });
  });

  describe("DELETE /:request_id", () => {
    it("should delete an access request", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .delete(`/${validRequestId}`)
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for a malformed request_id", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .delete("/not-a-valid-id")
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "request_id must be an object ID"
      );
    });
  });

  describe("PUT /:request_id", () => {
    it("should update an access request", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .put(`/${validRequestId}`)
        .send({ status: "approved" })
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for an invalid status", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .put(`/${validRequestId}`)
        .send({ status: "bogus-status" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the status value is not among the expected ones which include: rejected, approved and pending"
      );
    });
  });

  describe("GET /groups/:grp_id", () => {
    it("should retrieve access requests for a group", async () => {
      listAccessRequestsForGroupImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, data: [] });
      };

      const response = await request
        .get(`/groups/${validGroupId}`)
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for a malformed grp_id", async () => {
      listAccessRequestsForGroupImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, data: [] });
      };

      const response = await request
        .get("/groups/not-a-valid-id")
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the grp_id should be an object ID"
      );
    });
  });

  describe("GET /networks/:net_id", () => {
    it("should retrieve access requests for a network", async () => {
      listAccessRequestsForNetworkImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, data: [] });
      };

      const response = await request
        .get(`/networks/${validNetworkId}`)
        .expect(200);

      expect(response.body.success).to.equal(true);
    });

    it("should return a 400 error for a malformed net_id", async () => {
      listAccessRequestsForNetworkImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, data: [] });
      };

      const response = await request
        .get("/networks/not-a-valid-id")
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the net_id should be an object ID"
      );
    });
  });

  describe("GET /request_id", () => {
    // NOTE: this route is registered with the literal path "/request_id"
    // (routes/v2/requests.routes.js), not the parameterized "/:request_id"
    // that requestValidations.getRequestId's param("request_id") check
    // requires to find anything in req.params. Because there is no such
    // route param, req.params.request_id is always undefined, so the
    // validator's initial .exists() check fails unconditionally and the
    // request never reaches the controller — regardless of what's sent.
    // This looks like a real routing bug (very likely meant to be
    // "/:request_id"), but it's a production code issue outside the scope
    // of this test fix, so the test below documents the real, always-400
    // behavior rather than asserting a currently-unreachable success path.
    it("always returns a 400 error because request_id can never be present in req.params", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true, data: [] });
      };

      const response = await request.get("/request_id").expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the request identifier is missing in request, consider using the request_id"
      );
    });
  });

  // Dummy test to keep Mocha from exiting prematurely
  it("Dummy test to keep Mocha from exiting prematurely", () => {
    expect(true).to.equal(true);
  });
});
