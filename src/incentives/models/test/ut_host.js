require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");
const HostModel = require("./HostModel");

describe("HostModel", () => {
  describe("register", () => {
    it("should create a new host", async () => {
      const args = {
        first_name: "John",
        last_name: "Doe",
        phone_number: "123456789",
        email: "john@example.com",
        site_id: "1234567890",
      };

      const createStub = sinon.stub(HostModel, "create").resolves(args);

      const result = await HostModel.register(args);

      expect(createStub.calledOnceWith(args)).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        data: args,
        message: "host created",
      });

      createStub.restore();
    });

    it("should handle validation errors", async () => {
      const args = {
        first_name: "John",
        last_name: "Doe",
        phone_number: "123456789",
        email: "john@example.com",
        site_id: "1234567890",
      };

      const error = new Error("Validation error");
      error.errors = {
        email: { message: "Email is required" },
      };

      const createStub = sinon.stub(HostModel, "create").throws(error);

      const result = await HostModel.register(args);

      expect(createStub.calledOnceWith(args)).to.be.true;
      expect(result).to.deep.equal({
        errors: { email: "Email is required" },
        message: "validation errors for some of the provided fields",
        success: false,
        status: httpStatus.CONFLICT,
      });

      createStub.restore();
    });

    // Add more test cases for the register method if needed
  });

  describe("list", () => {
    it("should list hosts with filter and pagination", async () => {
      const filter = { site_id: "1234567890" };
      const skip = 0;
      const limit = 5;
      const hosts = [
        { first_name: "John", last_name: "Doe", site_id: "1234567890" },
        { first_name: "Jane", last_name: "Doe", site_id: "1234567890" },
      ];

      const aggregateStub = sinon.stub().returnsThis();
      const matchStub = sinon.stub().returnsThis();
      const addFieldsStub = sinon.stub().returnsThis();
      const sortStub = sinon.stub().returnsThis();
      const skipStub = sinon.stub().returnsThis();
      const limitStub = sinon.stub().returnsThis();
      const execStub = sinon.stub().resolves(hosts);

      const modelStub = {
        aggregate: aggregateStub,
      };

      aggregateStub.returns({
        match: matchStub,
        addFields: addFieldsStub,
        sort: sortStub,
        skip: skipStub,
        limit: limitStub,
        exec: execStub,
      });

      const result = await HostModel.list({ filter, skip, limit });

      expect(result).to.deep.equal({
        success: true,
        data: hosts,
        message: "successfully listed the hosts",
        status: httpStatus.OK,
      });

      expect(aggregateStub.calledOnce).to.be.true;
      expect(matchStub.calledOnceWith(filter)).to.be.true;
      expect(addFieldsStub.calledOnce).to.be.true;
      expect(sortStub.calledOnceWith({ createdAt: -1 })).to.be.true;
      expect(skipStub.calledOnceWith(skip)).to.be.true;
      expect(limitStub.calledOnceWith(limit)).to.be.true;
      expect(execStub.calledOnce).to.be.true;
    });

    // Add more test cases for the list method if needed
  });

  describe("modify", () => {
    it("should modify an existing host", async () => {
      const filter = { _id: "1234567890" };
      const update = { first_name: "John" };
      const modifiedUpdate = { first_name: "John", __v: 1 };
      const updatedHost = { _id: "1234567890", first_name: "John" };

      const findOneAndUpdateStub = sinon
        .stub(HostModel, "findOneAndUpdate")
        .resolves(updatedHost);

      const result = await HostModel.modify({ filter, update });

      expect(
        findOneAndUpdateStub.calledOnceWith(filter, modifiedUpdate, {
          new: true,
        })
      ).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "successfully modified the host",
        data: updatedHost,
        status: httpStatus.OK,
      });

      findOneAndUpdateStub.restore();
    });

    // Add more test cases for the modify method if needed
  });

  describe("remove", () => {
    it("should remove an existing host", async () => {
      const filter = { _id: "1234567890" };
      const removedHost = {
        _id: "1234567890",
        email: "john@example.com",
        first_name: "John",
        last_name: "Doe",
      };

      const findOneAndRemoveStub = sinon
        .stub(HostModel, "findOneAndRemove")
        .resolves(removedHost);

      const result = await HostModel.remove({ filter });

      expect(
        findOneAndRemoveStub.calledOnceWith(filter, {
          projection: { _id: 1, email: 1, first_name: 1, last_name: 1 },
        })
      ).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "successfully removed the host",
        data: removedHost,
        status: httpStatus.OK,
      });

      findOneAndRemoveStub.restore();
    });

    // Add more test cases for the remove method if needed
  });
});
