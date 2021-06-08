process.env.NODE_ENV = "development";

const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);
const CandidateModel = require("../../models/Candidate");
const UserModel = require("../../models/User");
const generateFilterUtil = require("../generate-filter");

const stubValue = {
  _id: faker.datatype.uuid(),
  tenant: "airqo",
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
};

describe("generate-filter util", function () {
  describe("filter candidates", function () {
    it("should filter candidates", async function () {
      const stub = sinon
        .stub(CandidateModel(stubValue.tenant), "create")
        .returns(stubValue);

      const site = await generateFilterUtil.createSite(
        stubValue.tenant,
        stubValue.latitude,
        stubValue.longitude,
        stubValue.name
      );

      expect(stub.calledOnce).to.be.true;
      expect(site._id).to.equal(stubValue._id);
      expect(site.name).to.equal(stubValue.name);
      expect(site.generated_name).to.equal(stubValue.generated_name);
      expect(site.formatted_name).to.equal(stubValue.formatted_name);
      expect(site.createdAt).to.equal(stubValue.createdAt);
      expect(site.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("filter users", function () {
    it("should retrieve a Site that matches the provided ID", async function () {
      const stub = sinon
        .stub(CandidateModel(stubValue.tenant), "list")
        .returns(stubValue);

      let filter = { lat_long: stubValue.lat_long };

      const site = await generateFilterUtil.getSite(stubValue.tenant, filter);
      expect(stub.calledOnce).to.be.true;
      expect(site._id).to.equal(stubValue._id);
      expect(site.name).to.equal(stubValue.name);
      expect(site.generated_name).to.equal(stubValue.generated_name);
      expect(site.formatted_name).to.equal(stubValue.formatted_name);
      expect(site.createdAt).to.equal(stubValue.createdAt);
      expect(site.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("filter defaults", function () {
    it("should update the Site and return the updated details", async function () {
      const stub = sinon
        .stub(CandidateModel(stubValue.tenant), "update")
        .returns(stubValue);

      let body = stubValue;
      delete body.lat_long;

      const updatedSite = await generateFilterUtil.updateSite(
        stubValue.tenant,
        stubValue.lat_long,
        body
      );

      expect(stub.calledOnce).to.be.true;
      expect(updatedSite).to.not.be.empty;
      expect(updatedSite).to.be.a("object");
    });
  });
});
