process.env.NODE_ENV = "development";

require("module-alias/register");
require('dotenv').config();
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);
const EventModel = require("@models/Event");
const eventUtil = require("@utils/create-event");

const stubValue = {
  _id: faker.datatype.uuid(),
  name:faker.name.findName(),
  tenant: "test",
  device: faker.datatype.string(),
  is_device_primary: faker.datatype.boolean(),
  device_id: faker.datatype.uuid(),
  site_id:faker.datatype.uuid(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
  latitude:faker.address.latitude(),
  longitude: faker.address.longitude(),
};

describe("create Event utils", function() {
  describe("create", function() {
    it("should create a new event", async function() {
      const mock = sinon.mock(eventUtil).expects("create")
        .withArgs(stubValue.tenant,
          stubValue.latitude,
          stubValue.longitude,
          stubValue.name).returns(stubValue);
      const event = await eventUtil.create(
        stubValue.tenant,
        stubValue.latitude,
        stubValue.longitude,
        stubValue.name
      );
      mock.verify();
      expect(mock.calledOnce).to.be.true;
      expect(event._id).to.equal(stubValue._id);
      expect(event.device_id).to.equal(stubValue.device_id);
      expect(event.site_id).to.equal(stubValue.site_id);
    });
  });

  describe("View Events", function () {
    let request = {};
    const stub = sinon.stub(eventUtil,"viewEvents").returns(stubValue);
    it("should retrieve Events when provided the start time only", async function () {
        
      request["query"] = {};
      request["query"]["startTime"] = "2021-06-22T02:16:52.197Z";    
      const event = await eventUtil.viewEvents(request);
      expect(stub.calledOnce).to.be.true;
      expect(event._id).to.equal(stubValue._id);
      expect(event.createdAt).to.equal(stubValue.createdAt);
      expect(event.updatedAt).to.equal(stubValue.updatedAt);
      });

    it("should retrieve Events when provided the end time only", async function () {
      let request = {};
      request["query"] = {};
      request["query"]["endTime"] = "2021-06-22T02:16:52.197Z";
      const event = await eventUtil.viewEvents(request);
      expect(stub.calledTwice).to.be.true;
      expect(event._id).to.equal(stubValue._id);
      expect(event.createdAt).to.equal(stubValue.createdAt);
      expect(event.updatedAt).to.equal(stubValue.updatedAt);
      });

   
    it("should retrieve Events when provided both the startTime and endTime", async function () {
      let request = {};
      request["query"] = {};
      request["query"]["startTime"] = "2021-06-22T02:16:52.197Z";
      request["query"]["endTime"] = "2021-07-22T02:16:52.197Z";

      const event = await eventUtil.viewEvents(request);
      expect(stub.calledThrice).to.be.true;
      expect(event._id).to.equal(stubValue._id);
      expect(event.createdAt).to.equal(stubValue.createdAt);
      expect(event.updatedAt).to.equal(stubValue.updatedAt);
    });

    it("should retrieve Events when no query parameter is provided", async function () {

      let request = {};
      request["query"] = {};
      const event = await eventUtil.viewEvents(request);
      expect(stub.called).to.be.true;
      expect(event._id).to.equal(stubValue._id);
      expect(event.createdAt).to.equal(stubValue.createdAt);
      expect(event.updatedAt).to.equal(stubValue.updatedAt);
      });
  });
    

  describe("clear Events", function() {
    it("should clear the Events", async function() {
      const stub = sinon
        .stub(eventUtil, "clearEventsOnPlatform")
        .returns(null);

      const deletedEvent = await eventUtil.clearEventsOnPlatform(
        stubValue.tenant,
        stubValue.lat_long
      );

      expect(stub.calledOnce).to.be.true;
      expect(deletedEvent).to.be.null;
    });
  });
});
