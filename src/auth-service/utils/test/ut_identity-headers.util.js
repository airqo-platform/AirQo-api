require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const rewire = require("rewire");

const rewireIdentityHeaders = rewire("@utils/identity-headers.util");

describe("identity-headers.util", () => {
  describe("attachIdentityHeaders", () => {
    let origGroupModel;
    let res;

    beforeEach(() => {
      origGroupModel = rewireIdentityHeaders.__get__("GroupModel");
      res = { set: sinon.stub() };
    });

    afterEach(() => {
      rewireIdentityHeaders.__set__("GroupModel", origGroupModel);
      sinon.restore();
    });

    it("should set X-Auth-User-Id and X-Auth-User-Groups for a user with groups", async () => {
      const findStub = sinon.stub().returns({
        select: sinon.stub().returns({
          lean: sinon.stub().resolves([
            { grp_title: "airqo" },
            { grp_title: "kcca" },
          ]),
        }),
      });
      rewireIdentityHeaders.__set__("GroupModel", () => ({ find: findStub }));

      const attachIdentityHeaders = rewireIdentityHeaders.__get__(
        "attachIdentityHeaders",
      );
      const user = {
        _id: "u1",
        group_roles: [{ group: "g1" }, { group: "g2" }],
      };
      await attachIdentityHeaders(res, user, "airqo");

      expect(res.set.calledWith("X-Auth-User-Id", "u1")).to.be.true;
      expect(res.set.calledWith("X-Auth-User-Groups", "airqo,kcca")).to.be
        .true;
    });

    it("should set an empty X-Auth-User-Groups header when the user has no group_roles", async () => {
      const attachIdentityHeaders = rewireIdentityHeaders.__get__(
        "attachIdentityHeaders",
      );
      const user = { _id: "u2", group_roles: [] };
      await attachIdentityHeaders(res, user, "airqo");

      expect(res.set.calledWith("X-Auth-User-Id", "u2")).to.be.true;
      expect(res.set.calledWith("X-Auth-User-Groups", "")).to.be.true;
    });

    it("should not set any headers when no user is provided", async () => {
      const attachIdentityHeaders = rewireIdentityHeaders.__get__(
        "attachIdentityHeaders",
      );
      await attachIdentityHeaders(res, null, "airqo");

      expect(res.set.called).to.be.false;
    });

    it("should not throw when the group lookup fails", async () => {
      rewireIdentityHeaders.__set__("GroupModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({
            lean: sinon.stub().rejects(new Error("db down")),
          }),
        }),
      }));

      const attachIdentityHeaders = rewireIdentityHeaders.__get__(
        "attachIdentityHeaders",
      );
      const user = { _id: "u3", group_roles: [{ group: "g1" }] };

      await attachIdentityHeaders(res, user, "airqo");
      expect(res.set.calledWith("X-Auth-User-Id", "u3")).to.be.true;
    });
  });
});
