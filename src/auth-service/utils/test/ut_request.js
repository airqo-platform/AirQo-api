process.env.NODE_ENV = "development";

const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);
const UserSchema = require("../../models/User");
const DefaultsSchema = require("../../models/Defaults");
const requestUtil = require("../request");
const { getModelByTenant } = require("../multitenancy");
const { logObject, logElement, logText } = require("../log");

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const CandidateModel = (tenant) => {
  return getModelByTenant(tenant, "candidate", DefaultsSchema);
};

const stubValue = {
  _id: faker.datatype.uuid(),
  tenant: "airqo",
  firstName: faker.name.findName(),
  lastName: faker.name.findName(),
  email: faker.internet.email(),
  organization: faker.company.companyName(),
  jobTitle: faker.name.jobTitle(),
  website: faker.internet.url(),
  description: faker.name.jobDescriptor(),
  category: faker.name.jobType(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
  password: faker.internet.password(),
  mailOptions: faker.random.objectElement(),
};

describe("request util", function () {
  describe("create", function () {
    it("should create a new candidate when the email is new", async function () {
      const stub = sinon
        .stub(CandidateModel(stubValue.tenant), "create")
        .returns(stubValue);

      const candidate = await requestUtil.create(
        stubValue.tenant,
        stubValue.firstName,
        stubValue.lastName,
        stubValue.email,
        stubValue.organization,
        stubValue.jobTitle,
        stubValue.website,
        stubValue.description,
        stubValue.category,
        stubValue.mailOptions
      );

      expect(stub.calledOnce).to.be.true;
      expect(candidate).to.be.a("object");
      assert.equal(candidate.success, false, "the candidate has been created");

      // expect(candidate._id).to.equal(stubValue._id);
      // expect(candidate.firstName).to.equal(stubValue.firstName);
      // expect(candidate.lastName).to.equal(stubValue.lastName);
      // expect(candidate.email).to.equal(stubValue.email);
      // expect(candidate.organization).to.equal(stubValue.organization);
      // expect(candidate.jobTitle).to.equal(stubValue.jobTitle);
      // expect(candidate.website).to.equal(stubValue.website);
      // expect(candidate.description).to.equal(stubValue.description);
      // expect(candidate.category).to.equal(stubValue.category);
      // expect(candidate.createdAt).to.equal(stubValue.createdAt);
      // expect(candidate.updatedAt).to.equal(stubValue.updatedAt);
    });

    it("should not accept two different requests from the same email address", async function () {
      const candidate = await requestUtil.create(
        stubValue.tenant,
        stubValue.firstName,
        stubValue.lastName,
        stubValue.email,
        stubValue.organization,
        stubValue.jobTitle,
        stubValue.website,
        stubValue.description,
        stubValue.category
      );

      expect(stub.calledOnce).to.be.true;
      expect(candidate).to.be.a("object");
      assert.equal(
        candidate.success,
        false,
        "the candidate has not been created"
      );
      // expect(candidate._id).to.equal(stubValue._id);
      // expect(candidate.firstName).to.equal(stubValue.firstName);
      // expect(candidate.lastName).to.equal(stubValue.lastName);
      // expect(candidate.email).to.equal(stubValue.email);
      // expect(candidate.organization).to.equal(stubValue.organization);
      // expect(candidate.jobTitle).to.equal(stubValue.jobTitle);
      // expect(candidate.website).to.equal(stubValue.website);
      // expect(candidate.description).to.equal(stubValue.description);
      // expect(candidate.category).to.equal(stubValue.category);
      // expect(candidate.createdAt).to.equal(stubValue.createdAt);
      // expect(candidate.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("confirm candidate", function () {
    it("should create a new User using the candidate's details", async function () {
      const stub = sinon
        .stub(UserModel(stubValue.tenant), "createUser")
        .returns(stubValue);

      const candidate = await requestUtil.confirm(
        stubValue.tenant,
        stubValue.firstName,
        stubValue.lastName,
        stubValue.email,
        stubValue.organization,
        stubValue.description,
        stubValue.password
      );

      expect(stub.calledOnce).to.be.true;
      expect(candidate._id).to.equal(stubValue._id);
      expect(candidate.firstName).to.equal(stubValue.firstName);
      expect(candidate.lastName).to.equal(stubValue.lastName);
      expect(candidate.email).to.equal(stubValue.email);
      expect(candidate.organization).to.equal(stubValue.organization);
      expect(candidate.description).to.equal(stubValue.description);
      expect(candidate.createdAt).to.equal(stubValue.createdAt);
      expect(candidate.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("get Candidate", function () {
    it("should retrieve a Candidate that matches the provided ID", async function () {
      const stub = sinon
        .stub(CandidateModel(stubValue.tenant), "list")
        .returns(stubValue);

      let filter = { lat_long: stubValue.lat_long };

      const candidate = await requestUtil.list(stubValue.tenant, filter);
      expect(stub.calledOnce).to.be.true;
      expect(candidate._id).to.equal(stubValue._id);
      expect(candidate.firstName).to.equal(stubValue.firstName);
      expect(candidate.lastName).to.equal(stubValue.lastName);
      expect(candidate.email).to.equal(stubValue.email);
      expect(candidate.organization).to.equal(stubValue.organization);
      expect(candidate.jobTitle).to.equal(stubValue.jobTitle);
      expect(candidate.website).to.equal(stubValue.website);
      expect(candidate.description).to.equal(stubValue.description);
      expect(candidate.category).to.equal(stubValue.category);
      expect(candidate.createdAt).to.equal(stubValue.createdAt);
      expect(candidate.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("update Candidate", function () {
    it("should update the Candidate and return the updated details", async function () {
      const stub = sinon
        .stub(CandidateModel(stubValue.tenant), "update")
        .returns(stubValue);
      let body = stubValue;
      delete body._id;
      const updatedSite = await requestUtil.update(
        stubValue.tenant,
        stubValue._id,
        body
      );
      expect(stub.calledOnce).to.be.true;
      expect(updatedSite).to.not.be.empty;
      expect(updatedSite).to.be.a("object");
    });
  });

  describe("delete Candidate", function () {
    it("should delete the Candidate", async function () {
      const stub = sinon
        .stub(CandidateModel(stubValue.tenant), "delete")
        .returns(stubValue);

      const deletedSite = await requestUtil.delete(
        stubValue.tenant,
        stubValue._id
      );

      expect(stub.calledOnce).to.be.true;
      expect(deletedSite).to.not.be.empty;
      expect(deletedSite).to.be.a("object");
      assert.equal(deletedSite.success, true, "the candidate has been deleted");
    });
  });
});
