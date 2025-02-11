require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const request = require("supertest");
const activityController = require("@controllers/create-activity");

const app = express();
app.use(express.json());

/*************************** Mocked Data ***************************/
const mockedActivity = {
  _id: "60f01365c24d4f21a0e066a2",
  deviceName: "Mocked Device",
  recallType: "type1",
  firstName: "John",
  lastName: "Doe",
  userName: "john_doe",
  email: "john@example.com",
};

/*************************** Unit Test ***************************/
describe("Activity Controller", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("POST /activities/recall", () => {
    it("should create a new recall activity", async () => {
      const createRecallStub = sinon.stub(activityController, "recall");
      createRecallStub.resolves(mockedActivity);

      const newRecallActivity = {
        deviceName: "Test Device",
        recallType: "type1",
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
      };

      const response = await request(app)
        .post("/activities/recall")
        .query({ tenant: "test" })
        .send(newRecallActivity);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(mockedActivity);
      expect(createRecallStub.calledOnce).to.be.true;
      expect(createRecallStub.firstCall.args[0]).to.deep.equal(
        newRecallActivity
      );
    });
  });

  describe("POST /activities/deploy", () => {
    it("should create a new deploy activity", async () => {
      const createDeployStub = sinon.stub(activityController, "deploy");
      createDeployStub.resolves(mockedActivity);

      const newDeployActivity = {
        deviceName: "Test Device",
        powerType: "solar",
        mountType: "pole",
        height: 5,
        isPrimaryInLocation: true,
        site_id: "60f01365c24d4f21a0e066a2",
        date: "2023-07-25T12:00:00Z",
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
      };

      const response = await request(app)
        .post("/activities/deploy")
        .query({ tenant: "test" })
        .send(newDeployActivity);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(mockedActivity);
      expect(createDeployStub.calledOnce).to.be.true;
      expect(createDeployStub.firstCall.args[0]).to.deep.equal(
        newDeployActivity
      );
    });
  });

  describe("POST /activities/maintain", () => {
    it("should create a new maintain activity", async () => {
      const createMaintainStub = sinon.stub(activityController, "maintain");
      createMaintainStub.resolves(mockedActivity);

      const newMaintainActivity = {
        deviceName: "Test Device",
        maintenanceType: "corrective",
        description: "Maintenance description",
        tags: ["tag1", "tag2"],
        date: "2023-07-25T12:00:00Z",
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
      };

      const response = await request(app)
        .post("/activities/maintain")
        .query({ tenant: "test" })
        .send(newMaintainActivity);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(mockedActivity);
      expect(createMaintainStub.calledOnce).to.be.true;
      expect(createMaintainStub.firstCall.args[0]).to.deep.equal(
        newMaintainActivity
      );
    });
  });

  describe("GET /activities", () => {
    it("should retrieve a list of activities", async () => {
      const listActivitiesStub = sinon.stub(activityController, "list");
      listActivitiesStub.resolves([mockedActivity]);

      const response = await request(app)
        .get("/activities")
        .query({ tenant: "test" });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.deep.equal(mockedActivity);
      expect(listActivitiesStub.calledOnce).to.be.true;
    });
  });

  describe("PUT /activities", () => {
    it("should update an existing activity", async () => {
      const updateActivityStub = sinon.stub(activityController, "update");
      updateActivityStub.resolves(mockedActivity);

      const updatedActivity = {
        deviceName: "Updated Device",
        recallType: "type2",
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
      };

      const response = await request(app)
        .put(`/activities`)
        .query({ tenant: "test", id: mockedActivity._id })
        .send(updatedActivity);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(mockedActivity);
      expect(updateActivityStub.calledOnce).to.be.true;
      expect(updateActivityStub.firstCall.args[0]).to.deep.equal({
        ...updatedActivity,
        _id: mockedActivity._id,
      });
    });
  });

  describe("PUT /activities/bulk", () => {
    it("should bulk update existing activities", async () => {
      const bulkUpdateActivityStub = sinon.stub(
        activityController,
        "bulkUpdate"
      );
      bulkUpdateActivityStub.resolves([mockedActivity]);

      const response = await request(app)
        .put(`/activities/bulk`)
        .query({ tenant: "test", id: mockedActivity._id });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.deep.equal(mockedActivity);
      expect(bulkUpdateActivityStub.calledOnce).to.be.true;
      expect(bulkUpdateActivityStub.firstCall.args[0]).to.deep.equal({
        id: mockedActivity._id,
      });
    });
  });

  describe("POST /activities/bulk", () => {
    it("should bulk add new activities", async () => {
      const bulkAddActivityStub = sinon.stub(activityController, "bulkAdd");
      bulkAddActivityStub.resolves([mockedActivity]);

      const response = await request(app)
        .post(`/activities/bulk`)
        .query({ tenant: "test", id: mockedActivity._id });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.deep.equal(mockedActivity);
      expect(bulkAddActivityStub.calledOnce).to.be.true;
      expect(bulkAddActivityStub.firstCall.args[0]).to.deep.equal({
        id: mockedActivity._id,
      });
    });
  });

  describe("DELETE /activities", () => {
    it("should delete an existing activity", async () => {
      const deleteActivityStub = sinon.stub(activityController, "delete");
      deleteActivityStub.resolves(mockedActivity);

      const response = await request(app)
        .delete(`/activities`)
        .query({ tenant: "test", id: mockedActivity._id });

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(mockedActivity);
      expect(deleteActivityStub.calledOnce).to.be.true;
      expect(deleteActivityStub.firstCall.args[0]).to.deep.equal({
        id: mockedActivity._id,
      });
    });
  });
});
