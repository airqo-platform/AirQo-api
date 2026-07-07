require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");

describe("guest-user util", () => {
  let guestUserUtil;
  let guestUserModelInstance;
  let userModelInstance;

  beforeEach(() => {
    guestUserModelInstance = {
      findOneAndDelete: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
      create: sinon.stub().resolves({}),
    };
    userModelInstance = {
      register: sinon.stub(),
    };

    guestUserUtil = rewire("@utils/guest-user.util");
    guestUserUtil.__set__("GuestUserModel", () => guestUserModelInstance);
    guestUserUtil.__set__("UserModel", () => userModelInstance);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("convertGuest", () => {
    it("returns 400 before any DB call when guest_id is missing", async () => {
      const request = { query: {}, body: {} };
      const next = sinon.stub();

      await guestUserUtil.convertGuest(request, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.BAD_REQUEST
      );
      expect(guestUserModelInstance.findOneAndDelete.called).to.be.false;
    });

    it("returns 400 and never calls UserModel.register or attempts a restore for a non-existent guest_id", async () => {
      guestUserModelInstance.findOneAndDelete = sinon
        .stub()
        .returns({ lean: sinon.stub().resolves(null) });

      const request = {
        query: {},
        body: { guest_id: "UNKNOWN", email: "a@b.com", password: "pw" },
      };
      const next = sinon.stub();

      await guestUserUtil.convertGuest(request, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.BAD_REQUEST
      );
      expect(userModelInstance.register.called).to.be.false;
      expect(guestUserModelInstance.create.called).to.be.false;
    });

    it("atomically claims the guest via findOneAndDelete and fills in missing name fields from it", async () => {
      const guestDoc = {
        _id: "gid1",
        guest_id: "GUEST123",
        firstName: "Jane",
        lastName: "Doe",
        displayName: "Curious Fox 123",
      };
      guestUserModelInstance.findOneAndDelete = sinon
        .stub()
        .returns({ lean: sinon.stub().resolves(guestDoc) });
      userModelInstance.register.resolves({
        success: true,
        status: httpStatus.OK,
        data: { _id: "newUser1" },
      });

      const request = {
        query: {},
        body: { guest_id: "GUEST123", email: "a@b.com", password: "pw" },
      };
      const next = sinon.stub();

      const result = await guestUserUtil.convertGuest(request, next);

      expect(guestUserModelInstance.findOneAndDelete.calledWith({
        guest_id: "GUEST123",
      })).to.be.true;
      const registrationArgs = userModelInstance.register.firstCall.args[0];
      expect(registrationArgs.firstName).to.equal("Jane");
      expect(registrationArgs.lastName).to.equal("Doe");
      expect(registrationArgs.userName).to.equal("Curious Fox 123");
      expect(result.success).to.be.true;
      // Registration succeeded, so the claimed guest must not be restored.
      expect(guestUserModelInstance.create.called).to.be.false;
    });

    it("lets client-supplied firstName/lastName/userName win over the guest's stored values", async () => {
      const guestDoc = {
        _id: "gid1",
        guest_id: "GUEST123",
        firstName: "Jane",
        lastName: "Doe",
        displayName: "Curious Fox 123",
      };
      guestUserModelInstance.findOneAndDelete = sinon
        .stub()
        .returns({ lean: sinon.stub().resolves(guestDoc) });
      userModelInstance.register.resolves({
        success: true,
        status: httpStatus.OK,
        data: { _id: "newUser1" },
      });

      const request = {
        query: {},
        body: {
          guest_id: "GUEST123",
          email: "a@b.com",
          password: "pw",
          firstName: "Explicit",
          lastName: "Client",
          userName: "explicit_client",
        },
      };
      const next = sinon.stub();

      await guestUserUtil.convertGuest(request, next);

      const registrationArgs = userModelInstance.register.firstCall.args[0];
      expect(registrationArgs.firstName).to.equal("Explicit");
      expect(registrationArgs.lastName).to.equal("Client");
      expect(registrationArgs.userName).to.equal("explicit_client");
    });

    it("restores the claimed guest document when registration fails", async () => {
      const guestDoc = {
        _id: "gid1",
        guest_id: "GUEST123",
        firstName: "Jane",
        lastName: "Doe",
      };
      guestUserModelInstance.findOneAndDelete = sinon
        .stub()
        .returns({ lean: sinon.stub().resolves(guestDoc) });
      userModelInstance.register.resolves({
        success: false,
        status: httpStatus.CONFLICT,
        message: "duplicate values provided",
      });

      const request = {
        query: {},
        body: { guest_id: "GUEST123", email: "a@b.com", password: "pw" },
      };
      const next = sinon.stub();

      const result = await guestUserUtil.convertGuest(request, next);

      expect(guestUserModelInstance.create.calledOnce).to.be.true;
      expect(guestUserModelInstance.create.firstCall.args[0]).to.deep.equal(
        guestDoc
      );
      expect(result.success).to.be.false;
    });

    it("still returns the failure response even if the restore attempt itself throws", async () => {
      const guestDoc = { _id: "gid1", guest_id: "GUEST123" };
      guestUserModelInstance.findOneAndDelete = sinon
        .stub()
        .returns({ lean: sinon.stub().resolves(guestDoc) });
      guestUserModelInstance.create = sinon
        .stub()
        .rejects(new Error("restore failed"));
      userModelInstance.register.resolves({
        success: false,
        status: httpStatus.CONFLICT,
        message: "duplicate values provided",
      });

      const request = {
        query: {},
        body: { guest_id: "GUEST123", email: "a@b.com", password: "pw" },
      };
      const next = sinon.stub();

      const result = await guestUserUtil.convertGuest(request, next);

      expect(result.success).to.be.false;
      expect(next.called).to.be.false;
    });
  });
});
