require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");

const rewireUserType = rewire("@utils/user-type.util");

/**
 * Regression tests written after a PR review found this file had zero test
 * coverage and several real bugs, some pre-existing (predating the
 * network-removal work) and some introduced while removing net_id branches:
 *
 * - `UserModel`/`GroupModel` were used throughout but never `require()`d —
 *   every function here threw a ReferenceError on any real invocation.
 * - `assignUserType`/`assignManyUsersToUserType` did
 *   `$set: { group_roles: { group, userType } }` — replacing the user's
 *   entire `group_roles` ARRAY with a single bare object, destroying every
 *   other group membership instead of updating just the matching entry's
 *   userType. Fixed to a positional `"group_roles.$.userType"` update.
 * - Both functions called `next(...)` on error without `return`-ing,
 *   so execution continued past the intended stop point.
 * - `assignManyUsersToUserType` had no guard for a missing `grp_id`, which
 *   (post network-removal, `net_id` no longer exists) would run
 *   `updateOne({ _id }, {})` — a no-op-at-best, disguised-as-success update.
 */
describe("user-type.util — assignment bug regressions", () => {
  let revertUserModel;

  afterEach(() => {
    sinon.restore();
    if (revertUserModel) {
      revertUserModel();
      revertUserModel = undefined;
    }
  });

  describe("assignUserType()", () => {
    it("rejects with 400 when grp_id is missing, without touching the database", async () => {
      const findByIdAndUpdateStub = sinon.stub();
      revertUserModel = rewireUserType.__set__("UserModel", () => ({
        exists: sinon.stub().resolves(true),
        findOneAndUpdate: findByIdAndUpdateStub,
      }));

      const next = sinon.stub();
      await rewireUserType.assignUserType(
        { body: { user_id: "u1", user_type: "user", tenant: "airqo" } },
        next,
      );

      expect(next.calledOnce).to.equal(true);
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
      expect(findByIdAndUpdateStub.called).to.equal(false);
    });

    it("updates only the matching group_roles entry's userType via a positional update — never replaces the whole array", async () => {
      const findOneAndUpdateStub = sinon.stub().resolves({
        _id: "u1",
        group_roles: [{ group: "g1", userType: "admin" }],
      });
      revertUserModel = rewireUserType.__set__("UserModel", () => ({
        exists: sinon.stub().resolves(true),
        findOneAndUpdate: findOneAndUpdateStub,
      }));

      const next = sinon.stub();
      const result = await rewireUserType.assignUserType(
        {
          body: {
            user_id: "u1",
            grp_id: "g1",
            user_type: "admin",
            tenant: "airqo",
          },
        },
        next,
      );

      expect(next.called).to.equal(false);
      expect(findOneAndUpdateStub.calledOnce).to.equal(true);

      const [filter, update] = findOneAndUpdateStub.firstCall.args;
      // Must filter by the specific group_roles entry, not just the user.
      expect(filter).to.deep.include({ "group_roles.group": "g1" });
      // Must be a positional field update, not a whole-array replacement.
      expect(update.$set).to.have.property(
        "group_roles.$.userType",
        "admin",
      );
      expect(update.$set).to.not.have.property("group_roles");

      expect(result.success).to.equal(true);
    });
  });

  describe("assignManyUsersToUserType()", () => {
    it("rejects with 400 when grp_id is missing, without attempting any user update", async () => {
      const updateOneStub = sinon.stub();
      revertUserModel = rewireUserType.__set__("UserModel", () => ({
        findById: sinon.stub(),
        updateOne: updateOneStub,
      }));

      const next = sinon.stub();
      await rewireUserType.assignManyUsersToUserType(
        {
          body: {
            user_ids: ["u1", "u2"],
            user_type: "admin",
            tenant: "airqo",
          },
        },
        next,
      );

      expect(next.calledOnce).to.equal(true);
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
      expect(updateOneStub.called).to.equal(false);
    });

    it("updates each assigned user's matching group_roles entry via a positional update", async () => {
      const updateOneStub = sinon.stub().resolves({});
      revertUserModel = rewireUserType.__set__("UserModel", () => ({
        findById: sinon.stub().resolves({
          _id: "u1",
          group_roles: [{ group: "g1", userType: "user" }],
        }),
        updateOne: updateOneStub,
      }));

      const next = sinon.stub();
      const result = await rewireUserType.assignManyUsersToUserType(
        {
          body: {
            user_ids: ["u1"],
            grp_id: "g1",
            user_type: "admin",
            tenant: "airqo",
          },
        },
        next,
      );

      expect(next.called).to.equal(false);
      expect(updateOneStub.calledOnce).to.equal(true);
      const [filter, update] = updateOneStub.firstCall.args;
      expect(filter).to.deep.include({ "group_roles.group": "g1" });
      expect(update.$set).to.have.property(
        "group_roles.$.userType",
        "admin",
      );
      expect(update.$set).to.not.have.property("group_roles");
      expect(result.success).to.equal(true);
    });
  });
});
