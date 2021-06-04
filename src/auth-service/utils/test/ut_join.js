process.env.NODE_ENV = "development";

const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);
const UserModel = require("../../models/User");
const joinUtil = require("../join");

const stubValue = {
  _id: faker.datatype.uuid(),
  tenant: "airqo",
  firstName: faker.name.findName(),
  lastName: faker.name.findName(),
  email: faker.internet.email(),
  privilege: faker.name.jobType(),
  organization: faker.company.companyName(),
  description: faker.name.jobDescriptor(),
  phoneNumber: faker.phone.phoneNumber(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
  password: faker.internet.password(),
  profilePicture: faker.image.imageUrl(),
};

describe("create User utils", function () {
  describe("create", function () {
    it("should create a new user", async function () {
      const stub = sinon
        .stub(UserModel(stubValue.tenant), "create")
        .returns(stubValue);

      const user = await joinUtil.createUser(
        stubValue.tenant,
        stubValue.latitude,
        stubValue.longitude,
        stubValue.name
      );

      expect(stub.calledOnce).to.be.true;
      expect(user._id).to.equal(stubValue._id);
      expect(user.userName).to.equal(stubValue.userName);
      expect(user.firstName).to.equal(stubValue.firstName);
      expect(user.lastName).to.equal(stubValue.lastName);
      expect(user.email).to.equal(stubValue.email);
      expect(user.createdAt).to.equal(stubValue.createdAt);
      expect(user.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("get User", function () {
    it("should retrieve a User that matches the provided ID", async function () {
      const stub = sinon
        .stub(UserModel(stubValue.tenant), "list")
        .returns(stubValue);

      let filter = { _id: stubValue._id };

      const user = await joinUtil.getUser(stubValue.tenant, filter);
      expect(stub.calledOnce).to.be.true;
      expect(user._id).to.equal(stubValue._id);
      expect(user.userName).to.equal(stubValue.userName);
      expect(user.firstName).to.equal(stubValue.firstName);
      expect(user.lastName).to.equal(stubValue.lastName);
      expect(user.email).to.equal(stubValue.email);
      expect(user.createdAt).to.equal(stubValue.createdAt);
      expect(user.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("update User", function () {
    it("should update the User and return the updated details", async function () {
      const stub = sinon
        .stub(UserModel(stubValue.tenant), "update")
        .returns(stubValue);

      let body = stubValue;
      delete body._id;

      const updatedSite = await joinUtil.updateUser(
        stubValue.tenant,
        stubValue._id,
        body
      );

      expect(stub.calledOnce).to.be.true;
      expect(updatedSite).to.not.be.empty;
      expect(updatedSite).to.be.a("object");
    });
  });

  describe("delete User", function () {
    it("should delete the User", async function () {
      const stub = sinon
        .stub(UserModel(stubValue.tenant), "delete")
        .returns(stubValue);

      const deletedSite = await joinUtil.deleteUser(
        stubValue.tenant,
        stubValue._id
      );

      expect(stub.calledOnce).to.be.true;
      expect(deletedSite).to.not.be.empty;
      expect(deletedSite).to.be.a("object");
      assert.equal(deletedSite.success, true, "the user has been deleted");
    });
  });

  describe("validate User name", function () {
    it("it should return true if the user name has no spaces", function () {
      let isValid = joinUtil.validateUserName("yesMeQeaer");
      assert.equal(isValid, true, "the user Name has no spaces");
    });

    it("should return true if the user name is not longer than 15 characters", function () {
      let isValid = joinUtil.validateUserName("qewr245245wegew");
      assert.equal(
        isValid,
        true,
        "the user Name is not longer than 15 characters"
      );
    });

    it("should return true if the user name if not shorter than 4 characters", function () {
      let isValid = joinUtil.validateUserName("134141341");
      assert.equal(isValid, true, "the user name is longer than 4 characters");
    });
  });
});
