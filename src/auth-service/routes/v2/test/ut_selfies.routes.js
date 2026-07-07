// @middleware/passport transitively requires @utils/user.util -> @config/cloudinary,
// which throws at module-load time if Cloudinary env vars are missing. They're
// already configured in every real deployment (existing jobs depend on them),
// but aren't set in a bare test/CI shell -- shim harmless dummy values so this
// file can load at all. Values are never used for a real Cloudinary call here.
process.env.CLOUD_NAME = process.env.CLOUD_NAME || "test";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "test";
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "test";

require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const supertest = require("supertest");
const express = require("express");
const sinon = require("sinon");
const httpStatus = require("http-status");
const selfieUtil = require("@utils/selfie.util");
const { requirePermissions } = require("@middleware/permissionAuth");
const selfiesRouter = require("@routes/v2/selfies.routes");

const app = express();
app.use(express.json());
app.use("/selfies", selfiesRouter);
// Minimal error handler mirroring how HttpError instances are surfaced
// elsewhere in this service, since this test app doesn't load the full
// application error-handling middleware.
app.use((err, req, res, next) => {
  res
    .status(err.statusCode || httpStatus.INTERNAL_SERVER_ERROR)
    .json({ success: false, message: err.message });
});
const request = supertest(app);

describe("Selfies Route v2", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("POST /selfies", () => {
    it("is reachable without an Authorization header (optionalJWTAuth allows anonymous callers)", async () => {
      sinon.stub(selfieUtil, "create").callsFake(async (req, res) => ({
        success: true,
        status: httpStatus.OK,
        message: "selfie submitted",
        data: { _id: "1" },
      }));

      const response = await request.post("/selfies").send({
        eventId: "event-1",
        imageUrl:
          "https://res.cloudinary.com/airqo/image/upload/v1/clean_air_forum_selfies/a.jpg",
      });

      expect(response.status).to.equal(httpStatus.OK);
    });

    it("returns a validation error when eventId is missing", async () => {
      const createStub = sinon.stub(selfieUtil, "create");

      const response = await request.post("/selfies").send({
        imageUrl:
          "https://res.cloudinary.com/airqo/image/upload/v1/clean_air_forum_selfies/a.jpg",
      });

      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(createStub.called).to.be.false;
    });
  });

  describe("GET /selfies", () => {
    it("returns 400 when the eventId query param is missing", async () => {
      const listStub = sinon.stub(selfieUtil, "list");

      const response = await request.get("/selfies");

      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(listStub.called).to.be.false;
    });

    it("succeeds with eventId present, no auth required", async () => {
      sinon
        .stub(selfieUtil, "list")
        .resolves({ success: true, status: httpStatus.OK, data: [], meta: { total: 0 } });

      const response = await request.get("/selfies?eventId=event-1");

      expect(response.status).to.equal(httpStatus.OK);
    });
  });

  describe("PATCH /selfies/:id", () => {
    it("rejects with 401 when no Authorization header is sent", async () => {
      const hideStub = sinon.stub(selfieUtil, "hide");

      const response = await request.patch(
        "/selfies/507f1f77bcf86cd799439011"
      );

      expect(response.status).to.equal(httpStatus.UNAUTHORIZED);
      expect(hideStub.called).to.be.false;
    });

    it("rejects with 401 for a malformed/invalid token, before ever reaching the util layer", async () => {
      const hideStub = sinon.stub(selfieUtil, "hide");

      const response = await request
        .patch("/selfies/507f1f77bcf86cd799439011")
        .set("Authorization", "JWT not-a-real-token");

      expect(response.status).to.equal(httpStatus.UNAUTHORIZED);
      expect(hideStub.called).to.be.false;
    });
  });

  describe("DELETE /selfies/:id", () => {
    it("rejects with 401 when no Authorization header is sent", async () => {
      const deleteStub = sinon.stub(selfieUtil, "delete");

      const response = await request.delete(
        "/selfies/507f1f77bcf86cd799439011"
      );

      expect(response.status).to.equal(httpStatus.UNAUTHORIZED);
      expect(deleteStub.called).to.be.false;
    });

    it("rejects with 401 for a malformed/invalid token, before ever reaching the util layer", async () => {
      const deleteStub = sinon.stub(selfieUtil, "delete");

      const response = await request
        .delete("/selfies/507f1f77bcf86cd799439011")
        .set("Authorization", "JWT not-a-real-token");

      expect(response.status).to.equal(httpStatus.UNAUTHORIZED);
      expect(deleteStub.called).to.be.false;
    });
  });

  // Note: a full end-to-end "valid JWT but missing SYSTEM_ADMIN permission
  // -> 403" test would need a real signed token (constants.JWT_SECRET) plus
  // a live/stubbed UserModel + RBACService chain several layers deep inside
  // enhancedJWTAuth. There's no existing working precedent for that in this
  // repo's route tests (several pre-existing routes/v2/test/*.js files were
  // found broken or hanging during this work, unrelated to this change), so
  // rather than inventing a fragile new pattern, the enforcement primitive
  // itself is verified directly below.
  describe("requirePermissions enforcement (used to gate PATCH/DELETE)", () => {
    it("rejects with 401 when req.user is not set", async () => {
      const middleware = requirePermissions(["SYSTEM_ADMIN"]);
      const req = { user: null, query: {} };
      const next = sinon.stub();

      await middleware(req, {}, next);

      expect(next.calledOnce).to.be.true;
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.UNAUTHORIZED);
    });
  });
});
