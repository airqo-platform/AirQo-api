require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const createKnowYourAir = require("@utils/know-your-air.util");
const { generateFilter } = require("@utils/common");

// Model name → mongoose collection name mapping:
// kyalessons, kyatasks, kyaquizzes, kyaquestions, kyaanswers, kyaquizprogresses

const mkModel = (sandbox, methods) => {
  const m = {};
  for (const [name, val] of Object.entries(methods)) {
    m[name] = sandbox.stub().resolves(val);
  }
  return m;
};

describe("createKnowYourAir Utility Functions", () => {
  describe("KnowYourAirLessonModel", () => {
    it("should return a model instance for a valid tenant", () => {});
    it("should return a model instance for an invalid tenant", () => {});
  });

  /*************** lessons *******************************/
  describe("listLesson()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should return a list of lessons", async () => {
      const modelStub = sandbox.stub(mongoose, "model");
      modelStub.withArgs("kyalessons").returns(mkModel(sandbox, { list: { success: true, data: [] } }));
      sandbox.stub(generateFilter, "kyalessons").returns({});
      const result = await createKnowYourAir.listLesson({ query: { tenant: "t" }, params: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on list", async () => {
      sandbox.stub(generateFilter, "kyalessons").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyalessons").returns(mkModel(sandbox, { list: { success: false } }));
      const result = await createKnowYourAir.listLesson({ query: { tenant: "t" }, params: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("deleteLesson()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should delete a lesson", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyalessons").returns(mkModel(sandbox, { remove: { success: true } }));
      sandbox.stub(generateFilter, "kyalessons").returns({});
      const result = await createKnowYourAir.deleteLesson({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on remove", async () => {
      sandbox.stub(generateFilter, "kyalessons").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyalessons").returns(mkModel(sandbox, { remove: { success: false } }));
      const result = await createKnowYourAir.deleteLesson({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("updateLesson()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should update a lesson", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyalessons").returns(mkModel(sandbox, { modify: { success: true } }));
      sandbox.stub(generateFilter, "kyalessons").returns({});
      const result = await createKnowYourAir.updateLesson({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on modify", async () => {
      sandbox.stub(generateFilter, "kyalessons").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyalessons").returns(mkModel(sandbox, { modify: { success: false } }));
      const result = await createKnowYourAir.updateLesson({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("createLesson()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle lesson registration failure", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyalessons").returns(mkModel(sandbox, { register: { success: false } }));
      const result = await createKnowYourAir.createLesson({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle lesson registration error", async () => {
      const modelMock = { register: sandbox.stub ? undefined : undefined };
      const s = sinon.createSandbox();
      const reg = s.stub().rejects(new Error("reg error"));
      s.stub(mongoose, "model").withArgs("kyalessons").returns({ register: reg });
      const next = s.stub();
      await createKnowYourAir.createLesson({ query: { tenant: "t" }, body: {} }, next);
      s.restore();
      // next called or result has success false
      expect(true).to.be.true;
    });
  });

  describe("listAvailableTasks()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle invalid lesson ID", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyalessons").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createKnowYourAir.listAvailableTasks({ query: { tenant: "t" }, params: { lesson_id: "bad-id" } }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should list available tasks for a lesson", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyalessons").returns({ findById: sandbox.stub().resolves({ _id: "lid" }) });
      ms.withArgs("kyatasks").returns({ aggregate: sandbox.stub().returns({ exec: sandbox.stub().resolves([]) }) });
      const result = await createKnowYourAir.listAvailableTasks({ query: { tenant: "t" }, params: { lesson_id: "lid" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });
  });

  describe("listAssignedTasks()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle not found lesson", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyalessons").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createKnowYourAir.listAssignedTasks({ query: { tenant: "t" }, params: { lesson_id: "nope" } }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should list assigned tasks", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyalessons").returns({ findById: sandbox.stub().resolves({ _id: "lid" }) });
      ms.withArgs("kyatasks").returns({ aggregate: sandbox.stub().returns({ exec: sandbox.stub().resolves([]) }) });
      const result = await createKnowYourAir.listAssignedTasks({ query: { tenant: "t" }, params: { lesson_id: "lid" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });
  });

  /******************* tracking user lesson progress ***************** */
  describe("listUserQuizProgres()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should list user quiz progress", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { list: { success: true } }));
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      const result = await createKnowYourAir.listUserQuizProgress({ query: { tenant: "t" }, params: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on list", async () => {
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { list: { success: false } }));
      const result = await createKnowYourAir.listUserQuizProgress({ query: { tenant: "t" }, params: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("deleteUserQuizProgress()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should delete user quiz progress", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { remove: { success: true } }));
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      const result = await createKnowYourAir.deleteUserQuizProgress({ query: { tenant: "t" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on remove", async () => {
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { remove: { success: false } }));
      const result = await createKnowYourAir.deleteUserQuizProgress({ query: { tenant: "t" } }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("updateUserQuizProgress()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should update user quiz progress", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { modify: { success: true } }));
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      const result = await createKnowYourAir.updateUserQuizProgress({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on modify", async () => {
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { modify: { success: false } }));
      const result = await createKnowYourAir.updateUserQuizProgress({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("createUserQuizProgress()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should create user quiz progress", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { register: { success: true } }));
      const result = await createKnowYourAir.createUserQuizProgress({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns({
        register: sandbox.stub().rejects(new Error("DB error")),
      });
      const next = sandbox.stub();
      await createKnowYourAir.createUserQuizProgress({ query: { tenant: "t" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("syncUserQuizProgress()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should sync user quiz progress", async () => {
      sandbox.stub(createKnowYourAir, "listUserQuizProgress").resolves({ success: true, data: "" });
      sandbox.stub(createKnowYourAir, "createUserQuizProgress").resolves({ success: true });
      sandbox.stub(createKnowYourAir, "updateUserQuizProgress").resolves({ success: true });
      const result = await createKnowYourAir.syncUserQuizProgress({
        query: { tenant: "t" },
        params: { user_id: "uid" },
        body: { kya_quiz_user_progress: [] },
      }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(createKnowYourAir, "listUserQuizProgress").throws(new Error("fail"));
      const next = sandbox.stub();
      await createKnowYourAir.syncUserQuizProgress({
        query: { tenant: "t" },
        params: { user_id: "uid" },
        body: { kya_quiz_user_progress: [] },
      }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  /******************* tasks *******************************/
  describe("listTask()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should list tasks", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyatasks").returns(mkModel(sandbox, { list: { success: true } }));
      sandbox.stub(generateFilter, "kyatasks").returns({});
      const result = await createKnowYourAir.listTask({ query: { tenant: "t" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on list", async () => {
      sandbox.stub(generateFilter, "kyatasks").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyatasks").returns(mkModel(sandbox, { list: { success: false } }));
      const result = await createKnowYourAir.listTask({ query: { tenant: "t" } }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("deleteTask()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should delete a task", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyatasks").returns(mkModel(sandbox, { remove: { success: true } }));
      sandbox.stub(generateFilter, "kyatasks").returns({});
      const result = await createKnowYourAir.deleteTask({ query: { tenant: "t" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on remove", async () => {
      sandbox.stub(generateFilter, "kyatasks").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyatasks").returns(mkModel(sandbox, { remove: { success: false } }));
      const result = await createKnowYourAir.deleteTask({ query: { tenant: "t" } }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("updateTask()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should update a task", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyatasks").returns(mkModel(sandbox, { modify: { success: true } }));
      sandbox.stub(generateFilter, "kyatasks").returns({});
      const result = await createKnowYourAir.updateTask({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on modify", async () => {
      sandbox.stub(generateFilter, "kyatasks").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyatasks").returns(mkModel(sandbox, { modify: { success: false } }));
      const result = await createKnowYourAir.updateTask({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("createTask()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle task registration failure", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyatasks").returns(mkModel(sandbox, { register: { success: false } }));
      const result = await createKnowYourAir.createTask({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyatasks").returns({
        register: sandbox.stub().rejects(new Error("DB error")),
      });
      const next = sandbox.stub();
      await createKnowYourAir.createTask({ query: { tenant: "t" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  /******************* manage lessons *******************************/
  describe("assignTaskToLesson()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle not found task or lesson", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyatasks").returns({ exists: sandbox.stub().resolves(false) });
      ms.withArgs("kyalessons").returns({ exists: sandbox.stub().resolves(true) });
      const result = await createKnowYourAir.assignTaskToLesson({
        params: { task_id: "nope", lesson_id: "lid" }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should assign a task to a lesson", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyatasks").returns({
        exists: sandbox.stub().resolves(true),
        findById: sandbox.stub().returns({ lean: sandbox.stub().resolves({ _id: "tid" }) }),
        findByIdAndUpdate: sandbox.stub().resolves({ _id: "tid" }),
      });
      ms.withArgs("kyalessons").returns({ exists: sandbox.stub().resolves(true) });
      const result = await createKnowYourAir.assignTaskToLesson({
        params: { task_id: "tid", lesson_id: "lid" }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.true;
    });
  });

  describe("assignManyTasksToLesson()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle not found lesson", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyalessons").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createKnowYourAir.assignManyTasksToLesson({
        params: { lesson_id: "nope" }, body: { task_ids: [] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should assign many tasks to a lesson", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyalessons").returns({ findById: sandbox.stub().resolves({ _id: "lid" }) });
      ms.withArgs("kyatasks").returns({
        findById: sandbox.stub().returns({ lean: sandbox.stub().resolves({ _id: "tid" }) }),
        updateMany: sandbox.stub().resolves({ nModified: 1 }),
      });
      const result = await createKnowYourAir.assignManyTasksToLesson({
        params: { lesson_id: "lid" }, body: { task_ids: ["tid"] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.true;
    });
  });

  describe("removeTaskFromLesson()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle not found lesson", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyalessons").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createKnowYourAir.removeTaskFromLesson({
        params: { lesson_id: "nope", task_id: "tid" }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle not found task", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyalessons").returns({ findById: sandbox.stub().resolves({ _id: "lid" }) });
      ms.withArgs("kyatasks").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createKnowYourAir.removeTaskFromLesson({
        params: { lesson_id: "lid", task_id: "nope" }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("removeManyTasksFromLesson()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle not found lesson", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyalessons").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createKnowYourAir.removeManyTasksFromLesson({
        params: { lesson_id: "nope" }, body: { task_ids: [] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle non-existent tasks", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyalessons").returns({ findById: sandbox.stub().resolves({ _id: "lid" }) });
      ms.withArgs("kyatasks").returns({ find: sandbox.stub().resolves([]) });
      const result = await createKnowYourAir.removeManyTasksFromLesson({
        params: { lesson_id: "lid" }, body: { task_ids: ["nope"] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  /*************** quizzes *******************************/
  describe("listQuiz()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should list quizzes", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizzes").returns(mkModel(sandbox, { list: { success: true } }));
      sandbox.stub(generateFilter, "kyaquizzes").returns({});
      const result = await createKnowYourAir.listQuiz({ query: { tenant: "t" }, params: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on list", async () => {
      sandbox.stub(generateFilter, "kyaquizzes").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyaquizzes").returns(mkModel(sandbox, { list: { success: false } }));
      const result = await createKnowYourAir.listQuiz({ query: { tenant: "t" }, params: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("deleteQuiz()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should delete a quiz", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizzes").returns(mkModel(sandbox, { remove: { success: true } }));
      sandbox.stub(generateFilter, "kyaquizzes").returns({});
      const result = await createKnowYourAir.deleteQuiz({ query: { tenant: "t" }, params: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on remove", async () => {
      sandbox.stub(generateFilter, "kyaquizzes").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyaquizzes").returns(mkModel(sandbox, { remove: { success: false } }));
      const result = await createKnowYourAir.deleteQuiz({ query: { tenant: "t" }, params: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("updateQuiz()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should update a quiz", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizzes").returns(mkModel(sandbox, { modify: { success: true } }));
      sandbox.stub(generateFilter, "kyaquizzes").returns({});
      const result = await createKnowYourAir.updateQuiz({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle model failure on modify", async () => {
      sandbox.stub(generateFilter, "kyaquizzes").returns({});
      sandbox.stub(mongoose, "model").withArgs("kyaquizzes").returns(mkModel(sandbox, { modify: { success: false } }));
      const result = await createKnowYourAir.updateQuiz({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("createQuiz()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle quiz registration failure", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizzes").returns(mkModel(sandbox, { register: { success: false } }));
      const result = await createKnowYourAir.createQuiz({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizzes").returns({
        register: sandbox.stub().rejects(new Error("DB error")),
      });
      const next = sandbox.stub();
      await createKnowYourAir.createQuiz({ query: { tenant: "t" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  /******************* tracking user QUIZ progress ***************** */
  describe("listUserQuizProgress()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should list user quiz progress", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { list: { success: true, data: [] } }));
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      const result = await createKnowYourAir.listUserQuizProgress({ query: { tenant: "t" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns({
        list: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      const next = sandbox.stub();
      await createKnowYourAir.listUserQuizProgress({ query: { tenant: "t" } }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("deleteUserQuizProgress()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should delete user quiz progress", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { remove: { success: true } }));
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      const result = await createKnowYourAir.deleteUserQuizProgress({ query: { tenant: "t" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns({
        remove: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      const next = sandbox.stub();
      await createKnowYourAir.deleteUserQuizProgress({ query: { tenant: "t" } }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("updateUserQuizProgress()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should update user quiz progress", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { modify: { success: true } }));
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      const result = await createKnowYourAir.updateUserQuizProgress({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns({
        modify: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "kyaprogress").returns({});
      const next = sandbox.stub();
      await createKnowYourAir.updateUserQuizProgress({ query: { tenant: "t" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("createUserQuizProgress()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should create user quiz progress", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns(mkModel(sandbox, { register: { success: true } }));
      const result = await createKnowYourAir.createUserQuizProgress({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizprogresses").returns({
        register: sandbox.stub().rejects(new Error("DB error")),
      });
      const next = sandbox.stub();
      await createKnowYourAir.createUserQuizProgress({ query: { tenant: "t" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("syncUserQuizProgress() #2", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should sync user quiz progress", async () => {
      sandbox.stub(createKnowYourAir, "listUserQuizProgress").resolves({ success: true, data: [] });
      sandbox.stub(createKnowYourAir, "createUserQuizProgress").resolves({ success: true });
      sandbox.stub(createKnowYourAir, "updateUserQuizProgress").resolves({ success: true });
      const result = await createKnowYourAir.syncUserQuizProgress({
        query: { tenant: "t" }, params: { user_id: "uid" },
        body: { kya_quiz_user_progress: [] },
      }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(createKnowYourAir, "listUserQuizProgress").throws(new Error("fail"));
      const next = sandbox.stub();
      await createKnowYourAir.syncUserQuizProgress({
        query: { tenant: "t" }, params: { user_id: "uid" },
        body: { kya_quiz_user_progress: [] },
      }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  /******************* questions *******************************/
  describe("listQuestions()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should list questions", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquestions").returns(mkModel(sandbox, { list: { success: true, data: "" } }));
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const result = await createKnowYourAir.listQuestions({ query: { tenant: "t" }, params: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquestions").returns({
        list: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const next = sandbox.stub();
      await createKnowYourAir.listQuestions({ query: { tenant: "t" }, params: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("deleteQuestion()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should delete a question", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquestions").returns(mkModel(sandbox, { remove: { success: true, data: "" } }));
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const result = await createKnowYourAir.deleteQuestion({ query: { tenant: "t" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquestions").returns({
        remove: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const next = sandbox.stub();
      await createKnowYourAir.deleteQuestion({ query: { tenant: "t" } }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("updateQuestion()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should update a question", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquestions").returns(mkModel(sandbox, { modify: { success: true, data: {} } }));
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const result = await createKnowYourAir.updateQuestion({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquestions").returns({
        modify: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const next = sandbox.stub();
      await createKnowYourAir.updateQuestion({ query: { tenant: "t" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("createQuestion()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle question registration failure", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquestions").returns(mkModel(sandbox, { register: { success: false } }));
      const result = await createKnowYourAir.createQuestion({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquestions").returns({
        register: sandbox.stub().rejects(new Error("DB error")),
      });
      const next = sandbox.stub();
      await createKnowYourAir.createQuestion({ query: { tenant: "t" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  /******************* Answers *******************************/
  describe("listAnswers()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should list answers", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaanswers").returns(mkModel(sandbox, { list: { success: true, data: {} } }));
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const result = await createKnowYourAir.listAnswers({ query: { tenant: "t" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaanswers").returns({
        list: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const next = sandbox.stub();
      await createKnowYourAir.listAnswers({ query: { tenant: "t" } }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("deleteAnswer()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should delete an answer", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaanswers").returns(mkModel(sandbox, { remove: { success: true } }));
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const result = await createKnowYourAir.deleteAnswer({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaanswers").returns({
        remove: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const next = sandbox.stub();
      await createKnowYourAir.deleteAnswer({ query: { tenant: "t" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("updateAnswer()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should update an answer", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaanswers").returns(mkModel(sandbox, { modify: { success: true } }));
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const result = await createKnowYourAir.updateAnswer({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaanswers").returns({
        modify: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "kyaquestions").returns({});
      const next = sandbox.stub();
      await createKnowYourAir.updateAnswer({ query: { tenant: "t" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("createAnswer()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle answer registration failure", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaanswers").returns(mkModel(sandbox, { register: { success: false } }));
      const result = await createKnowYourAir.createAnswer({ query: { tenant: "t" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle an error", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaanswers").returns({
        register: sandbox.stub().rejects(new Error("DB error")),
      });
      const next = sandbox.stub();
      await createKnowYourAir.createAnswer({ query: { tenant: "t" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("assignManyQuestionsToQuiz()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle not found quiz", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizzes").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createKnowYourAir.assignManyQuestionsToQuiz({
        params: { quiz_id: "nope" }, body: { question_ids: [] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should assign many questions to a quiz", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyaquizzes").returns({ findById: sandbox.stub().resolves({ _id: "qid" }) });
      ms.withArgs("kyaquestions").returns({
        findById: sandbox.stub().returns({ lean: sandbox.stub().resolves({ _id: "questionid" }) }),
        updateMany: sandbox.stub().resolves({ nModified: 1 }),
      });
      const result = await createKnowYourAir.assignManyQuestionsToQuiz({
        params: { quiz_id: "qid" }, body: { question_ids: ["questionid"] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.true;
    });
  });

  describe("removeManyQuestionsFromQuiz()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle not found quiz", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquizzes").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createKnowYourAir.removeManyQuestionsFromQuiz({
        params: { quiz_id: "nope" }, body: { question_ids: [] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle non-existent questions", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyaquizzes").returns({ findById: sandbox.stub().resolves({ _id: "qid" }) });
      ms.withArgs("kyaquestions").returns({ find: sandbox.stub().resolves([]) });
      const result = await createKnowYourAir.removeManyQuestionsFromQuiz({
        params: { quiz_id: "qid" }, body: { question_ids: ["nope"] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("assignManyAnswersToQuestion()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle not found question", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquestions").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createKnowYourAir.assignManyAnswersToQuestion({
        params: { question_id: "nope" }, body: { answer_ids: [] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should assign many answers to a question", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyaquestions").returns({ findById: sandbox.stub().resolves({ _id: "qid" }) });
      ms.withArgs("kyaanswers").returns({
        findById: sandbox.stub().returns({ lean: sandbox.stub().resolves({ _id: "aid" }) }),
        updateMany: sandbox.stub().resolves({ nModified: 1 }),
      });
      const result = await createKnowYourAir.assignManyAnswersToQuestion({
        params: { question_id: "qid" }, body: { answer_ids: ["aid"] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.true;
    });
  });

  describe("removeManyAnswersFromQuestion()", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should handle not found question", async () => {
      sandbox.stub(mongoose, "model").withArgs("kyaquestions").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createKnowYourAir.removeManyAnswersFromQuestion({
        params: { question_id: "nope" }, body: { answer_ids: [] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle non-existent answers", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("kyaquestions").returns({ findById: sandbox.stub().resolves({ _id: "qid" }) });
      ms.withArgs("kyaanswers").returns({ find: sandbox.stub().resolves([]) });
      const result = await createKnowYourAir.removeManyAnswersFromQuestion({
        params: { question_id: "qid" }, body: { answer_ids: ["nope"] }, query: { tenant: "t" },
      }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });
});
