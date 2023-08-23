require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const sinon = require("sinon");
const httpStatus = require("http-status");
const assert = chai.assert;
const faker = require("faker");
const mongoose = require("mongoose").set("debug", true);

const createKnowYourAir = require("@utils/create-know-your-air");
const { getModelByTenant } = require("@config/database");
const generateFilter = require("../generate-filter");

chai.use(chaiHttp);
const expect = chai.expect;

const generateFilterStub = {
  kyaprogress: sinon.stub().returns({}), // You can add the expected filter here
};

const KnowYourAirUserLessonProgressModelMock = {
  list: sinon
    .stub()
    .resolves([
      { _id: "progressId1", lesson: "lessonId1", progress: 50 },
      { _id: "progressId2", lesson: "lessonId2", progress: 75 },
    ]), // Mock the list of progress
  remove: sinon.stub().resolves({
    deletedCount: 1,
  }), // Mock the response from the remove function
  modify: sinon.stub().resolves({
    success: true,
    data: { updatedField: "Updated value" }, // Mock the response from the modify function
  }),
  register: sinon.stub().resolves({
    success: true,
    data: { lessonProgressId: "lessonProgressId1" }, // Mock the response from the register function
  }),
};

// Mock the models and other dependencies
const KnowYourAirLessonModelMock = {
  remove: sinon.stub().resolves({ deletedCount: 1 }), // Mock the successful deletion
  modify: sinon.stub().resolves({ updatedCount: 1, modifiedData: {} }), // Mock the successful update
  register: sinon.stub().resolves({ success: true, data: {} }), // Mock the successful registration
  findById: sinon.stub().resolves({ _id: "lessonId1" }), // Mock the found lesson
};

const KnowYourAirTaskModelMock = {
  aggregate: sinon.stub().returns({
    exec: sinon
      .stub()
      .resolves([
        { _id: "taskId1", title: "Task 1" },
        { _id: "taskId2", title: "Task 2" },
      ]), // Mock the found tasks
  }),
};

const kafkaProducerMock = {
  connect: sinon.stub().resolves(),
  send: sinon.stub().resolves(),
  disconnect: sinon.stub().resolves(),
};

const kafkaMock = {
  producer: sinon.stub().returns(kafkaProducerMock),
};

const getModelByTenantMock = sinon.stub().returns(KnowYourAirLessonModelMock);

const requestMock = {
  query: { tenant: "testTenant" },
  params: { lesson_id: "lessonId1", user_id: "testUserId", task_id: "task_id" },
  query: { tenant: "testTenant", limit: "10", skip: "0" },
  body: {
    taskName: "Updated Task",
    task_ids: ["task_id_1", "task_id_2", "task_id_3"],
    description: "Updated Task Description",
    fieldToUpdate: "New value",
    kya_user_progress: [
      {
        lesson_id: "lesson_id1",
        active_task: "active_task1",
        status: "status1",
      },
      // Add more progress data if needed for other test scenarios
    ],
  },
};

const filterSuccessMock = { success: true };
const filterFailureMock = { success: false, message: "Filter failed" };

const responseFromListUserLessonProgressMock = {
  success: true,
  data: [
    {
      _id: "progress_id1",
      user_id: "testUserId",
      lesson_id: "lesson_id1",
      active_task: "active_task1",
      status: "status1",
    },
    // Add more progress data if needed for other test scenarios
  ],
};

const responseFromCreateUserLessonProgressMock = {
  success: true,
  data: { lessonProgressId: "progress_id1" },
};

const responseFromUpdateUserLessonProgressMock = {
  success: true,
  data: { updatedField: "updatedValue" },
};

const responseFromListKyaTaskMock = {
  success: true,
  data: [
    { _id: "task_id1", name: "Task 1" },
    { _id: "task_id2", name: "Task 2" },
    // Add more task data if needed for other test scenarios
  ],
};

const responseFromRemoveKyaTaskMock = {
  success: true,
  message: "Task deleted successfully",
};

const responseFromModifyKyaTaskMock = {
  success: true,
  message: "Task updated successfully",
  data: {
    _id: "task_id",
    taskName: "Updated Task",
    description: "Updated Task Description",
    // Include other task properties here...
  },
};

const responseFromRegisterKyaTaskSuccessMock = {
  success: true,
  message: "Task created successfully",
  data: {
    _id: "task_id",
    taskName: "New Task",
    description: "New Task Description",
    // Include other task properties here...
  },
};

const responseFromRegisterKyaTaskFailureMock = {
  success: false,
  message: "Task creation failed",
  errors: { message: "Task creation failed" },
  status: httpStatus.INTERNAL_SERVER_ERROR,
};

const taskExistsMock = true;
const lessonExistsMock = true;

const lessonMock = {
  _id: "lesson_id",
  lessonName: "Lesson 1",
};

const taskMock = {
  _id: "task_id",
  taskName: "Test Task",
  description: "Test Task Description",
  kya_lesson: null,
  // Include other task properties here...
};

const taskMock1 = {
  _id: "task_id_1",
  taskName: "Task 1",
  description: "Task 1 Description",
  kya_lesson: null,
};

const taskMocks = [
  {
    _id: "task_id1",
    taskName: "Task 1",
    description: "Task 1 Description",
    kya_lesson: "lesson_id",
  },
  {
    _id: "task_id2",
    taskName: "Task 2",
    description: "Task 2 Description",
    kya_lesson: "lesson_id",
  },
  // task_id3 is not assigned to the lesson
];

const taskMock2 = {
  _id: "task_id_2",
  taskName: "Task 2",
  description: "Task 2 Description",
  kya_lesson: null,
};

const taskMock3 = {
  _id: "task_id_3",
  taskName: "Task 3",
  description: "Task 3 Description",
  kya_lesson: "lesson_id", // Already assigned to the lesson
};

const updatedTaskMock = {
  _id: "task_id",
  taskName: "Test Task",
  description: "Test Task Description",
  kya_lesson: "lesson_id",
  // Include other task properties here...
};

describe("createKnowYourAir", () => {
  let sandbox;

  before(() => {
    // Create a sandbox for stubs and mocks
    sandbox = sinon.createSandbox();
  });

  after(() => {
    // Restore all stubs and mocks
    sandbox.restore();
  });

  describe("sample", () => {
    it("should return success: false and Internal Server Error for any request", async () => {
      const request = {}; // Put your test request data here if needed

      const response = await createKnowYourAir.sample(request);

      expect(response.success).to.be.false;
      expect(response.message).to.equal("Internal Server Error");
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listLesson", () => {
    it("should return success: false and Internal Server Error if an error occurs during the query", async () => {
      const request = {
        query: {},
        params: { user_id: "test_user_id" },
        query: { limit: "10", skip: "0", tenant: "test_tenant" },
      };

      // Stub the KnowYourAirLessonModel.list method to throw an error
      sandbox.stub(getModelByTenant, "list").throws(new Error("Test error"));

      const response = await createKnowYourAir.listLesson(request);

      expect(response.success).to.be.false;
      expect(response.message).to.equal("Internal Server Error");
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should return success: true and the response data if the query is successful", async () => {
      const request = {
        query: {},
        params: { user_id: "test_user_id" },
        query: { limit: "10", skip: "0", tenant: "test_tenant" },
      };

      const expectedResponse = {
        success: true,
        message: "Mocked response",
        data: [], // Put your mocked data here
      };

      // Stub the KnowYourAirLessonModel.list method to return the expected response
      sandbox.stub(getModelByTenant, "list").returns(expectedResponse);

      const response = await createKnowYourAir.listLesson(request);

      expect(response).to.deep.equal(expectedResponse);
    });
  });

  describe("deleteLesson function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should delete the lesson successfully", async () => {
      // Arrange
      sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns({ success: true });

      // Act
      const result = await createKnowYourAir.deleteLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "Lesson successfully deleted");
      expect(result).to.have.property("status", httpStatus.OK);
    });

    it("should handle failure to delete the lesson", async () => {
      // Arrange
      sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns({ success: true });
      KnowYourAirLessonModelMock.remove.rejects(new Error("Failed to delete"));

      // Act
      const result = await createKnowYourAir.deleteLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Failed to delete lesson");
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });

    it("should handle filter error", async () => {
      // Arrange
      sinon.stub(createKnowYourAir, "generateFilter").returns({
        success: false,
        errors: { message: "Invalid filter" },
      });

      // Act
      const result = await createKnowYourAir.deleteLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Invalid filter");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
    });
  });

  describe("updateLesson function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should update the lesson successfully", async () => {
      // Arrange
      sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns({ success: true });

      // Act
      const result = await createKnowYourAir.updateLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "Lesson successfully updated");
      expect(result).to.have.property("status", httpStatus.OK);
      expect(result).to.have.property("data"); // Assuming the updated data is returned
    });

    it("should handle failure to update the lesson", async () => {
      // Arrange
      sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns({ success: true });
      KnowYourAirLessonModelMock.modify.rejects(new Error("Failed to update"));

      // Act
      const result = await createKnowYourAir.updateLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Failed to update lesson");
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });

    it("should handle filter error", async () => {
      // Arrange
      sinon.stub(createKnowYourAir, "generateFilter").returns({
        success: false,
        errors: { message: "Invalid filter" },
      });

      // Act
      const result = await createKnowYourAir.updateLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Invalid filter");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
    });
  });

  describe("createLesson function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should create a lesson and send it to Kafka successfully", async () => {
      // Arrange
      const kafkaSendSpy = sinon.spy(kafkaProducerMock, "send");
      sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns({ success: true });

      // Act
      const result = await createKnowYourAir.createLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "Lesson successfully created");
      expect(result).to.have.property("status", httpStatus.CREATED);
      expect(result).to.have.property("data"); // Assuming the created lesson data is returned
      expect(kafkaSendSpy.calledOnce).to.be.true;
    });

    it("should handle failure during lesson creation", async () => {
      // Arrange
      sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns({ success: true });
      KnowYourAirLessonModelMock.register.rejects(
        new Error("Failed to create")
      );

      // Act
      const result = await createKnowYourAir.createLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Failed to create lesson");
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });

    it("should handle filter error", async () => {
      // Arrange
      sinon.stub(createKnowYourAir, "generateFilter").returns({
        success: false,
        errors: { message: "Invalid filter" },
      });

      // Act
      const result = await createKnowYourAir.createLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Invalid filter");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
    });
  });

  describe("listAvailableTasks function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return all available tasks for a valid lesson ID", async () => {
      // Act
      const result = await createKnowYourAir.listAvailableTasks(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result)
        .to.have.property("message")
        .that.includes("retrieved all available tasks");
      expect(result)
        .to.have.property("data")
        .that.is.an("array")
        .with.lengthOf(2); // Assuming two tasks are returned
      expect(result.data[0]).to.have.property("_id", "taskId1");
      expect(result.data[1]).to.have.property("_id", "taskId2");
    });

    it("should return a Bad Request error for an invalid lesson ID", async () => {
      // Arrange
      KnowYourAirLessonModelMock.findById.resolves(null); // Lesson not found

      // Act
      const result = await createKnowYourAir.listAvailableTasks(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("errors");
      expect(result.errors)
        .to.have.property("message")
        .that.includes("Invalid lesson ID");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
    });

    it("should handle internal server error", async () => {
      // Arrange
      KnowYourAirLessonModelMock.findById.rejects(
        new Error("Internal Server Error")
      );

      // Act
      const result = await createKnowYourAir.listAvailableTasks(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result)
        .to.have.property("errors")
        .that.deep.equals({ message: "Internal Server Error" });
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("listAssignedTasks function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return all assigned tasks for a valid lesson ID", async () => {
      // Act
      const result = await createKnowYourAir.listAssignedTasks(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result)
        .to.have.property("message")
        .that.includes("retrieved all assigned tasks");
      expect(result)
        .to.have.property("data")
        .that.is.an("array")
        .with.lengthOf(2); // Assuming two tasks are returned
      expect(result.data[0]).to.have.property("_id", "taskId1");
      expect(result.data[1]).to.have.property("_id", "taskId2");
    });

    it("should return a Bad Request error for an invalid lesson ID", async () => {
      // Arrange
      KnowYourAirLessonModelMock.findById.resolves(null); // Lesson not found

      // Act
      const result = await createKnowYourAir.listAssignedTasks(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("errors");
      expect(result.errors)
        .to.have.property("message")
        .that.includes("Invalid lesson ID");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
    });

    it("should handle internal server error", async () => {
      // Arrange
      KnowYourAirLessonModelMock.findById.rejects(
        new Error("Internal Server Error")
      );

      // Act
      const result = await createKnowYourAir.listAssignedTasks(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result)
        .to.have.property("errors")
        .that.deep.equals({ message: "Internal Server Error" });
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("listUserLessonProgress function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return the list of user lesson progress", async () => {
      // Arrange
      generateFilterStub.kyaprogress.returns({ lesson: "lessonId1" }); // Mock the expected filter

      // Act
      const result = await createKnowYourAir.listUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", true);
      expect(result)
        .to.have.property("data")
        .that.is.an("array")
        .with.lengthOf(2); // Assuming two progress records are returned
      expect(result.data[0]).to.have.property("_id", "progressId1");
      expect(result.data[0]).to.have.property("lesson", "lessonId1");
      expect(result.data[0]).to.have.property("progress", 50);
      expect(result.data[1]).to.have.property("_id", "progressId2");
      expect(result.data[1]).to.have.property("lesson", "lessonId2");
      expect(result.data[1]).to.have.property("progress", 75);
    });

    it("should handle filter error", async () => {
      // Arrange
      generateFilterStub.kyaprogress.returns({
        success: false,
        message: "Invalid filter",
      }); // Mock the filter error

      // Act
      const result = await createKnowYourAir.listUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Invalid filter");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
    });

    it("should handle internal server error", async () => {
      // Arrange
      generateFilterStub.kyaprogress.throws(new Error("Internal Server Error")); // Mock the internal server error

      // Act
      const result = await createKnowYourAir.listUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result)
        .to.have.property("errors")
        .that.deep.equals({ message: "Internal Server Error" });
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("deleteUserLessonProgress function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should delete user lesson progress and return success", async () => {
      // Arrange
      generateFilterStub.kyaprogress.returns({ lesson: "lessonId1" }); // Mock the expected filter

      // Act
      const result = await createKnowYourAir.deleteUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", true);
      expect(result)
        .to.have.property("data")
        .that.deep.equals({ deletedCount: 1 });
    });

    it("should handle filter error", async () => {
      // Arrange
      generateFilterStub.kyaprogress.returns({
        success: false,
        message: "Invalid filter",
      }); // Mock the filter error

      // Act
      const result = await createKnowYourAir.deleteUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Invalid filter");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
    });

    it("should handle internal server error", async () => {
      // Arrange
      generateFilterStub.kyaprogress.throws(new Error("Internal Server Error")); // Mock the internal server error

      // Act
      const result = await createKnowYourAir.deleteUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result)
        .to.have.property("errors")
        .that.deep.equals({ message: "Internal Server Error" });
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("updateUserLessonProgress function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should update user lesson progress and return success", async () => {
      // Arrange
      generateFilterStub.kyaprogress.returns({ lesson: "lessonId1" }); // Mock the expected filter

      // Act
      const result = await createKnowYourAir.updateUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", true);
      expect(result)
        .to.have.property("data")
        .that.deep.equals({ updatedField: "Updated value" });
    });

    it("should handle filter error", async () => {
      // Arrange
      generateFilterStub.kyaprogress.returns({
        success: false,
        message: "Invalid filter",
      }); // Mock the filter error

      // Act
      const result = await createKnowYourAir.updateUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Invalid filter");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
    });

    it("should handle internal server error", async () => {
      // Arrange
      generateFilterStub.kyaprogress.throws(new Error("Internal Server Error")); // Mock the internal server error

      // Act
      const result = await createKnowYourAir.updateUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result)
        .to.have.property("errors")
        .that.deep.equals({ message: "Internal Server Error" });
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("createUserLessonProgress function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should create user lesson progress and return success", async () => {
      // Act
      const result = await createKnowYourAir.createUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", true);
      expect(result)
        .to.have.property("data")
        .that.deep.equals({ lessonProgressId: "lessonProgressId1" });
    });

    it("should handle internal server error", async () => {
      // Arrange
      KnowYourAirUserLessonProgressModelMock.register.throws(
        new Error("Internal Server Error")
      ); // Mock the internal server error

      // Act
      const result = await createKnowYourAir.createUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result)
        .to.have.property("errors")
        .that.deep.equals({ message: "Internal Server Error" });
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("syncUserLessonProgress function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should sync user lesson progress when progress list is not empty", async () => {
      // Arrange
      const listUserLessonProgressStub = sinon
        .stub(createKnowYourAir, "listUserLessonProgress")
        .resolves(responseFromListUserLessonProgressMock);

      const createUserLessonProgressStub = sinon
        .stub(createKnowYourAir, "createUserLessonProgress")
        .resolves(responseFromCreateUserLessonProgressMock);

      const updateUserLessonProgressStub = sinon
        .stub(createKnowYourAir, "updateUserLessonProgress")
        .resolves(responseFromUpdateUserLessonProgressMock);

      // Act
      const result = await createKnowYourAir.syncUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "Sync successful");
      expect(result)
        .to.have.property("data")
        .that.deep.equals(responseFromListUserLessonProgressMock.data);
      expect(listUserLessonProgressStub.called).to.be.true;
      expect(createUserLessonProgressStub.called).to.be.true;
      expect(updateUserLessonProgressStub.called).to.be.true;
    });

    it("should handle internal server error during sync", async () => {
      // Arrange
      const listUserLessonProgressStub = sinon
        .stub(createKnowYourAir, "listUserLessonProgress")
        .throws(new Error("Internal Server Error"));

      // Act
      const result = await createKnowYourAir.syncUserLessonProgress(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result)
        .to.have.property("errors")
        .that.deep.equals({ message: "Internal Server Error" });
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(listUserLessonProgressStub.called).to.be.true;
    });

    // Add more test cases to cover other scenarios if needed
  });

  describe("listTask function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should list tasks successfully", async () => {
      // Arrange
      const listKyaTaskStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "list")
        .resolves(responseFromListKyaTaskMock);

      // Act
      const result = await createKnowYourAir.listTask(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result)
        .to.have.property("data")
        .that.deep.equals(responseFromListKyaTaskMock.data);
      expect(
        listKyaTaskStub.calledWithExactly({
          filter: sinon.match.any, // You can add specific filter expectations here if needed
          limit: 10,
          skip: 0,
        })
      ).to.be.true;
    });

    it("should handle internal server error during listing tasks", async () => {
      // Arrange
      const listKyaTaskStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "list")
        .throws(new Error("Internal Server Error"));

      // Act
      const result = await createKnowYourAir.listTask(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(result).to.have.nested.property("errors.message");
      expect(
        listKyaTaskStub.calledWithExactly({
          filter: sinon.match.any, // You can add specific filter expectations here if needed
          limit: 10,
          skip: 0,
        })
      ).to.be.true;
    });

    // Add more test cases to cover other scenarios if needed
  });

  describe("deleteTask function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should delete task successfully", async () => {
      // Arrange
      const generateFilterStub = sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns(filterSuccessMock);

      const removeKyaTaskStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "remove")
        .resolves(responseFromRemoveKyaTaskMock);

      // Act
      const result = await createKnowYourAir.deleteTask(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "Task deleted successfully");
      expect(result).to.not.have.property("errors");
      expect(result).to.have.property("status", httpStatus.OK);
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
      expect(removeKyaTaskStub.calledWithExactly({ filter: filterSuccessMock }))
        .to.be.true;
    });

    it("should return filter failure message when filter is not successful", async () => {
      // Arrange
      const generateFilterStub = sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns(filterFailureMock);

      // Act
      const result = await createKnowYourAir.deleteTask(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Filter failed");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
    });

    it("should handle internal server error during task deletion", async () => {
      // Arrange
      const generateFilterStub = sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns(filterSuccessMock);

      const removeKyaTaskStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "remove")
        .throws(new Error("Internal Server Error"));

      // Act
      const result = await createKnowYourAir.deleteTask(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(result).to.have.nested.property("errors.message");
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
      expect(removeKyaTaskStub.calledWithExactly({ filter: filterSuccessMock }))
        .to.be.true;
    });

    // Add more test cases to cover other scenarios if needed
  });

  describe("updateTask function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should update task successfully", async () => {
      // Arrange
      const generateFilterStub = sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns(filterSuccessMock);

      const modifyKyaTaskStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "modify")
        .resolves(responseFromModifyKyaTaskMock);

      // Act
      const result = await createKnowYourAir.updateTask(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "Task updated successfully");
      expect(result).to.have.property("data");
      expect(result.data).to.deep.equal(responseFromModifyKyaTaskMock.data);
      expect(result).to.not.have.property("errors");
      expect(result).to.have.property("status", httpStatus.OK);
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
      expect(
        modifyKyaTaskStub.calledWithExactly({
          filter: filterSuccessMock,
          update: requestMock.body,
          opts: { new: true },
        })
      ).to.be.true;
    });

    it("should return filter failure message when filter is not successful", async () => {
      // Arrange
      const generateFilterStub = sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns(filterFailureMock);

      // Act
      const result = await createKnowYourAir.updateTask(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Filter failed");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
    });

    it("should handle internal server error during task update", async () => {
      // Arrange
      const generateFilterStub = sinon
        .stub(createKnowYourAir, "generateFilter")
        .returns(filterSuccessMock);

      const modifyKyaTaskStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "modify")
        .throws(new Error("Internal Server Error"));

      // Act
      const result = await createKnowYourAir.updateTask(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(result).to.have.nested.property("errors.message");
      expect(generateFilterStub.calledWithExactly(requestMock)).to.be.true;
      expect(
        modifyKyaTaskStub.calledWithExactly({
          filter: filterSuccessMock,
          update: requestMock.body,
          opts: { new: true },
        })
      ).to.be.true;
    });

    // Add more test cases to cover other scenarios if needed
  });

  describe("createTask function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should create a new task successfully and send a Kafka message", async () => {
      // Arrange
      const registerKyaTaskStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "register")
        .resolves(responseFromRegisterKyaTaskSuccessMock);

      const kafkaProducerSendStub = sinon.stub().resolves();

      const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
        connect: sinon.stub().resolves(),
        send: kafkaProducerSendStub,
        disconnect: sinon.stub().resolves(),
      });

      // Act
      const result = await createKnowYourAir.createTask(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "Task created successfully");
      expect(result).to.have.property("data");
      expect(result.data).to.deep.equal(
        responseFromRegisterKyaTaskSuccessMock.data
      );
      expect(result).to.not.have.property("errors");
      expect(result).to.have.property("status", httpStatus.OK);
      expect(registerKyaTaskStub.calledWithExactly(requestMock.body)).to.be
        .true;

      // Ensure Kafka producer is called with the correct message
      expect(kafkaProducerStub.calledOnce).to.be.true;
      expect(kafkaProducerStub.args[0][0]).to.deep.equal({
        groupId: constants.UNIQUE_PRODUCER_GROUP,
      });

      expect(kafkaProducerSendStub.calledOnce).to.be.true;
      expect(kafkaProducerSendStub.args[0][0]).to.deep.equal({
        topic: constants.KYA_LESSON,
        messages: [
          {
            action: "create-kya-task",
            value: JSON.stringify(responseFromRegisterKyaTaskSuccessMock.data),
          },
        ],
      });
    });

    it("should handle failure during task creation", async () => {
      // Arrange
      const registerKyaTaskStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "register")
        .resolves(responseFromRegisterKyaTaskFailureMock);

      const kafkaProducerSendStub = sinon.stub().resolves();

      const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
        connect: sinon.stub().resolves(),
        send: kafkaProducerSendStub,
        disconnect: sinon.stub().resolves(),
      });

      // Act
      const result = await createKnowYourAir.createTask(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Task creation failed");
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal(
        responseFromRegisterKyaTaskFailureMock.errors
      );
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(registerKyaTaskStub.calledWithExactly(requestMock.body)).to.be
        .true;

      // Ensure Kafka producer is not called when task creation fails
      expect(kafkaProducerStub.called).to.be.false;
      expect(kafkaProducerSendStub.called).to.be.false;
    });

    it("should handle internal server error during task creation", async () => {
      // Arrange
      const registerKyaTaskStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "register")
        .throws(new Error("Internal Server Error"));

      // Act
      const result = await createKnowYourAir.createTask(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(result).to.have.nested.property("errors.message");
      expect(registerKyaTaskStub.calledWithExactly(requestMock.body)).to.be
        .true;
    });

    // Add more test cases to cover other scenarios if needed
  });

  describe("assignTaskToLesson function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should assign the task to the lesson successfully", async () => {
      // Arrange
      const taskExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "exists")
        .resolves(taskExistsMock);

      const lessonExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirLessonModel("testTenant"), "exists")
        .resolves(lessonExistsMock);

      const taskFindByIdStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "findById")
        .resolves(taskMock);

      const taskFindByIdAndUpdateStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirTaskModel("testTenant"),
          "findByIdAndUpdate"
        )
        .resolves(updatedTaskMock);

      // Act
      const result = await createKnowYourAir.assignTaskToLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "Task assigned to the Lesson");
      expect(result).to.have.property("data");
      expect(result.data).to.deep.equal(updatedTaskMock);
      expect(result).to.not.have.property("errors");
      expect(result).to.have.property("status", httpStatus.OK);

      expect(taskExistsStub.calledWithExactly({ _id: "task_id" })).to.be.true;
      expect(lessonExistsStub.calledWithExactly({ _id: "lesson_id" })).to.be
        .true;
      expect(taskFindByIdStub.calledWithExactly("task_id")).to.be.true;
      expect(
        taskFindByIdAndUpdateStub.calledWithExactly(
          "task_id",
          { kya_lesson: "lesson_id" },
          { new: true }
        )
      ).to.be.true;
    });

    it("should handle Task or Lesson not found", async () => {
      // Arrange
      const taskExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "exists")
        .resolves(false);

      const lessonExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirLessonModel("testTenant"), "exists")
        .resolves(false);

      // Act
      const result = await createKnowYourAir.assignTaskToLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Task or Lesson not found");
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal({
        message: "Task task_id or Lesson lesson_id are not found",
      });
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);

      expect(taskExistsStub.calledWithExactly({ _id: "task_id" })).to.be.true;
      expect(lessonExistsStub.calledWithExactly({ _id: "lesson_id" })).to.be
        .true;
    });

    it("should handle Task already assigned to the Lesson", async () => {
      // Arrange
      const taskExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "exists")
        .resolves(true);

      const lessonExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirLessonModel("testTenant"), "exists")
        .resolves(true);

      const taskFindByIdStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "findById")
        .resolves(updatedTaskMock);

      // Act
      const result = await createKnowYourAir.assignTaskToLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal({
        message: "Task task_id is already assigned to the Lesson lesson_id",
      });
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);

      expect(taskExistsStub.calledWithExactly({ _id: "task_id" })).to.be.true;
      expect(lessonExistsStub.calledWithExactly({ _id: "lesson_id" })).to.be
        .true;
      expect(taskFindByIdStub.calledWithExactly("task_id")).to.be.true;
    });

    it("should handle internal server error during task assignment", async () => {
      // Arrange
      const taskExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "exists")
        .throws(new Error("Internal Server Error"));

      // Act
      const result = await createKnowYourAir.assignTaskToLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Internal Server Error");
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(result).to.have.nested.property("errors.message");

      expect(taskExistsStub.calledWithExactly({ _id: "task_id" })).to.be.true;
    });

    // Add more test cases to cover other scenarios if needed
  });

  describe("assignManyTasksToLesson function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should assign tasks to the lesson successfully", async () => {
      // Arrange
      const lessonExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirLessonModel("testTenant"), "exists")
        .resolves(lessonExistsMock);

      const taskFindByIdStub = sinon.stub(
        createKnowYourAir.KnowYourAirTaskModel("testTenant"),
        "findById"
      );
      taskFindByIdStub.withArgs("task_id_1").resolves(taskMock1);
      taskFindByIdStub.withArgs("task_id_2").resolves(taskMock2);
      taskFindByIdStub.withArgs("task_id_3").resolves(taskMock3);

      const taskUpdateManyStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirTaskModel("testTenant"),
          "updateMany"
        )
        .resolves({ nModified: 2 });

      // Act
      const result = await createKnowYourAir.assignManyTasksToLesson(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully assigned all the provided tasks to the Lesson"
      );
      expect(result).to.have.property("status", httpStatus.OK);
      expect(result).to.have.property("data");
      expect(result.data)
        .to.be.an("array")
        .and.to.have.lengthOf(0);
      expect(result).to.not.have.property("errors");

      expect(lessonExistsStub.calledWithExactly({ _id: "lesson_id" })).to.be
        .true;
      expect(taskFindByIdStub.calledWithExactly("task_id_1")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id_2")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id_3")).to.be.true;

      expect(taskUpdateManyStub.calledOnce).to.be.true;
      expect(taskUpdateManyStub.args[0][0]).to.deep.equal({
        _id: { $in: ["task_id_1", "task_id_2", "task_id_3"] },
      });
      expect(taskUpdateManyStub.args[0][1]).to.deep.equal({
        kya_lesson: "lesson_id",
      });
    });

    it("should handle invalid lesson ID", async () => {
      // Arrange
      const lessonExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirLessonModel("testTenant"), "exists")
        .resolves(false);

      // Act
      const result = await createKnowYourAir.assignManyTasksToLesson(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal({
        message: "Invalid lesson ID lesson_id",
      });

      expect(lessonExistsStub.calledWithExactly({ _id: "lesson_id" })).to.be
        .true;
    });

    it("should handle invalid task ID", async () => {
      // Arrange
      const lessonExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirLessonModel("testTenant"), "exists")
        .resolves(lessonExistsMock);

      const taskFindByIdStub = sinon.stub(
        createKnowYourAir.KnowYourAirTaskModel("testTenant"),
        "findById"
      );
      taskFindByIdStub.withArgs("task_id_1").resolves(taskMock1);
      taskFindByIdStub.withArgs("task_id_2").resolves(null);

      // Act
      const result = await createKnowYourAir.assignManyTasksToLesson(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal({
        message: "Invalid Task ID task_id_2, please crosscheck",
      });

      expect(lessonExistsStub.calledWithExactly({ _id: "lesson_id" })).to.be
        .true;
      expect(taskFindByIdStub.calledWithExactly("task_id_1")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id_2")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id_3")).to.be.false; // task_id_3 is not called as it is already assigned to the lesson
    });

    it("should handle no matching tasks found", async () => {
      // Arrange
      const lessonExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirLessonModel("testTenant"), "exists")
        .resolves(lessonExistsMock);

      const taskFindByIdStub = sinon.stub(
        createKnowYourAir.KnowYourAirTaskModel("testTenant"),
        "findById"
      );
      taskFindByIdStub.withArgs("task_id_1").resolves(taskMock1);
      taskFindByIdStub.withArgs("task_id_2").resolves(taskMock2);
      taskFindByIdStub.withArgs("task_id_3").resolves(taskMock3);

      const taskUpdateManyStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirTaskModel("testTenant"),
          "updateMany"
        )
        .resolves({ nModified: 0 });

      // Act
      const result = await createKnowYourAir.assignManyTasksToLesson(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal({
        message: "No matching Task found in the system",
      });

      expect(lessonExistsStub.calledWithExactly({ _id: "lesson_id" })).to.be
        .true;
      expect(taskFindByIdStub.calledWithExactly("task_id_1")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id_2")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id_3")).to.be.true;

      expect(taskUpdateManyStub.calledOnce).to.be.true;
    });

    it("should handle partially successful assignment", async () => {
      // Arrange
      const lessonExistsStub = sinon
        .stub(createKnowYourAir.KnowYourAirLessonModel("testTenant"), "exists")
        .resolves(lessonExistsMock);

      const taskFindByIdStub = sinon.stub(
        createKnowYourAir.KnowYourAirTaskModel("testTenant"),
        "findById"
      );
      taskFindByIdStub.withArgs("task_id_1").resolves(taskMock1);
      taskFindByIdStub.withArgs("task_id_2").resolves(taskMock2);
      taskFindByIdStub.withArgs("task_id_3").resolves(taskMock3);

      const taskUpdateManyStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirTaskModel("testTenant"),
          "updateMany"
        )
        .resolves({ nModified: 1 });

      // Act
      const result = await createKnowYourAir.assignManyTasksToLesson(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "Operation partially successful some 1 of the provided tasks were not found in the system"
      );
      expect(result).to.have.property("status", httpStatus.OK);
      expect(result).to.not.have.property("errors");
      expect(result)
        .to.have.property("data")
        .to.be.an("array")
        .and.to.have.lengthOf(0);

      expect(lessonExistsStub.calledWithExactly({ _id: "lesson_id" })).to.be
        .true;
      expect(taskFindByIdStub.calledWithExactly("task_id_1")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id_2")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id_3")).to.be.true;

      expect(taskUpdateManyStub.calledOnce).to.be.true;
    });

    // Add more test cases as needed
  });

  describe("removeTaskFromLesson function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should remove task from lesson successfully", async () => {
      // Arrange
      const lessonFindByIdStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirLessonModel("testTenant"),
          "findById"
        )
        .resolves(lessonMock);
      const taskFindByIdStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "findById")
        .resolves(taskMock);
      const taskUpdateStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirTaskModel("testTenant"),
          "findByIdAndUpdate"
        )
        .resolves(taskMock);

      // Act
      const result = await createKnowYourAir.removeTaskFromLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "Successfully unassigned User from the Lesson"
      );
      expect(result).to.have.property("status", httpStatus.OK);
      expect(result).to.have.property("data");
      expect(result.data).to.deep.equal(taskMock);
      expect(result).to.not.have.property("errors");

      expect(lessonFindByIdStub.calledWithExactly("lesson_id")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id")).to.be.true;
      expect(
        taskUpdateStub.calledWithExactly(
          "task_id",
          { kya_lesson: null },
          { new: true }
        )
      ).to.be.true;
    });

    it("should handle invalid lesson ID", async () => {
      // Arrange
      const lessonFindByIdStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirLessonModel("testTenant"),
          "findById"
        )
        .resolves(null);

      // Act
      const result = await createKnowYourAir.removeTaskFromLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal({
        message: "Lesson lesson_id not found",
      });

      expect(lessonFindByIdStub.calledWithExactly("lesson_id")).to.be.true;
    });

    it("should handle invalid task ID", async () => {
      // Arrange
      const lessonFindByIdStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirLessonModel("testTenant"),
          "findById"
        )
        .resolves(lessonMock);
      const taskFindByIdStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "findById")
        .resolves(null);

      // Act
      const result = await createKnowYourAir.removeTaskFromLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal({
        message: "Task  task_id not found",
      });

      expect(lessonFindByIdStub.calledWithExactly("lesson_id")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id")).to.be.true;
    });

    it("should handle task not assigned to the lesson", async () => {
      // Arrange
      const lessonFindByIdStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirLessonModel("testTenant"),
          "findById"
        )
        .resolves(lessonMock);
      const taskFindByIdStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "findById")
        .resolves({ ...taskMock, kya_lesson: "some_other_lesson_id" });

      // Act
      const result = await createKnowYourAir.removeTaskFromLesson(requestMock);

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal({
        message: "Task task_id is not assigned to Lesson lesson_id",
      });

      expect(lessonFindByIdStub.calledWithExactly("lesson_id")).to.be.true;
      expect(taskFindByIdStub.calledWithExactly("task_id")).to.be.true;
    });

    // Add more test cases as needed
  });

  describe("removeManyTasksFromLesson function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should remove tasks from lesson successfully", async () => {
      // Arrange
      const lessonFindByIdStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirLessonModel("testTenant"),
          "findById"
        )
        .resolves(lessonMock);
      const taskFindStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "find")
        .resolves(taskMocks);
      const taskUpdateManyStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirTaskModel("testTenant"),
          "updateMany"
        )
        .resolves({ nModified: 2 });

      // Act
      const result = await createKnowYourAir.removeManyTasksFromLesson(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully unassigned all the provided  tasks from the lesson lesson_id"
      );
      expect(result).to.have.property("status", httpStatus.OK);
      expect(result).to.have.property("data");
      expect(result.data).to.deep.equal([]);
      expect(result).to.not.have.property("errors");

      expect(lessonFindByIdStub.calledWithExactly("lesson_id")).to.be.true;
      expect(
        taskFindStub.calledWithExactly(
          { _id: { $in: ["task_id1", "task_id2", "task_id3"] } },
          "_id"
        )
      ).to.be.true;
      expect(
        taskUpdateManyStub.calledWithExactly(
          { _id: { $in: ["task_id1", "task_id2"] } },
          { kya_lesson: null },
          { multi: true }
        )
      ).to.be.true;
    });

    it("should handle invalid lesson ID", async () => {
      // Arrange
      const lessonFindByIdStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirLessonModel("testTenant"),
          "findById"
        )
        .resolves(null);

      // Act
      const result = await createKnowYourAir.removeManyTasksFromLesson(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal({
        message: "Lesson lesson_id not found",
      });

      expect(lessonFindByIdStub.calledWithExactly("lesson_id")).to.be.true;
    });

    it("should handle some tasks not existing", async () => {
      // Arrange
      const lessonFindByIdStub = sinon
        .stub(
          createKnowYourAir.KnowYourAirLessonModel("testTenant"),
          "findById"
        )
        .resolves(lessonMock);
      const taskFindStub = sinon
        .stub(createKnowYourAir.KnowYourAirTaskModel("testTenant"), "find")
        .resolves(taskMocks.slice(0, 2));

      // Act
      const result = await createKnowYourAir.removeManyTasksFromLesson(
        requestMock
      );

      // Assert
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Bad Request Error");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.property("errors");
      expect(result.errors).to.deep.equal({
        message: "The following tasks do not exist: task_id3",
      });

      expect(lessonFindByIdStub.calledWithExactly("lesson_id")).to.be.true;
      expect(
        taskFindStub.calledWithExactly(
          { _id: { $in: ["task_id1", "task_id2", "task_id3"] } },
          "_id"
        )
      ).to.be.true;
    });

    // Add more test cases as needed
  });


  // Add tests for other functions in createKnowYourAir
});

describe("KYA QUIZ", () => {
  let quizStubValue = {
    _id: faker.datatype.uuid(),
    tenant: "test",
    user_id: faker.datatype.uuid(),
    title: faker.lorem.word(),
    description: faker.lorem.sentence(),
    image: faker.image.imageUrl(),
    completion_message: faker.lorem.sentence(),
  };

  let questionStubValue = {
    _id: faker.datatype.uuid(),
    tenant: "test",
    kya_quiz: faker.datatype.uuid(),
    title: faker.lorem.word(),
    context: faker.lorem.sentence(),
    quiz_position: faker.datatype.number(),
  };


  let answerStubValue = {
    _id: faker.datatype.uuid(),
    tenant: "test",
    kya_question: faker.datatype.uuid(),
    title: faker.lorem.word(),
    content: faker.lorem.sentence(),
  };

  const mockReq = {
    query: {
      tenant: "test",
      limit: 10,
      skip: 0,
    },
    params: {
      user_id: quizStubValue.user_id
    },
  }

  const mongooseStub = sinon.stub(mongoose, "model");
  describe("Quiz", () => {
    describe("List Quizzes", () => {


      it("should return the list of quizzes", async () => {
        const generateFilterStubQuiz = sinon.stub(generateFilterStub, "kyaquizzes").returns({
          _id: quizStubValue._id
        });
        const listStub = sinon.stub().resolves(quizStubValue);
        const knowYourAirMock = {
          list: listStub,
        };
        mongooseStub.returns(knowYourAirMock);
        const response = await createKnowYourAir.listQuiz(mockReq);
        expect(response).deep.equals(quizStubValue);

      });

      it("should handle error and return appropriate response", async () => {
        const errorMessage = "Test error message";
        const listStub = sinon.stub().rejects(new Error(errorMessage));
        const knowYourAirMock = {
          list: listStub,
        };
        mongooseStub.returns(knowYourAirMock);
        const response = await createKnowYourAir.listQuiz(mockReq);

        const expectedErrorResponse = {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: errorMessage },
        };
        expect(response).to.deep.equal(expectedErrorResponse);
      });
    });

    describe("Delete Quiz", () => {


      it("should delete the quiz", async () => {
        const generateFilterStubQuiz = sinon
          .stub(generateFilterStub, "kyaquizzes")
          .returns({
            _id: quizStubValue._id,
          });

        const removeStub = sinon.stub().resolves({ success: true });
        const knowYourAirMock = {
          remove: removeStub,
        };
        mongooseStub.returns(knowYourAirMock);

        const response = await createKnowYourAir.deleteQuiz(mockReq);
        expect(response).to.deep.equal({ success: true });

        generateFilterStubQuiz.restore();
      });

      it("should handle error and return appropriate response", async () => {
        const errorMessage = "Test error message";
        const removeStub = sinon.stub().rejects(new Error(errorMessage));
        const knowYourAirMock = {
          remove: removeStub,
        };
        mongooseStub.returns(knowYourAirMock);

        const response = await createKnowYourAir.deleteQuiz(mockReq);

        const expectedErrorResponse = {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: errorMessage },
        };
        expect(response).to.deep.equal(expectedErrorResponse);
      });

      afterEach(() => {
        mongooseStub.restore();
      });
    });

    describe("Update Quiz", () => {


      it("should update the quiz", async () => {
        const generateFilterStubQuiz = sinon
          .stub(generateFilterStub, "kyaquizzes")
          .returns({
            _id: quizStubValue._id,
          });

        const modifyStub = sinon.stub().resolves(quizStubValue);
        const knowYourAirMock = {
          modify: modifyStub,
        };
        mongooseStub.returns(knowYourAirMock);
        const response = await createKnowYourAir.updateQuiz(mockReq);
        expect(response).to.deep.equal(quizStubValue);

        generateFilterStubQuiz.restore();
      });

      it("should handle error and return appropriate response", async () => {
        const errorMessage = "Test error message";
        const modifyStub = sinon.stub().rejects(new Error(errorMessage));
        const knowYourAirMock = {
          modify: modifyStub,
        };
        mongooseStub.returns(knowYourAirMock);

        const response = await createKnowYourAir.updateQuiz(mockReq);

        const expectedErrorResponse = {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: errorMessage },
        };
        expect(response).to.deep.equal(expectedErrorResponse);
      });

      afterEach(() => {
        mongooseStub.restore();
      });
    });

    describe("Create Quiz", () => {


      it("should create a quiz and publish it to Kafka", async () => {
        const mockResponse = { success: true, data: quizStubValue };
        const registerStub = sinon.stub().resolves(mockResponse);
        const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
          connect: sinon.stub().resolves(),
          send: sinon.stub().resolves(),
          disconnect: sinon.stub().resolves(),
        });

        const knowYourAirMock = {
          register: registerStub,
        };
        mongooseStub.returns(knowYourAirMock);

        const mockCreateReq = { body: quizStubValue, query: { tenant: "test" } };
        const response = await createKnowYourAir.createQuiz(mockCreateReq);

        expect(registerStub.calledOnce).to.be.true;
        expect(kafkaProducerStub.calledOnce).to.be.true;
        expect(response).to.deep.equal(mockResponse);

        kafkaProducerStub.restore();
      });

      it("should handle error and return appropriate response", async () => {
        const errorMessage = "Test error message";
        const registerStub = sinon.stub().rejects(new Error(errorMessage));
        const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
          connect: sinon.stub().resolves(),
          send: sinon.stub().resolves(),
          disconnect: sinon.stub().resolves(),
        });

        const knowYourAirMock = {
          register: registerStub,
        };
        mongooseStub.returns(knowYourAirMock);

        const response = await createKnowYourAir.createQuiz(mockReq);

        const expectedErrorResponse = {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: errorMessage },
        };
        expect(response).to.deep.equal(expectedErrorResponse);

        kafkaProducerStub.restore();
      });

      afterEach(() => {
        mongooseStub.restore();
      });
    });


  })


  describe("Questions", () => {
    sinon.restore();
    describe("List Questions", () => {


      it("should return the list of questions", async () => {
        const generateFilterStubQuestions = sinon.stub(generateFilterStub, "kyaquestions").returns({
          _id: questionStubValue._id
        });
        const listStub = sinon.stub().resolves(questionStubValue);
        const knowYourAirMock = {
          list: listStub,
        };
        mongooseStub.returns(knowYourAirMock);
        const response = await createKnowYourAir.listQuestions(mockReq);
        expect(response).deep.equals(questionStubValue);

      });

      it("should handle error and return appropriate response", async () => {
        const errorMessage = "Test error message";
        const listStub = sinon.stub().rejects(new Error(errorMessage));
        const knowYourAirMock = {
          list: listStub,
        };
        mongooseStub.returns(knowYourAirMock);
        const response = await createKnowYourAir.listQuestions(mockReq);

        const expectedErrorResponse = {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: errorMessage },
        };
        expect(response).to.deep.equal(expectedErrorResponse);
      });
    });

    describe("Delete Question", () => {


      it("should delete the question", async () => {
        const generateFilterStubQuestion = sinon
          .stub(generateFilterStub, "kyaquestions")
          .returns({
            _id: questionStubValue._id,
          });

        const removeStub = sinon.stub().resolves({ success: true });
        const knowYourAirMock = {
          remove: removeStub,
        };
        mongooseStub.returns(knowYourAirMock);

        const response = await createKnowYourAir.deleteQuestion(mockReq);
        expect(response).to.deep.equal({ success: true });

        generateFilterStubQuestion.restore();
      });

      it("should handle error and return appropriate response", async () => {
        const errorMessage = "Test error message";
        const removeStub = sinon.stub().rejects(new Error(errorMessage));
        const knowYourAirMock = {
          remove: removeStub,
        };
        mongooseStub.returns(knowYourAirMock);

        const response = await createKnowYourAir.deleteQuestion(mockReq);

        const expectedErrorResponse = {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: errorMessage },
        };
        expect(response).to.deep.equal(expectedErrorResponse);
      });

      afterEach(() => {
        mongooseStub.restore();
      });
    });

    describe("Update Question", () => {


      it("should update the question", async () => {
        const generateFilterStubQuestion = sinon
          .stub(generateFilterStub, "kyaquestions")
          .returns({
            _id: questionStubValue._id,
          });

        const modifyStub = sinon.stub().resolves(questionStubValue);
        const knowYourAirMock = {
          modify: modifyStub,
        };
        mongooseStub.returns(knowYourAirMock);
        const response = await createKnowYourAir.updateQuestion(mockReq);
        expect(response).to.deep.equal(questionStubValue);

        generateFilterStubQuestion.restore();
      });

      it("should handle error and return appropriate response", async () => {
        const errorMessage = "Test error message";
        const modifyStub = sinon.stub().rejects(new Error(errorMessage));
        const knowYourAirMock = {
          modify: modifyStub,
        };
        mongooseStub.returns(knowYourAirMock);

        const response = await createKnowYourAir.updateQuestion(mockReq);

        const expectedErrorResponse = {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: errorMessage },
        };
        expect(response).to.deep.equal(expectedErrorResponse);
      });

      afterEach(() => {
        mongooseStub.restore();
      });
    });

    describe("Create Question", () => {


      it("should create a question and publish it to Kafka", async () => {
        const mockResponse = { success: true, data: questionStubValue };
        const registerStub = sinon.stub().resolves(mockResponse);
        const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
          connect: sinon.stub().resolves(),
          send: sinon.stub().resolves(),
          disconnect: sinon.stub().resolves(),
        });

        const knowYourAirMock = {
          register: registerStub,
        };
        mongooseStub.returns(knowYourAirMock);

        const mockCreateReq = { body: questionStubValue, query: { tenant: "test" } };
        const response = await createKnowYourAir.createQuestion(mockCreateReq);

        expect(registerStub.calledOnce).to.be.true;
        expect(kafkaProducerStub.calledOnce).to.be.true;
        expect(response).to.deep.equal(mockResponse);

        kafkaProducerStub.restore();
      });

      it("should handle error and return appropriate response", async () => {
        const errorMessage = "Test error message";
        const registerStub = sinon.stub().rejects(new Error(errorMessage));
        const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
          connect: sinon.stub().resolves(),
          send: sinon.stub().resolves(),
          disconnect: sinon.stub().resolves(),
        });

        const knowYourAirMock = {
          register: registerStub,
        };
        mongooseStub.returns(knowYourAirMock);

        const response = await createKnowYourAir.createQuestion(mockReq);

        const expectedErrorResponse = {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: errorMessage },
        };
        expect(response).to.deep.equal(expectedErrorResponse);

        kafkaProducerStub.restore();
      });

      afterEach(() => {
        mongooseStub.restore();
      });
    });
  })

  describe("Answers", () => {
    sinon.restore();
    describe("List Answers", () => {


      it("should return the list of answers", async () => {
        const generateFilterStubAnswers = sinon.stub(generateFilterStub, "kyaanswers").returns({
          _id: answerStubValue._id
        });
        const listStub = sinon.stub().resolves(answerStubValue);
        const knowYourAirMock = {
          list: listStub,
        };
        mongooseStub.returns(knowYourAirMock);
        const response = await createKnowYourAir.listAnswers(mockReq);
        expect(response).deep.equals(answerStubValue);

      });

      it("should handle error and return appropriate response", async () => {
        const errorMessage = "Test error message";
        const listStub = sinon.stub().rejects(new Error(errorMessage));
        const knowYourAirMock = {
          list: listStub,
        };
        mongooseStub.returns(knowYourAirMock);
        const response = await createKnowYourAir.listAnswers(mockReq);

        const expectedErrorResponse = {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: errorMessage },
        };
        expect(response).to.deep.equal(expectedErrorResponse);
      });

      describe("Delete Answer", () => {


        it("should delete the answer", async () => {
          const generateFilterStubAnswer = sinon
            .stub(generateFilterStub, "kyaanswers")
            .returns({
              _id: answerStubValue._id,
            });

          const removeStub = sinon.stub().resolves({ success: true });
          const knowYourAirMock = {
            remove: removeStub,
          };
          mongooseStub.returns(knowYourAirMock);

          const response = await createKnowYourAir.deleteAnswer(mockReq);
          expect(response).to.deep.equal({ success: true });

          generateFilterStubAnswer.restore();
        });

        it("should handle error and return appropriate response", async () => {
          const errorMessage = "Test error message";
          const removeStub = sinon.stub().rejects(new Error(errorMessage));
          const knowYourAirMock = {
            remove: removeStub,
          };
          mongooseStub.returns(knowYourAirMock);

          const response = await createKnowYourAir.deleteAnswer(mockReq);

          const expectedErrorResponse = {
            success: false,
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: { message: errorMessage },
          };
          expect(response).to.deep.equal(expectedErrorResponse);
        });

        afterEach(() => {
          mongooseStub.restore();
        });
      });

      describe("Update Answer", () => {


        it("should update the answer", async () => {
          const generateFilterStubAnswer = sinon
            .stub(generateFilterStub, "kyaanswers")
            .returns({
              _id: answerStubValue._id,
            });

          const modifyStub = sinon.stub().resolves(answerStubValue);
          const knowYourAirMock = {
            modify: modifyStub,
          };
          mongooseStub.returns(knowYourAirMock);
          const response = await createKnowYourAir.updateAnswer(mockReq);
          expect(response).to.deep.equal(answerStubValue);

          generateFilterStubAnswer.restore();
        });

        it("should handle error and return appropriate response", async () => {
          const errorMessage = "Test error message";
          const modifyStub = sinon.stub().rejects(new Error(errorMessage));
          const knowYourAirMock = {
            modify: modifyStub,
          };
          mongooseStub.returns(knowYourAirMock);

          const response = await createKnowYourAir.updateAnswer(mockReq);

          const expectedErrorResponse = {
            success: false,
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: { message: errorMessage },
          };
          expect(response).to.deep.equal(expectedErrorResponse);
        });

        afterEach(() => {
          mongooseStub.restore();
        });
      });

      describe("Create Answer", () => {


        it("should create a answer and publish it to Kafka", async () => {
          const mockResponse = { success: true, data: answerStubValue };
          const registerStub = sinon.stub().resolves(mockResponse);
          const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
            connect: sinon.stub().resolves(),
            send: sinon.stub().resolves(),
            disconnect: sinon.stub().resolves(),
          });

          const knowYourAirMock = {
            register: registerStub,
          };
          mongooseStub.returns(knowYourAirMock);

          const mockCreateReq = { body: answerStubValue, query: { tenant: "test" } };
          const response = await createKnowYourAir.createAnswer(mockCreateReq);

          expect(registerStub.calledOnce).to.be.true;
          expect(kafkaProducerStub.calledOnce).to.be.true;
          expect(response).to.deep.equal(mockResponse);

          kafkaProducerStub.restore();
        });

        it("should handle error and return appropriate response", async () => {
          const errorMessage = "Test error message";
          const registerStub = sinon.stub().rejects(new Error(errorMessage));
          const kafkaProducerStub = sinon.stub(kafka, "producer").returns({
            connect: sinon.stub().resolves(),
            send: sinon.stub().resolves(),
            disconnect: sinon.stub().resolves(),
          });

          const knowYourAirMock = {
            register: registerStub,
          };
          mongooseStub.returns(knowYourAirMock);

          const response = await createKnowYourAir.createAnswer(mockReq);

          const expectedErrorResponse = {
            success: false,
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: { message: errorMessage },
          };
          expect(response).to.deep.equal(expectedErrorResponse);

          kafkaProducerStub.restore();
        });

        afterEach(() => {
          mongooseStub.restore();
        });
      });
    });

    describe("UserQuizProgress", () => {
      sinon.restore();
      describe("List UserQuizProgress", () => {


        it("should return the list of UserProgress", async () => {
          const generateFilterStubProgress = sinon.stub(generateFilterStub, "kyaprogress").returns({
            _id: kyaProgressStubValue._id
          });
          const listStub = sinon.stub().resolves(kyaProgressStubValue);
          const knowYourAirMock = {
            list: listStub,
          };
          mongooseStub.returns(knowYourAirMock);
          const response = await createKnowYourAir.listUserQuizProgress(mockReq);
          expect(response).deep.equals(kyaProgressStubValue);

        });

        it("should handle error and return appropriate response", async () => {
          const errorMessage = "Test error message";
          const listStub = sinon.stub().rejects(new Error(errorMessage));
          const knowYourAirMock = {
            list: listStub,
          };
          mongooseStub.returns(knowYourAirMock);
          const response = await createKnowYourAir.listUserQuizProgress(mockReq);

          const expectedErrorResponse = {
            success: false,
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: { message: errorMessage },
          };
          expect(response).to.deep.equal(expectedErrorResponse);
        });
      });
    })

  })

});
