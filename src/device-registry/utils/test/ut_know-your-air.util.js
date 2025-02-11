require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const { expect } = chai;
chai.use(chaiAsPromised);
const httpStatus = require("http-status");
const createKnowYourAir = require("@utils/create-know-your-air");

describe("createKnowYourAir Utility Functions", () => {
  describe("KnowYourAirLessonModel", () => {
    it("should return a model instance for a valid tenant", () => {
      // Your test logic here
    });

    it("should return a model instance for an invalid tenant", () => {
      // Your test logic here
    });
  });

  /*************** lessons *******************************/
  describe("listLesson()", () => {
    it("should return a list of lessons", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { user_id: "user-id" },
        query: { limit: 10, skip: 0 },
      };

      // Stub KnowYourAirLessonModel.list
      const listStub = sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "list")
        .resolves({ success: true, data: [], status: httpStatus.OK });

      const result = await createKnowYourAir.listLesson(request);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal([]);
      expect(result.status).to.equal(httpStatus.OK);

      // Restore the stub
      listStub.restore();
    });

    it("should return a list of translated lessons successfully", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { user_id: "user-id" },
        query: { limit: 10, skip: 0, language: "fr" },
      };

      // Stub KnowYourAirLessonModel.list
      const listStub = sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "list")
        .resolves({ success: true, data: [], status: httpStatus.OK });

      const result = await createKnowYourAir.listLesson(request);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal([]);
      expect(result.status).to.equal(httpStatus.OK);

      // Restore the stub
      listStub.restore();
    });

    it("should handle filter failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { user_id: "user-id" },
        query: { limit: 10, skip: 0 },
      };

      // Stub generateFilter.kyalessons to return a failure
      sinon.stub(generateFilter, "kyalessons").returns({ success: false });

      const result = await createKnowYourAir.listLesson(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      generateFilter.kyalessons.restore();
    });

    it("should handle errors", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { user_id: "user-id" },
        query: { limit: 10, skip: 0 },
      };

      // Stub KnowYourAirLessonModel.list to throw an error
      sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "list")
        .throws(new Error("Some error"));

      const result = await createKnowYourAir.listLesson(request);

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      // Your other assertions here

      // Restore the stub
      KnowYourAirLessonModel("your-tenant").list.restore();
    });
  });
  describe("deleteLesson()", () => {
    it("should delete a lesson", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body here */
        },
      };

      // Stub generateFilter.kyalessons to return a valid filter
      sinon.stub(generateFilter, "kyalessons").returns({
        /* filter data here */
      });

      // Stub KnowYourAirLessonModel.remove to return a success
      const removeStub = sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "remove")
        .resolves({ success: true, status: httpStatus.OK });

      const result = await createKnowYourAir.deleteLesson(request);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyalessons.restore();
      KnowYourAirLessonModel("your-tenant").remove.restore();
    });

    it("should handle filter failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body here */
        },
      };

      // Stub generateFilter.kyalessons to return a failure
      sinon.stub(generateFilter, "kyalessons").returns({ success: false });

      const result = await createKnowYourAir.deleteLesson(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      generateFilter.kyalessons.restore();
    });

    it("should handle errors", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body here */
        },
      };

      // Stub generateFilter.kyalessons to return a valid filter
      sinon.stub(generateFilter, "kyalessons").returns({
        /* filter data here */
      });

      // Stub KnowYourAirLessonModel.remove to throw an error
      sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "remove")
        .throws(new Error("Some error"));

      const result = await createKnowYourAir.deleteLesson(request);

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyalessons.restore();
      KnowYourAirLessonModel("your-tenant").remove.restore();
    });
  });
  describe("updateLesson()", () => {
    it("should update a lesson", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body here */
        },
      };

      // Stub generateFilter.kyalessons to return a valid filter
      sinon.stub(generateFilter, "kyalessons").returns({
        /* filter data here */
      });

      // Stub KnowYourAirLessonModel.modify to return a success
      const modifyStub = sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "modify")
        .resolves({ success: true, status: httpStatus.OK });

      const result = await createKnowYourAir.updateLesson(request);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyalessons.restore();
      KnowYourAirLessonModel("your-tenant").modify.restore();
    });

    it("should handle filter failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body here */
        },
      };

      // Stub generateFilter.kyalessons to return a failure
      sinon.stub(generateFilter, "kyalessons").returns({ success: false });

      const result = await createKnowYourAir.updateLesson(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      generateFilter.kyalessons.restore();
    });

    it("should handle errors", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body here */
        },
      };

      // Stub generateFilter.kyalessons to return a valid filter
      sinon.stub(generateFilter, "kyalessons").returns({
        /* filter data here */
      });

      // Stub KnowYourAirLessonModel.modify to throw an error
      sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "modify")
        .throws(new Error("Some error"));

      const result = await createKnowYourAir.updateLesson(request);

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyalessons.restore();
      KnowYourAirLessonModel("your-tenant").modify.restore();
    });
  });
  describe("createLesson()", () => {
    it("should create a lesson and send a Kafka message", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body here */
        },
      };

      // Stub KnowYourAirLessonModel.register to return a success response
      const registerStub = sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "register")
        .resolves({
          success: true,
          data: {
            /* lesson data here */
          },
        });

      // Stub Kafka producer methods to return successful responses
      const kafkaProducerStub = sinon
        .stub(kafka.producer(), ["connect", "send", "disconnect"])
        .resolves();

      const result = await createKnowYourAir.createLesson(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel("your-tenant").register.restore();
      kafka.producer().connect.restore();
      kafka.producer().send.restore();
      kafka.producer().disconnect.restore();
    });

    it("should handle lesson registration failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body here */
        },
      };

      // Stub KnowYourAirLessonModel.register to return a failure response
      const registerStub = sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "register")
        .resolves({ success: false });

      const result = await createKnowYourAir.createLesson(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      KnowYourAirLessonModel("your-tenant").register.restore();
    });

    it("should handle lesson registration error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body here */
        },
      };

      // Stub KnowYourAirLessonModel.register to throw an error
      const registerStub = sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "register")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.createLesson(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel("your-tenant").register.restore();
      logger.error.restore();
    });
  });
  describe("listAvailableTasks()", () => {
    it("should list available tasks for a lesson", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { lesson_id: "lesson-id" },
      };

      // Stub KnowYourAirLessonModel.findById to return a lesson
      const lessonStub = sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "findById")
        .resolves({ _id: "lesson-id" });

      // Stub KnowYourAirTaskModel.aggregate to return available tasks
      const taskAggregateStub = sinon
        .stub(KnowYourAirTaskModel("your-tenant"), "aggregate")
        .resolves([
          /* available tasks array here */
        ]);

      const result = await createKnowYourAir.listAvailableTasks(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel("your-tenant").findById.restore();
      KnowYourAirTaskModel("your-tenant").aggregate.restore();
    });

    it("should handle invalid lesson ID", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { lesson_id: "invalid-id" },
      };

      // Stub KnowYourAirLessonModel.findById to return null
      const lessonStub = sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "findById")
        .resolves(null);

      const result = await createKnowYourAir.listAvailableTasks(request);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      // Your other assertions here

      // Restore the stub
      KnowYourAirLessonModel("your-tenant").findById.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { lesson_id: "lesson-id" },
      };

      // Stub KnowYourAirLessonModel.findById to return a lesson
      const lessonStub = sinon
        .stub(KnowYourAirLessonModel("your-tenant"), "findById")
        .resolves({ _id: "lesson-id" });

      // Stub KnowYourAirTaskModel.aggregate to throw an error
      const taskAggregateStub = sinon
        .stub(KnowYourAirTaskModel("your-tenant"), "aggregate")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.listAvailableTasks(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel("your-tenant").findById.restore();
      KnowYourAirTaskModel("your-tenant").aggregate.restore();
      logger.error.restore();
    });
  });
  describe("listAssignedTasks()", () => {
    it("should list assigned tasks for a lesson", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const lessonData = {
        /* your lesson data */
      };

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves(lessonData);

      // Stub KnowYourAirTaskModel(tenant).aggregate to resolve successfully
      const aggregateStub = sinon
        .stub(KnowYourAirTaskModel, "aggregate")
        .resolves([
          ,/* task 1 data */
        /* task 2 data */
        ]);

      const result = await createKnowYourAir.listAssignedTasks({
        params: { lesson_id },
        query: { tenant },
      });

      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array")
        .lengthOf(2);
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.aggregate.restore();
    });

    it("should handle not found lesson", async () => {
      const tenant = "your-tenant";
      const lesson_id = "non-existent-lesson-id";

      // Stub KnowYourAirLessonModel(tenant).findById to return null
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves(null);

      const result = await createKnowYourAir.listAssignedTasks({
        params: { lesson_id },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const lessonData = {
        /* your lesson data */
      };

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves(lessonData);

      // Stub KnowYourAirTaskModel(tenant).aggregate to throw an error
      const aggregateStub = sinon
        .stub(KnowYourAirTaskModel, "aggregate")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.listAssignedTasks({
        params: { lesson_id },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.aggregate.restore();
      logger.error.restore();
    });
  });

  /******************* tracking user progress ***************** */
  describe("listUserQuizProgres()", () => {
    it("should list user quiz progress", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: {
          /* user_id */
        },
        query: { limit: 10, skip: 0 }, // Set the limit and skip values as needed
      };

      // Stub generateFilter.kyaprogress to return a successful response
      const filterStub = sinon.stub(generateFilter, "kyaprogress").returns({
        /* filter data */
      });

      // Stub KnowYourAirUserQuizProgressModel(tenant).list to return a successful response
      const userQuizProgressListStub = sinon
        .stub(KnowYourAirUserQuizProgressModel("your-tenant"), "list")
        .resolves({ success: true /* other response properties */ });

      const result = await createKnowYourAir.listUserQuizProgress(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaprogress.restore();
      KnowYourAirUserQuizProgressModel("your-tenant").list.restore();
    });

    it("should handle a filter failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: {
          /* user_id */
        },
        query: { limit: 10, skip: 0 }, // Set the limit and skip values as needed
      };

      // Stub generateFilter.kyaprogress to return a failed response
      const filterStub = sinon
        .stub(generateFilter, "kyaprogress")
        .returns({ success: false /* other response properties */ });

      const result = await createKnowYourAir.listUserQuizProgress(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      generateFilter.kyaprogress.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: {
          /* user_id */
        },
        query: { limit: 10, skip: 0 }, // Set the limit and skip values as needed
      };

      // Stub generateFilter.kyaprogress to return a successful response
      const filterStub = sinon.stub(generateFilter, "kyaprogress").returns({
        /* filter data */
      });

      // Stub KnowYourAirUserQuizProgressModel(tenant).list to throw an error
      const userQuizProgressListStub = sinon
        .stub(KnowYourAirUserQuizProgressModel("your-tenant"), "list")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.listUserQuizProgress(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaprogress.restore();
      KnowYourAirUserQuizProgressModel("your-tenant").list.restore();
      logger.error.restore();
    });
  });
  describe("deleteUserQuizProgress()", () => {
    it("should delete user quiz progress", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaprogress to return a successful response
      const filterStub = sinon.stub(generateFilter, "kyaprogress").returns({
        /* filter data */
      });

      // Stub KnowYourAirUserQuizProgressModel(tenant).remove to return a successful response
      const deleteUserQuizProgressStub = sinon
        .stub(KnowYourAirUserQuizProgressModel("your-tenant"), "remove")
        .resolves({ success: true /* other response properties */ });

      const result = await createKnowYourAir.deleteUserQuizProgress(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaprogress.restore();
      KnowYourAirUserQuizProgressModel("your-tenant").remove.restore();
    });

    it("should handle a filter failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaprogress to return a failed response
      const filterStub = sinon
        .stub(generateFilter, "kyaprogress")
        .returns({ success: false /* other response properties */ });

      const result = await createKnowYourAir.deleteUserQuizProgress(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      generateFilter.kyaprogress.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaprogress to return a successful response
      const filterStub = sinon.stub(generateFilter, "kyaprogress").returns({
        /* filter data */
      });

      // Stub KnowYourAirUserQuizProgressModel(tenant).remove to throw an error
      const deleteUserQuizProgressStub = sinon
        .stub(KnowYourAirUserQuizProgressModel("your-tenant"), "remove")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.deleteUserQuizProgress(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaprogress.restore();
      KnowYourAirUserQuizProgressModel("your-tenant").remove.restore();
      logger.error.restore();
    });
  });
  describe("updateUserQuizProgress()", () => {
    it("should update user quiz progress", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* update data */
        },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaprogress to return a successful response
      const filterStub = sinon.stub(generateFilter, "kyaprogress").returns({
        /* filter data */
      });

      // Stub KnowYourAirUserQuizProgressModel(tenant).modify to return a successful response
      const updateUserQuizProgressStub = sinon
        .stub(KnowYourAirUserQuizProgressModel("your-tenant"), "modify")
        .resolves({ success: true /* other response properties */ });

      const result = await createKnowYourAir.updateUserQuizProgress(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaprogress.restore();
      KnowYourAirUserQuizProgressModel("your-tenant").modify.restore();
    });

    it("should handle a filter failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* update data */
        },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaprogress to return a failed response
      const filterStub = sinon
        .stub(generateFilter, "kyaprogress")
        .returns({ success: false /* other response properties */ });

      const result = await createKnowYourAir.updateUserQuizProgress(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      generateFilter.kyaprogress.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* update data */
        },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaprogress to return a successful response
      const filterStub = sinon.stub(generateFilter, "kyaprogress").returns({
        /* filter data */
      });

      // Stub KnowYourAirUserQuizProgressModel(tenant).modify to throw an error
      const updateUserQuizProgressStub = sinon
        .stub(KnowYourAirUserQuizProgressModel("your-tenant"), "modify")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.updateUserQuizProgress(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaprogress.restore();
      KnowYourAirUserQuizProgressModel("your-tenant").modify.restore();
      logger.error.restore();
    });
  });
  describe("createUserQuizProgress()", () => {
    it("should create user quiz progress", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body data */
        },
        /* Other request properties as needed */
      };

      // Stub KnowYourAirUserQuizProgressModel(tenant).register to return a successful response
      const createUserQuizProgressStub = sinon
        .stub(KnowYourAirUserQuizProgressModel("your-tenant"), "register")
        .resolves({ success: true /* other response properties */ });

      const result = await createKnowYourAir.createUserQuizProgress(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stub
      KnowYourAirUserQuizProgressModel("your-tenant").register.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* request body data */
        },
        /* Other request properties as needed */
      };

      // Stub KnowYourAirUserQuizProgressModel(tenant).register to throw an error
      const createUserQuizProgressStub = sinon
        .stub(KnowYourAirUserQuizProgressModel("your-tenant"), "register")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.createUserQuizProgress(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirUserQuizProgressModel("your-tenant").register.restore();
      logger.error.restore();
    });
  });
  describe("syncUserQuizProgress()", () => {
    it("should sync user quiz progress", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { user_id: "user-id" },
        body: {
          kya_quiz_user_progress: [
            /* array of progress data */
          ],
        },
        /* Other request properties as needed */
      };

      // Stub createKnowYourAir.listUserQuizProgress to return a successful response
      const listUserQuizProgressStub = sinon
        .stub(createKnowYourAir, "listUserQuizProgress")
        .resolves({ success: true, data: "" });

      // Stub createKnowYourAir.createUserQuizProgress and createKnowYourAir.updateUserQuizProgress to return a successful response
      const createUserQuizProgressStub = sinon
        .stub(createKnowYourAir, "createUserQuizProgress")
        .resolves({ success: true /* other response properties */ });
      const updateUserQuizProgressStub = sinon
        .stub(createKnowYourAir, "updateUserQuizProgress")
        .resolves({ success: true /* other response properties */ });

      const result = await createKnowYourAir.syncUserQuizProgress(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      createKnowYourAir.listUserQuizProgress.restore();
      createKnowYourAir.createUserQuizProgress.restore();
      createKnowYourAir.updateUserQuizProgress.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { user_id: "user-id" },
        body: {
          kya_quiz_user_progress: [
            /* array of progress data */
          ],
        },
        /* Other request properties as needed */
      };

      // Stub createKnowYourAir.listUserQuizProgress to throw an error
      const listUserQuizProgressStub = sinon
        .stub(createKnowYourAir, "listUserQuizProgress")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.syncUserQuizProgress(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      createKnowYourAir.listUserQuizProgress.restore();
      logger.error.restore();
    });
  });

  /******************* tasks *******************************/
  describe("listTask()", () => {
    it("should list tasks", async () => {
      const tenant = "your-tenant";

      // Stub generateFilter.kyatasks to return a mock filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyatasks")
        .returns({ success: true });

      // Stub KnowYourAirTaskModel(tenant).list to return mock task data
      const listTaskStub = sinon.stub(KnowYourAirTaskModel, "list").resolves({
        /* Mock task data */
      });

      const result = await createKnowYourAir.listTask({
        query: { tenant },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyatasks.restore();
      KnowYourAirTaskModel.list.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";

      // Stub generateFilter.kyatasks to return a mock filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyatasks")
        .returns({ success: true });

      // Stub KnowYourAirTaskModel(tenant).list to throw an error
      const listTaskStub = sinon
        .stub(KnowYourAirTaskModel, "list")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.listTask({
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyatasks.restore();
      KnowYourAirTaskModel.list.restore();
      logger.error.restore();
    });
  });
  describe("deleteTask()", () => {
    it("should delete a task", async () => {
      const tenant = "your-tenant";

      // Stub generateFilter.kyatasks to return a mock filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyatasks")
        .returns({ success: true });

      // Stub KnowYourAirTaskModel(tenant).remove to resolve with success data
      const removeTaskStub = sinon
        .stub(KnowYourAirTaskModel, "remove")
        .resolves({ success: true });

      const result = await createKnowYourAir.deleteTask({
        query: { tenant },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyatasks.restore();
      KnowYourAirTaskModel.remove.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";

      // Stub generateFilter.kyatasks to return a mock filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyatasks")
        .returns({ success: true });

      // Stub KnowYourAirTaskModel(tenant).remove to throw an error
      const removeTaskStub = sinon
        .stub(KnowYourAirTaskModel, "remove")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.deleteTask({
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyatasks.restore();
      KnowYourAirTaskModel.remove.restore();
      logger.error.restore();
    });
  });
  describe("updateTask()", () => {
    it("should update a task", async () => {
      const tenant = "your-tenant";
      const requestBody = {
        /* your update data */
      };

      // Stub generateFilter.kyatasks to return a mock filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyatasks")
        .returns({ success: true });

      // Stub KnowYourAirTaskModel(tenant).modify to resolve with updated data
      const modifyTaskStub = sinon
        .stub(KnowYourAirTaskModel, "modify")
        .resolves({
          success: true,
          data: {
            /* updated data */
          },
        });

      const result = await createKnowYourAir.updateTask({
        query: { tenant },
        body: requestBody,
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyatasks.restore();
      KnowYourAirTaskModel.modify.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const requestBody = {
        /* your update data */
      };

      // Stub generateFilter.kyatasks to return a mock filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyatasks")
        .returns({ success: true });

      // Stub KnowYourAirTaskModel(tenant).modify to throw an error
      const modifyTaskStub = sinon
        .stub(KnowYourAirTaskModel, "modify")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.updateTask({
        query: { tenant },
        body: requestBody,
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyatasks.restore();
      KnowYourAirTaskModel.modify.restore();
      logger.error.restore();
    });
  });
  describe("createTask()", () => {
    it("should create a task and send a Kafka message", async () => {
      const tenant = "your-tenant";
      const requestBody = {
        /* your task data */
      };

      // Stub KnowYourAirTaskModel(tenant).register to resolve with response data
      const registerTaskStub = sinon
        .stub(KnowYourAirTaskModel, "register")
        .resolves({
          success: true,
          data: {
            /* your response data */
          },
        });

      // Stub kafka.producer to resolve successfully
      const kafkaProducerStub = sinon.stub(kafka, "producer").returnsThis();
      kafkaProducerStub.returnsThis();
      kafkaProducerStub
        .withArgs({ groupId: constants.UNIQUE_PRODUCER_GROUP })
        .returnsThis();
      kafkaProducerStub.prototype.connect = sinon.stub().resolves();
      kafkaProducerStub.prototype.send = sinon.stub().resolves();
      kafkaProducerStub.prototype.disconnect = sinon.stub().resolves();

      const result = await createKnowYourAir.createTask({
        query: { tenant },
        body: requestBody,
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirTaskModel.register.restore();
      kafka.producer.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const requestBody = {
        /* your task data */
      };

      // Stub KnowYourAirTaskModel(tenant).register to throw an error
      const registerTaskStub = sinon
        .stub(KnowYourAirTaskModel, "register")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.createTask({
        query: { tenant },
        body: requestBody,
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirTaskModel.register.restore();
      logger.error.restore();
    });
  });

  /******************* manage lessons *******************************/
  describe("assignTaskToLesson()", () => {
    it("should assign a task to a lesson", async () => {
      const tenant = "your-tenant";
      const task_id = "your-task-id";
      const lesson_id = "your-lesson-id";

      // Stub KnowYourAirTaskModel(tenant).exists and .findByIdAndUpdate to resolve successfully
      const taskExistsStub = sinon
        .stub(KnowYourAirTaskModel, "exists")
        .resolves(true);
      const lessonExistsStub = sinon
        .stub(KnowYourAirLessonModel, "exists")
        .resolves(true);
      const findByIdAndUpdateStub = sinon
        .stub(KnowYourAirTaskModel, "findByIdAndUpdate")
        .resolves({
          /* your updated task data */
        });

      const result = await createKnowYourAir.assignTaskToLesson({
        params: { task_id, lesson_id },
        query: { tenant },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirTaskModel.exists.restore();
      KnowYourAirLessonModel.exists.restore();
      KnowYourAirTaskModel.findByIdAndUpdate.restore();
    });

    it("should handle not found task or lesson", async () => {
      const tenant = "your-tenant";
      const task_id = "non-existent-task-id";
      const lesson_id = "your-lesson-id";

      // Stub KnowYourAirTaskModel(tenant).exists and .findByIdAndUpdate to resolve successfully
      const taskExistsStub = sinon
        .stub(KnowYourAirTaskModel, "exists")
        .resolves(false);
      const lessonExistsStub = sinon
        .stub(KnowYourAirLessonModel, "exists")
        .resolves(true);

      const result = await createKnowYourAir.assignTaskToLesson({
        params: { task_id, lesson_id },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirTaskModel.exists.restore();
      KnowYourAirLessonModel.exists.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const task_id = "your-task-id";
      const lesson_id = "your-lesson-id";

      // Stub KnowYourAirTaskModel(tenant).exists to throw an error
      const taskExistsStub = sinon
        .stub(KnowYourAirTaskModel, "exists")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.assignTaskToLesson({
        params: { task_id, lesson_id },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirTaskModel.exists.restore();
      logger.error.restore();
    });
  });
  describe("assignManyTasksToLesson()", () => {
    it("should assign many tasks to a lesson", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const task_ids = ["task-id-1", "task-id-2"];

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonExistsStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves({
          /* your lesson data */
        });

      // Stub KnowYourAirTaskModel(tenant).findById and .updateMany to resolve successfully
      const taskFindByIdStub = sinon
        .stub(KnowYourAirTaskModel, "findById")
        .resolves({
          /* your task data */
        });
      const updateManyStub = sinon
        .stub(KnowYourAirTaskModel, "updateMany")
        .resolves({ nModified: task_ids.length });

      const result = await createKnowYourAir.assignManyTasksToLesson({
        params: { lesson_id },
        body: { task_ids },
        query: { tenant },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.findById.restore();
      KnowYourAirTaskModel.updateMany.restore();
    });

    it("should handle not found lesson", async () => {
      const tenant = "your-tenant";
      const lesson_id = "non-existent-lesson-id";
      const task_ids = ["task-id-1", "task-id-2"];

      // Stub KnowYourAirLessonModel(tenant).findById to return null
      const lessonExistsStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves(null);

      const result = await createKnowYourAir.assignManyTasksToLesson({
        params: { lesson_id },
        body: { task_ids },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const task_ids = ["task-id-1", "task-id-2"];

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonExistsStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves({
          /* your lesson data */
        });

      // Stub KnowYourAirTaskModel(tenant).findById to throw an error
      const taskFindByIdStub = sinon
        .stub(KnowYourAirTaskModel, "findById")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.assignManyTasksToLesson({
        params: { lesson_id },
        body: { task_ids },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.findById.restore();
      logger.error.restore();
    });
  });
  describe("removeTaskFromLesson()", () => {
    it("should remove a task from a lesson", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const task_id = "your-task-id";

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves({
          /* your lesson data */
        });

      // Stub KnowYourAirTaskModel(tenant).findById and .findByIdAndUpdate to resolve successfully
      const taskFindByIdStub = sinon
        .stub(KnowYourAirTaskModel, "findById")
        .resolves({
          /* your task data */
        });
      const findByIdAndUpdateStub = sinon
        .stub(KnowYourAirTaskModel, "findByIdAndUpdate")
        .resolves({
          /* updated task data */
        });

      const result = await createKnowYourAir.removeTaskFromLesson({
        params: { lesson_id, task_id },
        query: { tenant },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.findById.restore();
      KnowYourAirTaskModel.findByIdAndUpdate.restore();
    });

    it("should handle not found lesson", async () => {
      const tenant = "your-tenant";
      const lesson_id = "non-existent-lesson-id";
      const task_id = "your-task-id";

      // Stub KnowYourAirLessonModel(tenant).findById to return null
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves(null);

      const result = await createKnowYourAir.removeTaskFromLesson({
        params: { lesson_id, task_id },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
    });

    it("should handle not found task", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const task_id = "non-existent-task-id";

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves({
          /* your lesson data */
        });

      // Stub KnowYourAirTaskModel(tenant).findById to return null
      const taskFindByIdStub = sinon
        .stub(KnowYourAirTaskModel, "findById")
        .resolves(null);

      const result = await createKnowYourAir.removeTaskFromLesson({
        params: { lesson_id, task_id },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.findById.restore();
    });

    it("should handle a task not assigned to lesson", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const task_id = "your-task-id";

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves({
          /* your lesson data */
        });

      // Stub KnowYourAirTaskModel(tenant).findById to resolve successfully with a task that is not assigned to the lesson
      const taskFindByIdStub = sinon
        .stub(KnowYourAirTaskModel, "findById")
        .resolves({
          /* your task data without lesson assignment */
        });

      const result = await createKnowYourAir.removeTaskFromLesson({
        params: { lesson_id, task_id },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.findById.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const task_id = "your-task-id";

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves({
          /* your lesson data */
        });

      // Stub KnowYourAirTaskModel(tenant).findById and .findByIdAndUpdate to throw an error
      const taskFindByIdStub = sinon
        .stub(KnowYourAirTaskModel, "findById")
        .throws(new Error("Some error"));
      const findByIdAndUpdateStub = sinon
        .stub(KnowYourAirTaskModel, "findByIdAndUpdate")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.removeTaskFromLesson({
        params: { lesson_id, task_id },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.findById.restore();
      KnowYourAirTaskModel.findByIdAndUpdate.restore();
      logger.error.restore();
    });
  });
  describe("removeManyTasksFromLesson()", () => {
    it("should remove many tasks from a lesson", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const task_ids = ["task-id-1", "task-id-2", "task-id-3"];

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves({
          /* your lesson data */
        });

      // Stub KnowYourAirTaskModel(tenant).find, .updateMany, and .countDocuments to resolve successfully
      const taskFindStub = sinon.stub(KnowYourAirTaskModel, "find").resolves([
        {
          /* task 1 data */
        },
        {
          /* task 2 data */
        },
        {
          /* task 3 data */
        },
      ]);
      const updateManyStub = sinon
        .stub(KnowYourAirTaskModel, "updateMany")
        .resolves({ nModified: 3 });
      const countDocumentsStub = sinon
        .stub(KnowYourAirTaskModel, "countDocuments")
        .resolves(3);

      const result = await createKnowYourAir.removeManyTasksFromLesson({
        params: { lesson_id },
        body: { task_ids },
        query: { tenant },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.find.restore();
      KnowYourAirTaskModel.updateMany.restore();
      KnowYourAirTaskModel.countDocuments.restore();
    });

    it("should handle not found lesson", async () => {
      const tenant = "your-tenant";
      const lesson_id = "non-existent-lesson-id";
      const task_ids = ["task-id-1", "task-id-2", "task-id-3"];

      // Stub KnowYourAirLessonModel(tenant).findById to return null
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves(null);

      const result = await createKnowYourAir.removeManyTasksFromLesson({
        params: { lesson_id },
        body: { task_ids },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
    });

    it("should handle non-existent tasks", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const task_ids = ["non-existent-task-id"];

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves({
          /* your lesson data */
        });

      // Stub KnowYourAirTaskModel(tenant).find to resolve with an empty array
      const taskFindStub = sinon
        .stub(KnowYourAirTaskModel, "find")
        .resolves([]);

      const result = await createKnowYourAir.removeManyTasksFromLesson({
        params: { lesson_id },
        body: { task_ids },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.find.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const lesson_id = "your-lesson-id";
      const task_ids = ["task-id-1", "task-id-2", "task-id-3"];

      // Stub KnowYourAirLessonModel(tenant).findById to resolve successfully
      const lessonFindByIdStub = sinon
        .stub(KnowYourAirLessonModel, "findById")
        .resolves({
          /* your lesson data */
        });

      // Stub KnowYourAirTaskModel(tenant).find and .updateMany to throw an error
      const taskFindStub = sinon
        .stub(KnowYourAirTaskModel, "find")
        .throws(new Error("Some error"));
      const updateManyStub = sinon
        .stub(KnowYourAirTaskModel, "updateMany")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.removeManyTasksFromLesson({
        params: { lesson_id },
        body: { task_ids },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirLessonModel.findById.restore();
      KnowYourAirTaskModel.find.restore();
      KnowYourAirTaskModel.updateMany.restore();
      logger.error.restore();
    });
  });

  /*************** quizzes *******************************/
  describe("listQuiz()", () => {
    it("should list quizzes", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { user_id: "user-id" },
        query: { limit: 10, skip: 0 },
      };

      // Stub KnowYourAirQuizModel(tenant).list to return quiz data
      const quizListStub = sinon
        .stub(KnowYourAirQuizModel("your-tenant"), "list")
        .resolves({ success: true /* other response properties */ });

      const result = await createKnowYourAir.listQuiz(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stub
      KnowYourAirQuizModel("your-tenant").list.restore();
    });

    it("should list translated quizzes", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { user_id: "user-id" },
        query: { limit: 10, skip: 0, language: "fr" },
      };

      // Stub KnowYourAirQuizModel(tenant).list to return quiz data
      const quizListStub = sinon
        .stub(KnowYourAirQuizModel("your-tenant"), "list")
        .resolves({ success: true /* other response properties */ });

      const result = await createKnowYourAir.listQuiz(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stub
      KnowYourAirQuizModel("your-tenant").list.restore();
    });

    it("should handle filter failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { user_id: "user-id" },
        query: { limit: 10, skip: 0 },
      };

      // Stub generateFilter.kyaquizzes to return filter failure response
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquizzes")
        .returns({ success: false /* other response properties */ });

      const result = await createKnowYourAir.listQuiz(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      generateFilter.kyaquizzes.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { user_id: "user-id" },
        query: { limit: 10, skip: 0 },
      };

      // Stub KnowYourAirQuizModel(tenant).list to throw an error
      const quizListStub = sinon
        .stub(KnowYourAirQuizModel("your-tenant"), "list")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.listQuiz(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuizModel("your-tenant").list.restore();
      logger.error.restore();
    });
  });
  describe("deleteQuiz()", () => {
    it("should delete a quiz", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { quiz_id: "quiz-id" },
      };

      // Stub KnowYourAirQuizModel(tenant).remove to return quiz removal response
      const quizRemoveStub = sinon
        .stub(KnowYourAirQuizModel("your-tenant"), "remove")
        .resolves({ success: true /* other response properties */ });

      const result = await createKnowYourAir.deleteQuiz(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stub
      KnowYourAirQuizModel("your-tenant").remove.restore();
    });

    it("should handle filter failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { quiz_id: "quiz-id" },
      };

      // Stub generateFilter.kyaquizzes to return filter failure response
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquizzes")
        .returns({ success: false /* other response properties */ });

      const result = await createKnowYourAir.deleteQuiz(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      generateFilter.kyaquizzes.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { quiz_id: "quiz-id" },
      };

      // Stub KnowYourAirQuizModel(tenant).remove to throw an error
      const quizRemoveStub = sinon
        .stub(KnowYourAirQuizModel("your-tenant"), "remove")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.deleteQuiz(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuizModel("your-tenant").remove.restore();
      logger.error.restore();
    });
  });
  describe("updateQuiz()", () => {
    it("should update a quiz", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* updated quiz data */
        },
      };

      // Stub generateFilter.kyaquizzes to return a successful filter
      sinon.stub(generateFilter, "kyaquizzes").returns({
        /* successful filter properties */
      });

      // Stub KnowYourAirQuizModel(tenant).modify to return updated quiz response
      const quizModifyStub = sinon
        .stub(KnowYourAirQuizModel("your-tenant"), "modify")
        .resolves({ success: true /* other response properties */ });

      const result = await createKnowYourAir.updateQuiz(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaquizzes.restore();
      KnowYourAirQuizModel("your-tenant").modify.restore();
    });

    it("should handle filter failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* updated quiz data */
        },
      };

      // Stub generateFilter.kyaquizzes to return filter failure response
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquizzes")
        .returns({ success: false /* other response properties */ });

      const result = await createKnowYourAir.updateQuiz(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      generateFilter.kyaquizzes.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* updated quiz data */
        },
      };

      // Stub generateFilter.kyaquizzes to return a successful filter
      sinon.stub(generateFilter, "kyaquizzes").returns({
        /* successful filter properties */
      });

      // Stub KnowYourAirQuizModel(tenant).modify to throw an error
      const quizModifyStub = sinon
        .stub(KnowYourAirQuizModel("your-tenant"), "modify")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.updateQuiz(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaquizzes.restore();
      KnowYourAirQuizModel("your-tenant").modify.restore();
      logger.error.restore();
    });
  });
  describe("createQuiz()", () => {
    it("should create a quiz and send a Kafka message", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* quiz data */
        },
      };

      // Stub KnowYourAirQuizModel(tenant).register to return a successful response
      const quizRegisterStub = sinon
        .stub(KnowYourAirQuizModel("your-tenant"), "register")
        .resolves({
          success: true,
          data: {
            /* other response properties */
          },
        });

      // Stub kafka.producer.connect to return a resolved promise
      const kafkaProducerConnectStub = sinon
        .stub(kafka.producer(), "connect")
        .resolves();

      // Stub kafka.producer.send to return a resolved promise
      const kafkaProducerSendStub = sinon
        .stub(kafka.producer(), "send")
        .resolves();

      // Stub kafka.producer.disconnect to return a resolved promise
      const kafkaProducerDisconnectStub = sinon
        .stub(kafka.producer(), "disconnect")
        .resolves();

      const result = await createKnowYourAir.createQuiz(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuizModel("your-tenant").register.restore();
      kafka.producer().connect.restore();
      kafka.producer().send.restore();
      kafka.producer().disconnect.restore();
    });

    it("should handle a quiz registration failure", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* quiz data */
        },
      };

      // Stub KnowYourAirQuizModel(tenant).register to return a failed response
      const quizRegisterStub = sinon
        .stub(KnowYourAirQuizModel("your-tenant"), "register")
        .resolves({ success: false /* other response properties */ });

      const result = await createKnowYourAir.createQuiz(request);

      expect(result.success).to.be.false;
      // Your other assertions here

      // Restore the stub
      KnowYourAirQuizModel("your-tenant").register.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* quiz data */
        },
      };

      // Stub KnowYourAirQuizModel(tenant).register to throw an error
      const quizRegisterStub = sinon
        .stub(KnowYourAirQuizModel("your-tenant"), "register")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.createQuiz(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuizModel("your-tenant").register.restore();
      logger.error.restore();
    });
  });

  /******************* tracking user QUIZ progress ***************** */
  describe("listUserQuizProgress()", () => {
    it("should list user quiz progress", async () => {
      const tenant = "your-tenant";
      const userQuizProgressData = [
        /* user quiz progress data */
      ];

      // Stub KnowYourAirUserQuizProgressModel(tenant).list to resolve successfully
      const listStub = sinon
        .stub(KnowYourAirUserQuizProgressModel, "list")
        .resolves(userQuizProgressData);

      const result = await createKnowYourAir.listUserQuizProgress({
        query: { tenant },
      });

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(userQuizProgressData);
      // Your other assertions here

      // Restore the stubs
      KnowYourAirUserQuizProgressModel.list.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const userQuizProgressData = [
        /* user quiz progress data */
      ];

      // Stub KnowYourAirUserQuizProgressModel(tenant).list to throw an error
      const listStub = sinon
        .stub(KnowYourAirUserQuizProgressModel, "list")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.listUserQuizProgress({
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirUserQuizProgressModel.list.restore();
      logger.error.restore();
    });
  });
  describe("deleteUserQuizProgress()", () => {
    it("should delete user quiz progress", async () => {
      const tenant = "your-tenant";
      const userQuizProgressDeletionResult = {
        success: true,
        message: "Deleted successfully",
        status: httpStatus.OK,
      };

      // Stub KnowYourAirUserQuizProgressModel(tenant).remove to resolve successfully
      const removeStub = sinon
        .stub(KnowYourAirUserQuizProgressModel, "remove")
        .resolves(userQuizProgressDeletionResult);

      const result = await createKnowYourAir.deleteUserQuizProgress({
        query: { tenant },
      });

      expect(result).to.deep.equal(userQuizProgressDeletionResult);
      // Your other assertions here

      // Restore the stubs
      KnowYourAirUserQuizProgressModel.remove.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const userQuizProgressDeletionResult = {
        success: false,
        message: "Deletion failed",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };

      // Stub KnowYourAirUserQuizProgressModel(tenant).remove to throw an error
      const removeStub = sinon
        .stub(KnowYourAirUserQuizProgressModel, "remove")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.deleteUserQuizProgress({
        query: { tenant },
      });

      expect(result).to.deep.equal(userQuizProgressDeletionResult);
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirUserQuizProgressModel.remove.restore();
      logger.error.restore();
    });
  });
  describe("updateUserQuizProgress()", () => {
    it("should update user quiz progress", async () => {
      const tenant = "your-tenant";
      const userQuizProgressUpdateResult = {
        success: true,
        message: "Updated successfully",
        status: httpStatus.OK,
      };

      // Stub KnowYourAirUserQuizProgressModel(tenant).modify to resolve successfully
      const modifyStub = sinon
        .stub(KnowYourAirUserQuizProgressModel, "modify")
        .resolves(userQuizProgressUpdateResult);

      const result = await createKnowYourAir.updateUserQuizProgress({
        query: { tenant },
        body: { updatedData: "value" },
      });

      expect(result).to.deep.equal(userQuizProgressUpdateResult);
      // Your other assertions here

      // Restore the stubs
      KnowYourAirUserQuizProgressModel.modify.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const userQuizProgressUpdateResult = {
        success: false,
        message: "Update failed",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };

      // Stub KnowYourAirUserQuizProgressModel(tenant).modify to throw an error
      const modifyStub = sinon
        .stub(KnowYourAirUserQuizProgressModel, "modify")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.updateUserQuizProgress({
        query: { tenant },
        body: { updatedData: "value" },
      });

      expect(result).to.deep.equal(userQuizProgressUpdateResult);
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirUserQuizProgressModel.modify.restore();
      logger.error.restore();
    });
  });
  describe("createUserQuizProgress()", () => {
    it("should create user quiz progress", async () => {
      const tenant = "your-tenant";
      const createUserQuizProgressResult = {
        success: true,
        message: "Created successfully",
        status: httpStatus.CREATED,
        data: { id: "user-quiz-progress-id" },
      };

      // Stub KnowYourAirUserQuizProgressModel(tenant).register to resolve successfully
      const registerStub = sinon
        .stub(KnowYourAirUserQuizProgressModel, "register")
        .resolves(createUserQuizProgressResult);

      const result = await createKnowYourAir.createUserQuizProgress({
        query: { tenant },
        body: { someData: "value" },
      });

      expect(result).to.deep.equal(createUserQuizProgressResult);
      // Your other assertions here

      // Restore the stubs
      KnowYourAirUserQuizProgressModel.register.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const createUserQuizProgressErrorResult = {
        success: false,
        message: "Creation failed",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };

      // Stub KnowYourAirUserQuizProgressModel(tenant).register to throw an error
      const registerStub = sinon
        .stub(KnowYourAirUserQuizProgressModel, "register")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.createUserQuizProgress({
        query: { tenant },
        body: { someData: "value" },
      });

      expect(result).to.deep.equal(createUserQuizProgressErrorResult);
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirUserQuizProgressModel.register.restore();
      logger.error.restore();
    });
  });
  describe("syncUserQuizProgress()", () => {
    it("should sync user quiz progress", async () => {
      const tenant = "your-tenant";
      const user_id = "user-id";
      const progressList = [
        { _id: "quiz-id-1", active_question: 1, status: "in-progress" },
        { _id: "quiz-id-2", active_question: 2, status: "completed" },
      ];
      const listUserQuizProgressResult = {
        success: true,
        data: [{ _id: "progress-id-1" }, { _id: "progress-id-2" }],
      };

      // Stub createKnowYourAir.listUserQuizProgress to resolve successfully
      const listUserQuizProgressStub = sinon
        .stub(createKnowYourAir, "listUserQuizProgress")
        .resolves(listUserQuizProgressResult);

      // Stub createKnowYourAir.createUserQuizProgress and createKnowYourAir.updateUserQuizProgress to resolve successfully
      const createUserQuizProgressStub = sinon
        .stub(createKnowYourAir, "createUserQuizProgress")
        .resolves({ success: true });
      const updateUserQuizProgressStub = sinon
        .stub(createKnowYourAir, "updateUserQuizProgress")
        .resolves({ success: true });

      const result = await createKnowYourAir.syncUserQuizProgress({
        query: { tenant },
        params: { user_id },
        body: { kya_quiz_user_progress: progressList },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Verify the stubs were called as expected
      expect(listUserQuizProgressStub.calledOnce).to.be.true;
      expect(createUserQuizProgressStub.calledTwice).to.be.true; // Called for both quizzes
      expect(updateUserQuizProgressStub.calledOnce).to.be.true;

      // Restore the stubs
      createKnowYourAir.listUserQuizProgress.restore();
      createKnowYourAir.createUserQuizProgress.restore();
      createKnowYourAir.updateUserQuizProgress.restore();
    });

    it("should handle an error", async () => {
      const tenant = "your-tenant";
      const user_id = "user-id";
      const progressList = [
        { _id: "quiz-id-1", active_question: 1, status: "in-progress" },
        { _id: "quiz-id-2", active_question: 2, status: "completed" },
      ];

      // Stub createKnowYourAir.listUserQuizProgress to throw an error
      const listUserQuizProgressStub = sinon
        .stub(createKnowYourAir, "listUserQuizProgress")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.syncUserQuizProgress({
        query: { tenant },
        params: { user_id },
        body: { kya_quiz_user_progress: progressList },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Verify the stubs were called as expected
      expect(listUserQuizProgressStub.calledOnce).to.be.true;

      // Restore the stubs
      createKnowYourAir.listUserQuizProgress.restore();
      logger.error.restore();
    });
  });

  /******************* questions *******************************/
  describe("listQuestions()", () => {
    it("should list questions for a quiz", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { quiz_id: "quiz-id" },
        query: { limit: 10, skip: 0 },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaquestions to return a valid filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquestions")
        .returns({
          /* valid filter data */
        });

      // Stub KnowYourAirQuestionModel(tenant).list to return a successful response
      const listQuestionsStub = sinon
        .stub(KnowYourAirQuestionModel, "list")
        .resolves({ success: true, data: "" }); /* mock data */

      const result = await createKnowYourAir.listQuestions(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaquestions.restore();
      KnowYourAirQuestionModel.list.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        params: { quiz_id: "quiz-id" },
        query: { limit: 10, skip: 0 },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaquestions to return a valid filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquestions")
        .returns({
          /* valid filter data */
        });

      // Stub KnowYourAirQuestionModel(tenant).list to throw an error
      const listQuestionsStub = sinon
        .stub(KnowYourAirQuestionModel, "list")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.listQuestions(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaquestions.restore();
      KnowYourAirQuestionModel.list.restore();
      logger.error.restore();
    });
  });
  describe("deleteQuestion()", () => {
    it("should delete a question", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaquestions to return a valid filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquestions")
        .returns({
          /* valid filter data */
        });

      // Stub KnowYourAirQuestionModel(tenant).remove to return a successful response
      const removeQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "remove")
        .resolves({ success: true, data: "" }); /* mock data */

      const result = await createKnowYourAir.deleteQuestion(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaquestions.restore();
      KnowYourAirQuestionModel.remove.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaquestions to return a valid filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquestions")
        .returns({
          /* valid filter data */
        });

      // Stub KnowYourAirQuestionModel(tenant).remove to throw an error
      const removeQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "remove")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.deleteQuestion(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaquestions.restore();
      KnowYourAirQuestionModel.remove.restore();
      logger.error.restore();
    });
  });
  describe("updateQuestion()", () => {
    it("should update a question", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {} /* updated question data */,
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaquestions to return a valid filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquestions")
        .returns({
          /* valid filter data */
        });

      // Stub KnowYourAirQuestionModel(tenant).modify to return a successful response
      const modifyQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "modify")
        .resolves({ success: true, data: {} }); /* mock data */

      const result = await createKnowYourAir.updateQuestion(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaquestions.restore();
      KnowYourAirQuestionModel.modify.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {} /* updated question data */,
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaquestions to return a valid filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquestions")
        .returns({
          /* valid filter data */
        });

      // Stub KnowYourAirQuestionModel(tenant).modify to throw an error
      const modifyQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "modify")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.updateQuestion(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaquestions.restore();
      KnowYourAirQuestionModel.modify.restore();
      logger.error.restore();
    });
  });
  describe("createQuestion()", () => {
    it("should create a question", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {} /* question data */,
        /* Other request properties as needed */
      };

      // Stub KnowYourAirQuestionModel(tenant).register to return a successful response
      const registerQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "register")
        .resolves({ success: true, data: {} }); /* mock data */

      // Stub kafka.producer to prevent actual Kafka interactions
      const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
        connect: sinon.stub(),
        send: sinon.stub().resolves(),
        disconnect: sinon.stub(),
      });

      const result = await createKnowYourAir.createQuestion(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuestionModel.register.restore();
      kafka.producer.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {} /* question data */,
        /* Other request properties as needed */
      };

      // Stub KnowYourAirQuestionModel(tenant).register to throw an error
      const registerQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "register")
        .throws(new Error("Some error"));

      // Stub kafka.producer to prevent actual Kafka interactions
      const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
        connect: sinon.stub(),
        send: sinon.stub().resolves(),
        disconnect: sinon.stub(),
      });

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.createQuestion(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuestionModel.register.restore();
      kafka.producer.restore();
      logger.error.restore();
    });
  });
  /******************* Answers *******************************/
  describe("listAnswers()", () => {
    it("should list answers", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        /* Other request properties as needed */
      };

      // Stub KnowYourAirAnswerModel(tenant).list to return a successful response
      const listAnswersStub = sinon
        .stub(KnowYourAirAnswerModel, "list")
        .resolves({ success: true, data: {} }); /* mock data */

      const result = await createKnowYourAir.listAnswers(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirAnswerModel.list.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        /* Other request properties as needed */
      };

      // Stub KnowYourAirAnswerModel(tenant).list to throw an error
      const listAnswersStub = sinon
        .stub(KnowYourAirAnswerModel, "list")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.listAnswers(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirAnswerModel.list.restore();
      logger.error.restore();
    });
  });
  describe("deleteAnswer()", () => {
    it("should delete an answer", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        /* Other request properties as needed */
      };

      // Stub KnowYourAirAnswerModel(tenant).remove to return a successful response
      const removeAnswerStub = sinon
        .stub(KnowYourAirAnswerModel, "remove")
        .resolves({ success: true, data: {} }); /* mock data */

      const result = await createKnowYourAir.deleteAnswer(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirAnswerModel.remove.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        /* Other request properties as needed */
      };

      // Stub KnowYourAirAnswerModel(tenant).remove to throw an error
      const removeAnswerStub = sinon
        .stub(KnowYourAirAnswerModel, "remove")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.deleteAnswer(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirAnswerModel.remove.restore();
      logger.error.restore();
    });
  });
  describe("updateAnswer()", () => {
    it("should update an answer", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* Updated answer data */
        },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaquestions to return a valid filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquestions")
        .returns({ success: true /* Other filter properties */ });

      // Stub KnowYourAirAnswerModel(tenant).modify to return a successful response
      const modifyAnswerStub = sinon
        .stub(KnowYourAirAnswerModel, "modify")
        .resolves({ success: true, data: {} }); /* mock data */

      const result = await createKnowYourAir.updateAnswer(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaquestions.restore();
      KnowYourAirAnswerModel.modify.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* Updated answer data */
        },
        /* Other request properties as needed */
      };

      // Stub generateFilter.kyaquestions to return a valid filter
      const generateFilterStub = sinon
        .stub(generateFilter, "kyaquestions")
        .returns({ success: true /* Other filter properties */ });

      // Stub KnowYourAirAnswerModel(tenant).modify to throw an error
      const modifyAnswerStub = sinon
        .stub(KnowYourAirAnswerModel, "modify")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.updateAnswer(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      generateFilter.kyaquestions.restore();
      KnowYourAirAnswerModel.modify.restore();
      logger.error.restore();
    });
  });
  describe("createAnswer()", () => {
    it("should create an answer", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* Answer data */
        },
        /* Other request properties as needed */
      };

      // Stub KnowYourAirAnswerModel(tenant).register to return a successful response
      const registerAnswerStub = sinon
        .stub(KnowYourAirAnswerModel, "register")
        .resolves({ success: true, data: {} /* mock data */ });

      // Stub kafka.producer to return a mock producer
      const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
        connect: sinon.stub().resolves(),
        send: sinon.stub().resolves(),
        disconnect: sinon.stub().resolves(),
      });

      const result = await createKnowYourAir.createAnswer(request);

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirAnswerModel.register.restore();
      kafka.producer.restore();
    });

    it("should handle an error", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          /* Answer data */
        },
        /* Other request properties as needed */
      };

      // Stub KnowYourAirAnswerModel(tenant).register to throw an error
      const registerAnswerStub = sinon
        .stub(KnowYourAirAnswerModel, "register")
        .throws(new Error("Some error"));

      // Stub kafka.producer to return a mock producer
      const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
        connect: sinon.stub().resolves(),
        send: sinon.stub().resolves(),
        disconnect: sinon.stub().resolves(),
      });

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.createAnswer(request);

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirAnswerModel.register.restore();
      kafka.producer.restore();
      logger.error.restore();
    });
  });

  /******************* manage Quizes *******************************/
  describe("assignManyQuestionsToQuiz()", () => {
    it("should assign many questions to a quiz", async () => {
      const quiz_id = "some-quiz-id";
      const question_ids = ["question-id-1", "question-id-2"];
      const tenant = "your-tenant";

      // Stub KnowYourAirQuizModel(tenant).findById to return a mock quiz
      const findQuizStub = sinon
        .stub(KnowYourAirQuizModel, "findById")
        .resolves({
          /* Mock quiz data */
        });

      // Stub KnowYourAirQuestionModel(tenant).findById to return mock questions
      const findQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "findById")
        .onFirstCall()
        .resolves({
          /* Mock question 1 data */
        })
        .onSecondCall()
        .resolves({
          /* Mock question 2 data */
        });

      // Stub KnowYourAirQuestionModel(tenant).updateMany to return nModified and n
      const updateManyStub = sinon
        .stub(KnowYourAirQuestionModel, "updateMany")
        .resolves({ nModified: question_ids.length, n: question_ids.length });

      const result = await createKnowYourAir.assignManyQuestionsToQuiz({
        params: { quiz_id },
        body: { question_ids },
        query: { tenant },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuizModel.findById.restore();
      KnowYourAirQuestionModel.findById.restore();
      KnowYourAirQuestionModel.updateMany.restore();
    });

    it("should handle an error", async () => {
      const quiz_id = "some-quiz-id";
      const question_ids = ["question-id-1", "question-id-2"];
      const tenant = "your-tenant";

      // Stub KnowYourAirQuizModel(tenant).findById to return a mock quiz
      const findQuizStub = sinon
        .stub(KnowYourAirQuizModel, "findById")
        .resolves({
          /* Mock quiz data */
        });

      // Stub KnowYourAirQuestionModel(tenant).findById to throw an error
      const findQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "findById")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.assignManyQuestionsToQuiz({
        params: { quiz_id },
        body: { question_ids },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuizModel.findById.restore();
      KnowYourAirQuestionModel.findById.restore();
      logger.error.restore();
    });
  });
  describe("removeManyQuestionsFromQuiz()", () => {
    it("should remove many questions from a quiz", async () => {
      const quiz_id = "some-quiz-id";
      const question_ids = ["question-id-1", "question-id-2"];
      const tenant = "your-tenant";

      // Stub KnowYourAirQuizModel(tenant).findById to return a mock quiz
      const findQuizStub = sinon
        .stub(KnowYourAirQuizModel, "findById")
        .resolves({
          /* Mock quiz data */
        });

      // Stub KnowYourAirQuestionModel(tenant).find to return mock existing questions
      const findQuestionsStub = sinon
        .stub(KnowYourAirQuestionModel, "find")
        .resolves([{ _id: "question-id-1" }, { _id: "question-id-2" }]);

      // Stub KnowYourAirQuestionModel(tenant).updateMany to return nModified and n
      const updateManyStub = sinon
        .stub(KnowYourAirQuestionModel, "updateMany")
        .resolves({ nModified: question_ids.length, n: question_ids.length });

      const result = await createKnowYourAir.removeManyQuestionsFromQuiz({
        params: { quiz_id },
        body: { question_ids },
        query: { tenant },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuizModel.findById.restore();
      KnowYourAirQuestionModel.find.restore();
      KnowYourAirQuestionModel.updateMany.restore();
    });

    it("should handle an error", async () => {
      const quiz_id = "some-quiz-id";
      const question_ids = ["question-id-1", "question-id-2"];
      const tenant = "your-tenant";

      // Stub KnowYourAirQuizModel(tenant).findById to return a mock quiz
      const findQuizStub = sinon
        .stub(KnowYourAirQuizModel, "findById")
        .resolves({
          /* Mock quiz data */
        });

      // Stub KnowYourAirQuestionModel(tenant).find to throw an error
      const findQuestionsStub = sinon
        .stub(KnowYourAirQuestionModel, "find")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.removeManyQuestionsFromQuiz({
        params: { quiz_id },
        body: { question_ids },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuizModel.findById.restore();
      KnowYourAirQuestionModel.find.restore();
      logger.error.restore();
    });
  });
  describe("assignManyAnswersToQuestion()", () => {
    it("should assign many answers to a question", async () => {
      const question_id = "some-question-id";
      const answer_ids = ["answer-id-1", "answer-id-2"];
      const tenant = "your-tenant";

      // Stub KnowYourAirQuestionModel(tenant).findById to return a mock question
      const findQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "findById")
        .resolves({
          /* Mock question data */
        });

      // Stub KnowYourAirAnswerModel(tenant).findById to return mock answer data
      const findAnswerStub = sinon
        .stub(KnowYourAirAnswerModel, "findById")
        .resolves({ _id: "answer-id-1", kya_question: null });

      // Stub KnowYourAirAnswerModel(tenant).updateMany to return nModified and n
      const updateManyStub = sinon
        .stub(KnowYourAirAnswerModel, "updateMany")
        .resolves({ nModified: answer_ids.length, n: answer_ids.length });

      const result = await createKnowYourAir.assignManyAnswersToQuestion({
        params: { question_id },
        body: { answer_ids },
        query: { tenant },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuestionModel.findById.restore();
      KnowYourAirAnswerModel.findById.restore();
      KnowYourAirAnswerModel.updateMany.restore();
    });

    it("should handle an error", async () => {
      const question_id = "some-question-id";
      const answer_ids = ["answer-id-1", "answer-id-2"];
      const tenant = "your-tenant";

      // Stub KnowYourAirQuestionModel(tenant).findById to return a mock question
      const findQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "findById")
        .resolves({
          /* Mock question data */
        });

      // Stub KnowYourAirAnswerModel(tenant).findById to throw an error
      const findAnswerStub = sinon
        .stub(KnowYourAirAnswerModel, "findById")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.assignManyAnswersToQuestion({
        params: { question_id },
        body: { answer_ids },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuestionModel.findById.restore();
      KnowYourAirAnswerModel.findById.restore();
      logger.error.restore();
    });
  });
  describe("removeManyAnswersFromQuestion()", () => {
    it("should remove many answers from a question", async () => {
      const question_id = "some-question-id";
      const answer_ids = ["answer-id-1", "answer-id-2"];
      const tenant = "your-tenant";

      // Stub KnowYourAirQuestionModel(tenant).findById to return a mock question
      const findQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "findById")
        .resolves({
          /* Mock question data */
        });

      // Stub KnowYourAirAnswerModel(tenant).findById to return mock answer data
      const findAnswerStub = sinon
        .stub(KnowYourAirAnswerModel, "findById")
        .resolves({ _id: "answer-id-1", kya_question: question_id });

      // Stub KnowYourAirAnswerModel(tenant).updateMany to return nModified and n
      const updateManyStub = sinon
        .stub(KnowYourAirAnswerModel, "updateMany")
        .resolves({ nModified: answer_ids.length, n: answer_ids.length });

      const result = await createKnowYourAir.removeManyAnswersFromQuestion({
        params: { question_id },
        body: { answer_ids },
        query: { tenant },
      });

      expect(result.success).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuestionModel.findById.restore();
      KnowYourAirAnswerModel.findById.restore();
      KnowYourAirAnswerModel.updateMany.restore();
    });

    it("should handle an error", async () => {
      const question_id = "some-question-id";
      const answer_ids = ["answer-id-1", "answer-id-2"];
      const tenant = "your-tenant";

      // Stub KnowYourAirQuestionModel(tenant).findById to return a mock question
      const findQuestionStub = sinon
        .stub(KnowYourAirQuestionModel, "findById")
        .resolves({
          /* Mock question data */
        });

      // Stub KnowYourAirAnswerModel(tenant).findById to throw an error
      const findAnswerStub = sinon
        .stub(KnowYourAirAnswerModel, "findById")
        .throws(new Error("Some error"));

      // Stub logger.error to prevent actual log output
      const loggerErrorStub = sinon.stub(logger, "error");

      const result = await createKnowYourAir.removeManyAnswersFromQuestion({
        params: { question_id },
        body: { answer_ids },
        query: { tenant },
      });

      expect(result.success).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      // Your other assertions here

      // Restore the stubs
      KnowYourAirQuestionModel.findById.restore();
      KnowYourAirAnswerModel.findById.restore();
      logger.error.restore();
    });
  });
});
