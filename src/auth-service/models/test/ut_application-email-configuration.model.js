require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const ApplicationEmailConfigurationModel = require("@models/ApplicationEmailConfiguration");

describe("ApplicationEmailConfigurationSchema - Statics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("Static Method: register", () => {
    it("should insert a new document for the first configuration", async () => {
      const args = {
        applicationEmails: ["app1@airqo.net"],
        adminCCEmails: "admin1@airqo.net",
      };
      const created = { _id: "id1", ...args };

      const createStub = sinon
        .stub(ApplicationEmailConfigurationModel("airqo"), "create")
        .resolves(created);

      const result = await ApplicationEmailConfigurationModel("airqo").register(args);

      expect(createStub.calledOnce).to.be.true;
      expect(createStub.firstCall.args[0]).to.include({
        adminCCEmails: "admin1@airqo.net",
      });
      expect(result).to.include({
        success: true,
        status: httpStatus.CREATED,
      });
      expect(result.data).to.deep.equal(created);
    });

    it("should insert a second, distinct document rather than merging into the first", async () => {
      const firstArgs = {
        applicationEmails: ["app1@airqo.net"],
        adminCCEmails: "admin1@airqo.net",
      };
      const secondArgs = {
        applicationEmails: ["app2@airqo.net"],
        adminCCEmails: "admin2@airqo.net",
      };
      const firstDoc = { _id: "id1", ...firstArgs };
      const secondDoc = { _id: "id2", ...secondArgs };

      const createStub = sinon.stub(
        ApplicationEmailConfigurationModel("airqo"),
        "create"
      );
      createStub.onCall(0).resolves(firstDoc);
      createStub.onCall(1).resolves(secondDoc);

      const firstResult = await ApplicationEmailConfigurationModel("airqo").register(
        firstArgs
      );
      const secondResult = await ApplicationEmailConfigurationModel("airqo").register(
        secondArgs
      );

      expect(createStub.calledTwice).to.be.true;
      // Each call must insert only the values passed to it -- no merging
      // of the first document's fields into the second's insert payload.
      expect(createStub.secondCall.args[0]).to.not.include({
        adminCCEmails: "admin1@airqo.net",
      });
      expect(firstResult.data._id).to.not.equal(secondResult.data._id);
      expect(firstResult.status).to.equal(httpStatus.CREATED);
      expect(secondResult.status).to.equal(httpStatus.CREATED);
    });

    it("should surface validation errors instead of creating a document", async () => {
      const args = {
        applicationEmails: ["not-an-email"],
        adminCCEmails: "admin1@airqo.net",
      };

      const validationError = {
        errors: {
          applicationEmails: { message: "One or more application emails are invalid" },
        },
      };

      const createStub = sinon
        .stub(ApplicationEmailConfigurationModel("airqo"), "create")
        .rejects(validationError);

      const result = await ApplicationEmailConfigurationModel("airqo").register(args);

      expect(createStub.calledOnce).to.be.true;
      expect(result).to.include({
        success: false,
        status: httpStatus.UNPROCESSABLE_ENTITY,
      });
      expect(result.errors).to.have.property(
        "applicationEmails",
        "One or more application emails are invalid"
      );
    });
  });
});
