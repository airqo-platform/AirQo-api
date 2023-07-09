require("module-alias/register");
process.env.NODE_ENV = "development";

const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);
const EventModel = require("../../models/Event");
const eventUtil = require("../create-event");

const stubValue = {
  _id: faker.datatype.uuid(),
  tenant: "test",
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
};

describe("create Event utils", function() {
  describe("create", function() {
    it("should create a new event", async function() {
      const stub = sinon
        .stub(EventModel(stubValue.tenant), "create")
        .returns(stubValue);

      const event = await eventUtil.createEvent(
        stubValue.tenant,
        stubValue.latitude,
        stubValue.longitude,
        stubValue.name
      );

      expect(stub.calledOnce).to.be.true;
      expect(event._id).to.equal(stubValue._id);
      expect(event.createdAt).to.equal(stubValue.createdAt);
      expect(event.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("clear Events", function() {
    it("should clear the Events", async function() {
      const stub = sinon
        .stub(EventModel(stubValue.tenant), "delete")
        .returns(stubValue);

      const deletedEvent = await eventUtil.clearEventsOnPlatform(
        stubValue.tenant,
        stubValue.lat_long
      );

      expect(stub.calledOnce).to.be.true;
      expect(deletedEvent).to.not.be.empty;
      expect(deletedEvent).to.be.a("object");
      assert.equal(deletedEvent.success, true, "the event has been deleted");
    });
  });
});
