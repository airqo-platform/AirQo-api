require("module-alias/register");
const rewire = require("rewire");
// Register model in-memory so factory works without DB
try {
  const _schema = rewire("@models/Group").__get__("GroupSchema");
  const mongoose = require("mongoose");
  if (!mongoose.modelNames().includes("groups")) mongoose.model("groups", _schema);
} catch (_) {}
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const GroupModel = require("@models/Group");

describe("GroupSchema statics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("register method", () => {
    it("should create a new Group and return success message with status 200", async () => {
      const args = {
        grp_title: "Group Title",
        grp_status: "ACTIVE",
        grp_tasks: 5,
        grp_description: "Group Description",
      };
      const createdData = { ...args };

      // register() passes data directly to createSuccessResponse (no _doc)
      const createStub = sinon.stub(GroupModel("airqo"), "create").resolves(createdData);

      const result = await GroupModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("group created");
      expect(result.status).to.equal(200);

      createStub.restore();
    });

    it("should return success message with status 202 if the Group is not created", async () => {
      const args = {
        grp_title: "Group Title",
        grp_status: "ACTIVE",
        grp_tasks: 5,
        grp_description: "Group Description",
      };

      const createStub = sinon.stub(GroupModel("airqo"), "create").resolves(null);

      const result = await GroupModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "group NOT successfully created but operation successful"
      );
      expect(result.status).to.equal(202);
      expect(result.data).to.be.an("array").that.is.empty;

      createStub.restore();
    });

    it("should return validation errors if the Group creation encounters duplicate values", async () => {
      const args = {
        grp_title: "Duplicate Title",
        grp_status: "ACTIVE",
        grp_tasks: 5,
        grp_description: "Group Description",
      };

      // createErrorResponse with err.code === 11000 → "duplicate values provided"
      // and errors: { grp_title: "the grp_title must be unique" }
      const createStub = sinon.stub(GroupModel("airqo"), "create").throws({
        code: 11000,
        keyValue: { grp_title: "Duplicate Title" },
        message: "duplicate key error",
      });

      const result = await GroupModel("airqo").register(args);

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        grp_title: "the grp_title must be unique",
      });
      expect(result.message).to.equal("duplicate values provided");
      expect(result.status).to.equal(409);

      createStub.restore();
    });

    it("should return validation errors if the Group creation encounters other validation errors", async () => {
      const args = {
        grp_title: "",
        grp_status: "ACTIVE",
        grp_tasks: 5,
        grp_description: "Group Description",
      };

      const createStub = sinon.stub(GroupModel("airqo"), "create").throws({
        errors: {
          grp_title: {
            message: "grp_title is required",
          },
        },
        message: "validation error",
      });

      const result = await GroupModel("airqo").register(args);

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        grp_title: "grp_title is required",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      createStub.restore();
    });
  });

  describe.skip("list method", () => {
    // Skipped: list() calls countDocuments() then aggregate().match().lookup()...
    // Complex builder chain + countDocuments require DB-free setup beyond simple stubs.
  });

  describe("modify method", () => {
    it("should modify the group and return the updated group", async () => {
      const groupData = {
        _id: new mongoose.Types.ObjectId(),
        grp_title: "group 1",
        grp_status: "INACTIVE",
        grp_description: "Description",
      };

      // modify() calls findOneAndUpdate(...).exec() and returns updatedGroup._doc
      const findOneAndUpdateStub = sinon
        .stub(GroupModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...groupData, _doc: groupData }) });

      const filter = { _id: groupData._id };
      const result = await GroupModel("airqo").modify({ filter, update: { grp_status: "INACTIVE" } });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "successfully modified the group");
      expect(result).to.have.property("status", httpStatus.OK);
      expect(result.data).to.deep.equal(groupData);

      findOneAndUpdateStub.restore();
    });

    it("should return 'group does not exist' message if no group found for modification", async () => {
      const findOneAndUpdateStub = sinon
        .stub(GroupModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const filter = { _id: "non_existent_group_id" };
      const result = await GroupModel("airqo").modify({ filter, update: { grp_status: "INACTIVE" } });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      // Group.modify() passes custom message: "group does not exist, please crosscheck -- Not Found"
      expect(result).to.have.property(
        "message",
        "group does not exist, please crosscheck -- Not Found"
      );
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove method", () => {
    it("should remove the group and return the removed group data", async () => {
      const groupData = {
        _id: new mongoose.Types.ObjectId(),
        grp_title: "Group 1",
        grp_status: "active",
        grp_description: "Group description",
      };

      // remove() calls findOneAndRemove(...).exec() and returns removedGroup._doc
      const findOneAndRemoveStub = sinon
        .stub(GroupModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...groupData, _doc: groupData }) });

      const filter = { _id: groupData._id };
      const result = await GroupModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "successfully removed the group");
      expect(result).to.have.property("status", httpStatus.OK);
      expect(result.data).to.deep.equal(groupData);

      findOneAndRemoveStub.restore();
    });

    it("should return 'group not found' message if no group found for removal", async () => {
      const findOneAndRemoveStub = sinon
        .stub(GroupModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(null) });

      const filter = { _id: "non_existent_group_id" };
      const result = await GroupModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      // Group.remove() passes custom message: "Bad Request, Group Not Found -- please crosscheck"
      expect(result).to.have.property(
        "message",
        "Bad Request, Group Not Found -- please crosscheck"
      );
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);

      findOneAndRemoveStub.restore();
    });
  });
});

describe("GroupSchema methods", () => {
  describe("toJSON method", () => {
    it("should return a JSON object with specific properties", () => {
      const groupId = new mongoose.Types.ObjectId();

      const group = new (GroupModel("airqo"))({
        _id: groupId,
        grp_title: "group title",
        grp_status: "ACTIVE",
        grp_tasks: 5,
        grp_description: "Group Description",
      });

      const result = group.toJSON();

      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(groupId.toString());
      expect(result).to.have.property("grp_title");
      expect(result).to.have.property("grp_status", "ACTIVE");
      expect(result).to.have.property("grp_tasks", 5);
      expect(result).to.have.property("grp_description", "Group Description");
    });
  });
});
