require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");
const { generateFilter } = require("@utils/common");

const VALID_URL =
  "https://res.cloudinary.com/airqo/image/upload/v123/clean_air_forum_selfies/abc.jpg";

describe("selfie util", () => {
  let selfieUtil;
  let selfieModelInstance;
  let guestUserModelInstance;

  beforeEach(() => {
    selfieModelInstance = {
      register: sinon.stub(),
      list: sinon.stub(),
      modify: sinon.stub(),
      findOne: sinon.stub(),
      remove: sinon.stub(),
    };
    guestUserModelInstance = {
      findOne: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
      modify: sinon.stub().resolves({ success: true }),
    };

    selfieUtil = rewire("@utils/selfie.util");
    selfieUtil.__set__("SelfieModel", () => selfieModelInstance);
    selfieUtil.__set__("GuestUserModel", () => guestUserModelInstance);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("create", () => {
    it("uses the JWT user's id/userName and generates avatarIcon when not supplied", async () => {
      selfieModelInstance.register.resolves({
        success: true,
        data: {},
        status: httpStatus.OK,
      });

      const request = {
        query: {},
        body: { eventId: "e1", imageUrl: VALID_URL },
        user: { _id: "user-1", userName: "janedoe" },
      };
      const next = sinon.stub();

      await selfieUtil.create(request, next);

      expect(selfieModelInstance.register.calledOnce).to.be.true;
      const payload = selfieModelInstance.register.firstCall.args[0];
      expect(payload.user_id).to.equal("user-1");
      expect(payload.displayName).to.equal("janedoe");
      expect(payload.avatarIcon).to.be.a("string").that.is.not.empty;
      expect(payload.guest_id).to.be.undefined;
      expect(guestUserModelInstance.findOne.called).to.be.false;
    });

    it("resolves identity from a known guest_id and touches lastActive using $set", async () => {
      selfieModelInstance.register.resolves({
        success: true,
        data: {},
        status: httpStatus.OK,
      });
      guestUserModelInstance.findOne = sinon.stub().returns({
        lean: sinon.stub().resolves({
          guest_id: "GUEST123",
          displayName: "Curious Fox 123",
          avatarIcon: "🦊",
        }),
      });

      const request = {
        query: {},
        body: { eventId: "e1", imageUrl: VALID_URL, guest_id: "GUEST123" },
        user: null,
      };
      const next = sinon.stub();

      await selfieUtil.create(request, next);

      const payload = selfieModelInstance.register.firstCall.args[0];
      expect(payload.guest_id).to.equal("GUEST123");
      expect(payload.displayName).to.equal("Curious Fox 123");
      expect(payload.avatarIcon).to.equal("🦊");

      // Regression test: MongoDB treats a non-operator update document as a
      // full replacement, which would wipe the guest's other fields
      // (including guest_id itself). The touch must be wrapped in $set.
      expect(guestUserModelInstance.modify.calledOnce).to.be.true;
      const modifyArgs = guestUserModelInstance.modify.firstCall.args[0];
      expect(modifyArgs.filter).to.deep.equal({ guest_id: "GUEST123" });
      expect(modifyArgs.update).to.have.property("$set");
      expect(modifyArgs.update.$set).to.have.property("lastActive");
      expect(modifyArgs.update).to.not.have.property("lastActive");
    });

    it("falls through to a fresh anonymous identity when guest_id doesn't resolve", async () => {
      selfieModelInstance.register.resolves({
        success: true,
        data: {},
        status: httpStatus.OK,
      });
      guestUserModelInstance.findOne = sinon
        .stub()
        .returns({ lean: sinon.stub().resolves(null) });

      const request = {
        query: {},
        body: { eventId: "e1", imageUrl: VALID_URL, guest_id: "STALE_ID" },
        user: null,
      };
      const next = sinon.stub();

      await selfieUtil.create(request, next);

      const payload = selfieModelInstance.register.firstCall.args[0];
      expect(payload.guest_id).to.be.undefined;
      expect(payload.displayName).to.be.a("string").that.is.not.empty;
      expect(payload.avatarIcon).to.be.a("string").that.is.not.empty;
    });

    it("generates a fresh anonymous identity when there is no JWT and no guest_id", async () => {
      selfieModelInstance.register.resolves({
        success: true,
        data: {},
        status: httpStatus.OK,
      });

      const request = {
        query: {},
        body: { eventId: "e1", imageUrl: VALID_URL },
        user: null,
      };
      const next = sinon.stub();

      await selfieUtil.create(request, next);

      expect(guestUserModelInstance.findOne.called).to.be.false;
      const payload = selfieModelInstance.register.firstCall.args[0];
      expect(payload.displayName).to.be.a("string").that.is.not.empty;
      expect(payload.avatarIcon).to.be.a("string").that.is.not.empty;
    });

    it("strips hidden/hiddenAt/hiddenBy from the client body before registering", async () => {
      selfieModelInstance.register.resolves({
        success: true,
        data: {},
        status: httpStatus.OK,
      });

      const request = {
        query: {},
        body: {
          eventId: "e1",
          imageUrl: VALID_URL,
          locationName: "Pretoria",
          pm25Value: 5,
          aqiCategory: "Good",
          hidden: true,
          hiddenAt: new Date(),
          hiddenBy: "someone",
        },
        user: null,
      };
      const next = sinon.stub();

      await selfieUtil.create(request, next);

      const payload = selfieModelInstance.register.firstCall.args[0];
      expect(payload).to.not.have.property("hidden");
      expect(payload).to.not.have.property("hiddenAt");
      expect(payload).to.not.have.property("hiddenBy");
      expect(payload.eventId).to.equal("e1");
      expect(payload.locationName).to.equal("Pretoria");
      expect(payload.pm25Value).to.equal(5);
      expect(payload.aqiCategory).to.equal("Good");
    });
  });

  describe("list", () => {
    it("builds the filter via generateFilter.selfies and forwards skip/limit", async () => {
      const filterStub = sinon
        .stub(generateFilter, "selfies")
        .returns({ eventId: "e1", hidden: false });
      selfieModelInstance.list.resolves({
        success: true,
        data: [],
        meta: {},
      });

      const request = { query: { eventId: "e1", skip: 5, limit: 10 } };
      const next = sinon.stub();

      await selfieUtil.list(request, next);

      expect(filterStub.calledOnce).to.be.true;
      const listArgs = selfieModelInstance.list.firstCall.args[0];
      expect(listArgs).to.deep.include({
        skip: 5,
        limit: 10,
        filter: { eventId: "e1", hidden: false },
      });
    });
  });

  describe("hide", () => {
    it("calls SelfieModel.modify with the right filter and $set update", async () => {
      selfieModelInstance.modify.resolves({
        success: true,
        data: {},
        status: httpStatus.OK,
      });

      const request = {
        query: {},
        params: { id: "abc123" },
        user: { _id: "admin-1" },
      };
      const next = sinon.stub();

      await selfieUtil.hide(request, next);

      const args = selfieModelInstance.modify.firstCall.args[0];
      expect(args.filter).to.deep.equal({ _id: "abc123" });
      expect(args.update.$set.hidden).to.be.true;
      expect(args.update.$set).to.have.property("hiddenAt");
      expect(args.update.$set.hiddenBy).to.equal("admin-1");
    });
  });

  describe("delete", () => {
    it("returns early without removing when the selfie doesn't exist", async () => {
      selfieModelInstance.findOne.resolves({
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "selfie not found",
      });

      const request = { query: {}, params: { id: "missing" } };
      const next = sinon.stub();

      const result = await selfieUtil.delete(request, next);

      expect(selfieModelInstance.remove.called).to.be.false;
      expect(result.success).to.be.false;
    });

    it("extracts the Cloudinary public_id and calls destroy before removing", async () => {
      selfieModelInstance.findOne.resolves({
        success: true,
        data: { imageUrl: VALID_URL },
      });
      selfieModelInstance.remove.resolves({
        success: true,
        data: {},
        status: httpStatus.OK,
      });
      const destroyStub = sinon.stub().resolves();
      selfieUtil.__set__("destroyCloudinaryAsset", destroyStub);

      const request = { query: {}, params: { id: "abc123" } };
      const next = sinon.stub();

      await selfieUtil.delete(request, next);

      expect(destroyStub.calledOnce).to.be.true;
      expect(destroyStub.firstCall.args[0]).to.equal(
        "clean_air_forum_selfies/abc"
      );
      expect(selfieModelInstance.remove.calledOnce).to.be.true;
    });

    it("still removes the record even when Cloudinary deletion is a no-op", async () => {
      // Stubbed explicitly rather than relying on Cloudinary env vars being
      // absent -- other test files in this suite set dummy Cloudinary env
      // vars at process level, and depending on Mocha's file load order
      // within a single run, ambient env state here would be nondeterministic
      // (and could otherwise attempt a real, offline Cloudinary API call).
      const destroyStub = sinon.stub().resolves();
      selfieUtil.__set__("destroyCloudinaryAsset", destroyStub);
      selfieModelInstance.findOne.resolves({
        success: true,
        data: { imageUrl: VALID_URL },
      });
      selfieModelInstance.remove.resolves({
        success: true,
        data: {},
        status: httpStatus.OK,
      });

      const request = { query: {}, params: { id: "abc123" } };
      const next = sinon.stub();

      const result = await selfieUtil.delete(request, next);

      expect(destroyStub.calledOnce).to.be.true;
      expect(result.success).to.be.true;
      expect(selfieModelInstance.remove.calledOnce).to.be.true;
    });
  });
});
