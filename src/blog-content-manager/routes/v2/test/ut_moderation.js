require("module-alias/register");
// Import necessary modules
const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const ContentModerationController = require("@controllers/moderate-posts");

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
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

// Mock route handlers
const mockListRegistrationsHandler = sinon
  .stub(ContentModerationController, "listRegistrations")
  .resolves({
    status: 200,
    body: [
      {
        id: 1,
        userId: "user1",
        registrationType: "newUser",
        timestamp: new Date().toISOString(),
      },
      {
        id: 2,
        userId: "user2",
        registrationType: "emailVerification",
        timestamp: new Date().toISOString(),
      },
    ],
  });

const mockApproveRegistrationHandler = sinon
  .stub(ContentModerationController, "approveRegistration")
  .resolves({
    status: 200,
    body: { message: "User registration approved" },
  });

const mockRejectRegistrationHandler = sinon
  .stub(ContentModerationController, "rejectRegistration")
  .resolves({
    status: 200,
    body: { message: "User registration rejected" },
  });

const mockFlagPostHandler = sinon
  .stub(ContentModerationController, "flagPost")
  .resolves({
    status: 200,
    body: { message: "Post flagged successfully" },
  });

const mockViewFlagsHandler = sinon
  .stub(ContentModerationController, "viewFlags")
  .resolves({
    status: 200,
    body: [
      {
        postId: 1,
        flagReason: "inappropriate",
        timestamp: new Date().toISOString(),
      },
    ],
  });

const mockSuspendUserHandler = sinon
  .stub(ContentModerationController, "suspendUser")
  .resolves({
    status: 200,
    body: { message: "User suspended successfully" },
  });

const mockBanUserHandler = sinon
  .stub(ContentModerationController, "banUser")
  .resolves({
    status: 200,
    body: { message: "User banned successfully" },
  });

describe("Content Moderation Routes", () => {
  describe("GET /registrations", () => {
    it("should list user registrations", async () => {
      const req = {};
      const res = {};

      await router.get("/registrations", validateContentModeration)(req, res);

      expect(mockListRegistrationsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        {
          id: 1,
          userId: "user1",
          registrationType: expect.any(String),
          timestamp: expect.any(String),
        },
        {
          id: 2,
          userId: "user2",
          registrationType: expect.any(String),
          timestamp: expect.any(String),
        },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.get("/invalidRegistrations", validateContentModeration)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PUT /registrations/:userId/approve", () => {
    it("should approve a user registration", async () => {
      const req = {
        params: { userId: "validUserId" },
        body: { reason: "Valid approval reason" },
      };
      const res = {};

      await router.put(
        "/registrations/:userId/approve",
        validateContentModeration
      )(req, res);

      expect(mockApproveRegistrationHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ message: "User registration approved" });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { userId: "invalidUserId" },
        body: { invalidReason: "too long" },
      };
      const res = {};

      await router.put("/invalidUserId/approve", validateContentModeration)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PUT /registrations/:userId/reject", () => {
    it("should reject a user registration", async () => {
      const req = {
        params: { userId: "validUserId" },
        body: { reason: "Valid rejection reason" },
      };
      const res = {};

      await router.put(
        "/registrations/:userId/reject",
        validateContentModeration
      )(req, res);

      expect(mockRejectRegistrationHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ message: "User registration rejected" });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { userId: "invalidUserId" },
        body: { invalidReason: "too long" },
      };
      const res = {};

      await router.put("/invalidUserId/reject", validateContentModeration)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("POST /:postId/flag", () => {
    it("should flag a post", async () => {
      const req = {
        params: { postId: "validPostId" },
        body: { reason: "Valid flag reason" },
      };
      const res = {};

      await router.post("/:postId/flag", validateContentModeration)(req, res);

      expect(mockFlagPostHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ message: "Post flagged successfully" });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId" },
        body: { invalidReason: "too long" },
      };
      const res = {};

      await router.post("/invalidPostId/flag", validateContentModeration)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /:postId/flags", () => {
    it("should view flags for a post", async () => {
      const req = {
        params: { postId: "validPostId" },
      };
      const res = {};

      await router.get("/:postId/flags", validateContentModeration)(req, res);

      expect(mockViewFlagsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        {
          postId: 1,
          flagReason: expect.any(String),
          timestamp: expect.any(String),
        },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId" },
      };
      const res = {};

      await router.get("/invalidPostId/flags", validateContentModeration)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PUT /:userId/suspend", () => {
    it("should suspend a user", async () => {
      const req = {
        params: { userId: "validUserId" },
        body: { reason: "Valid suspension reason" },
      };
      const res = {};

      await router.put("/:userId/suspend", validateContentModeration)(req, res);

      expect(mockSuspendUserHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        message: "User suspended successfully",
      });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { userId: "invalidUserId" },
        body: { invalidReason: "too long" },
      };
      const res = {};

      await router.put("/invalidUserId/suspend", validateContentModeration)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PUT /:userId/ban", () => {
    it("should ban a user", async () => {
      const req = {
        params: { userId: "validUserId" },
        body: { reason: "Valid ban reason" },
      };
      const res = {};

      await router.put("/:userId/ban", validateContentModeration)(req, res);

      expect(mockBanUserHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ message: "User banned successfully" });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { userId: "invalidUserId" },
        body: { invalidReason: "too long" },
      };
      const res = {};

      await router.put("/invalidUserId/ban", validateContentModeration)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("Helper Functions", () => {
    describe("validatePagination", () => {
      it("should set default values for pagination", async () => {
        const req = { query: {} };
        const res = {};
        const next = sinon.stub();

        validatePagination(req, res, next);

        expect(next).to.have.been.calledWith();
        expect(req.query.limit).to.equal(100);
        expect(req.query.skip).to.equal(0);
      });

      it("should handle invalid limit", async () => {
        const req = { query: { limit: "invalid" } };
        const res = {};
        const next = sinon.stub();

        validatePagination(req, res, next);

        expect(next).to.have.been.calledWith();
        expect(req.query.limit).to.equal(100);
      });

      it("should handle invalid skip", async () => {
        const req = { query: { skip: "-1" } };
        const res = {};
        const next = sinon.stub();

        validatePagination(req, res, next);

        expect(next).to.have.been.calledWith();
        expect(req.query.skip).to.equal(0);
      });
    });

    describe("headers", () => {
      it("should set CORS headers", async () => {
        const req = {};
        const res = {};
        const next = sinon.stub();

        headers(req, res, next);

        expect(res.header).to.have.been.calledThrice;
        expect(res.header.firstCall.args[0]).to.equal(
          "Access-Control-Allow-Origin"
        );
        expect(res.header.firstCall.args[1]).to.equal("*");
        expect(res.header.secondCall.args[0]).to.equal(
          "Access-Control-Allow-Headers"
        );
        expect(res.header.secondCall.args[1]).to.equal(
          "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        );
        expect(res.header.thirdCall.args[0]).to.equal(
          "Access-Control-Allow-Methods"
        );
        expect(res.header.thirdCall.args[1]).to.equal("GET, POST, PUT, DELETE");
        expect(next).to.have.been.calledWith();
      });
    });

    describe("validateContentModeration", () => {
      it("should validate content moderation fields", async () => {
        const req = {
          params: { userId: "validUserId" },
          body: { reason: "Valid action" },
        };
        const res = {};
        const next = sinon.stub();

        validateContentModeration(req, res, next);

        expect(next).to.have.been.calledWith();
        expect(res.status).to.not.have.been.called;
      });

      it("should return validation errors", async () => {
        const req = {
          params: { userId: "invalidUserId" },
          body: { invalidReason: "too long" },
        };
        const res = {};
        const next = sinon.stub();

        validateContentModeration(req, res, next);

        expect(next).to.not.have.been.called;
        expect(res.status).to.have.been.calledWith(400);
        expect(res.json).to.have.been.calledWith({ errors: expect.any(Array) });
      });
    });
  });
});

// Cleanup
afterEach(() => {
  sinon.restore();
});
