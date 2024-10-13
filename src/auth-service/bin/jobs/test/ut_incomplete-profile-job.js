require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const sinonChai = require("sinon-chai");

describe("checkStatus", () => {
  let UserModel;

  beforeEach(() => {
    // Set up mocks
    UserModel = sinon.mock(UserModel);

    sinon.stub(UserModel.prototype, "find").resolves(
      [
        {
          _id: "user1",
          firstName: "Unknown",
          email: "user1@example.com",
          isActive: false,
        },
        {
          _id: "user2",
          firstName: "Unknown",
          email: "user2@example.com",
          isActive: true,
        },
        {
          _id: "user3",
          firstName: "John",
          email: "john@example.com",
          isActive: false,
        },
      ].slice(0, 100)
    );

    sinon.stub(console, "error");
    sinon.stub(stringify, "default").returns(JSON.stringify({}));
    sinon.stub(mailer.updateProfileReminder).resolves({
      success: true,
      data: {},
    });
  });

  afterEach(() => {
    // Restore mocks
    UserModel.restore();
    console.error.restore();
    stringify.default.restore();
    mailer.updateProfileReminder.restore();
  });

  describe("successful execution", () => {
    it("should process users and send emails successfully", async () => {
      await checkStatus();

      expect(UserModel.prototype.find).to.have.been.calledThrice;
      expect(mailer.updateProfileReminder).to.have.been.calledTwice;
      expect(console.error).to.not.have.been.called;
    });
  });

  describe("no users found", () => {
    it("should not log any errors when no users are found", async () => {
      sinon.stub(UserModel.prototype, "find").resolves([]);

      await checkStatus();

      expect(console.error).to.not.have.been.called;
    });
  });

  describe("email sending failure", () => {
    it("should log error when sending email fails", async () => {
      sinon.stub(mailer.updateProfileReminder).rejects(new Error("Test error"));

      await checkStatus();

      expect(console.error).to.have.been.calledTwice;
    });
  });

  describe("internal server error", () => {
    it("should log internal server error when executing the function fails", async () => {
      sinon.stub(UserModel.prototype, "find").throws(new Error("Test error"));

      await checkStatus();

      expect(console.error).to.have.been.calledWith(
        `Internal Server Error --- Test error`
      );
    });
  });

  describe("unknown firstName", () => {
    it("should skip users with known firstName", async () => {
      sinon.stub(UserModel.prototype, "find").resolves(
        [
          {
            _id: "user1",
            firstName: "John",
            email: "john@example.com",
            isActive: false,
          },
          {
            _id: "user2",
            firstName: "Unknown",
            email: "user2@example.com",
            isActive: true,
          },
          {
            _id: "user3",
            firstName: "Jane",
            email: "jane@example.com",
            isActive: false,
          },
        ].slice(0, 100)
      );

      await checkStatus();

      expect(mailer.updateProfileReminder).to.have.been.calledOnce;
    });
  });

  describe("active users", () => {
    it("should skip active users", async () => {
      sinon.stub(UserModel.prototype, "find").resolves(
        [
          {
            _id: "user1",
            firstName: "Unknown",
            email: "user1@example.com",
            isActive: true,
          },
          {
            _id: "user2",
            firstName: "Unknown",
            email: "user2@example.com",
            isActive: false,
          },
          {
            _id: "user3",
            firstName: "Unknown",
            email: "user3@example.com",
            isActive: true,
          },
        ].slice(0, 100)
      );

      await checkStatus();

      expect(mailer.updateProfileReminder).to.have.been.calledTwice;
    });
  });
});
