require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const createAccessRequest = require("@utils/request.util");
const AccessRequestModel = require("@models/AccessRequest");
const RoleModel = require("@models/Role");
const UserModel = require("@models/User");

const TENANT = "airqo";
const oid = () => new mongoose.Types.ObjectId();

describe("processBulkAccessRequestDecision — per-request failure containment", () => {
  const grpId = oid();
  const roleId = oid();
  const requests = { ok: oid(), rereadFails: oid(), roleFails: oid() };
  const users = { ok: oid(), rereadFails: oid(), roleFails: oid() };

  beforeEach(async () => {
    await RoleModel(TENANT).collection.insertOne({
      _id: roleId,
      role_name: "BULK_TEST_VIEWER",
      role_code: "BULK_TEST_VIEWER",
      group_id: grpId,
      role_status: "ACTIVE",
      role_permissions: [],
    });
    await AccessRequestModel(TENANT).collection.insertMany(
      Object.keys(requests).map((k) => ({
        _id: requests[k],
        user_id: users[k],
        email: `${k}@example.test`,
        requestType: "group",
        targetId: grpId,
        status: "pending",
      })),
    );

    // Approval itself succeeds for every request.
    sinon
      .stub(createAccessRequest, "approveAccessRequest")
      .resolves({ success: true });

    const accessRequests = AccessRequestModel(TENANT);
    const realFindById = accessRequests.findById.bind(accessRequests);
    sinon.stub(accessRequests, "findById").callsFake((id) => {
      if (id.toString() === requests.rereadFails.toString()) {
        return {
          select: () => ({
            lean: () => Promise.reject(new Error("read timeout")),
          }),
        };
      }
      return realFindById(id);
    });

    const usersModel = UserModel(TENANT);
    sinon.stub(usersModel, "updateOne").callsFake(async (filter) => {
      if (filter._id.toString() === users.roleFails.toString()) {
        throw new Error("write conflict");
      }
      return { nModified: 1 };
    });
  });

  afterEach(async () => {
    sinon.restore();
    await RoleModel(TENANT).collection.deleteMany({ _id: roleId });
    await AccessRequestModel(TENANT).collection.deleteMany({
      _id: { $in: Object.values(requests) },
    });
  });

  it("records re-read and role failures per request and still processes the rest", async () => {
    const result = await createAccessRequest.processBulkAccessRequestDecision({
      tenant: TENANT,
      grp_id: grpId.toString(),
      request_ids: [requests.rereadFails, requests.roleFails, requests.ok].map(
        String,
      ),
      decision: "approved",
      default_role: roleId.toString(),
      user: { _id: oid(), email: "admin@example.test" },
    });

    expect(result.success).to.equal(true);
    const byId = Object.fromEntries(
      result.data.results.map((r) => [r.request_id, r]),
    );

    const reread = byId[requests.rereadFails.toString()];
    expect(reread.outcome).to.equal("approved");
    expect(reread.user_status).to.equal("unresolved");
    expect(reread.role_assignment).to.equal("unresolved");

    const roleFail = byId[requests.roleFails.toString()];
    expect(roleFail.outcome).to.equal("approved");
    expect(roleFail.role_assignment).to.equal("failed");

    const ok = byId[requests.ok.toString()];
    expect(ok.outcome).to.equal("approved");
    expect(ok.role_assignment).to.equal("applied");

    expect(result.data.processed_count).to.equal(3);
  });
});
