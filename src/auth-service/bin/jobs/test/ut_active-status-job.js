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
          lastLogin: new Date("2023-01-01T00:00:00Z"),
          isActive: true,
        },
        {
          _id: "user2",
          lastLogin: new Date("2023-02-01T00:00:00Z"),
          isActive: true,
        },
        { _id: "user3", lastLogin: null, isActive: true },
        {
          _id: "user4",
          lastLogin: new Date("2023-03-01T00:00:00Z"),
          isActive: false,
        },
        {
          _id: "user5",
          lastLogin: new Date("2023-04-01T00:00:00Z"),
          isActive: true,
        },
      ].slice(0, 100)
    );

    sinon
      .stub(UserModel.prototype, "updateMany")
      .resolves({ modifiedCount: 5 });

    sinon.stub(console, "error");
    sinon.stub(stringify, "default").returns(JSON.stringify({}));
  });

  afterEach(() => {
    // Restore mocks
    UserModel.restore();
    console.error.restore();
    stringify.default.restore();
  });

  describe("successful execution", () => {
    it("should mark inactive users and log results", async () => {
      await checkStatus();

      expect(UserModel.prototype.find).to.have.been.calledThrice;
      expect(UserModel.prototype.updateMany).to.have.been.calledWith(
        { _id: { $in: ["user1", "user2", "user3"] } },
        { isActive: false }
      );
      expect(console.error).to.not.have.been.called;
    });
  });

  describe("no inactive users found", () => {
    it("should not update any users when no inactive users are found", async () => {
      sinon.stub(UserModel.prototype, "find").resolves(
        [
          {
            _id: "user1",
            lastLogin: new Date("2023-05-01T00:00:00Z"),
            isActive: true,
          },
          {
            _id: "user2",
            lastLogin: new Date("2023-06-01T00:00:00Z"),
            isActive: true,
          },
        ].slice(0, 100)
      );

      await checkStatus();

      expect(UserModel.prototype.updateMany).to.not.have.been.called;
    });
  });

  describe("inactive threshold exceeded", () => {
    it("should mark users inactive based on last login time", async () => {
      sinon.stub(Date.now, "bind").returns(1697865600000); // Current timestamp
      sinon.stub(UserModel.prototype, "find").resolves(
        [
          {
            _id: "user1",
            lastLogin: new Date("2023-01-01T00:00:00Z"),
            isActive: true,
          },
          {
            _id: "user2",
            lastLogin: new Date("2023-02-01T00:00:00Z"),
            isActive: true,
          },
          { _id: "user3", lastLogin: null, isActive: true },
          {
            _id: "user4",
            lastLogin: new Date("2023-03-01T00:00:00Z"),
            isActive: true,
          },
        ].slice(0, 100)
      );

      await checkStatus();

      expect(UserModel.prototype.updateMany).to.have.been.calledWith(
        { _id: { $in: ["user1", "user2", "user3"] } },
        { isActive: false }
      );
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

  describe("isActive false users", () => {
    it("should skip already inactive users", async () => {
      sinon.stub(UserModel.prototype, "find").resolves(
        [
          {
            _id: "user1",
            lastLogin: new Date("2023-01-01T00:00:00Z"),
            isActive: false,
          },
          {
            _id: "user2",
            lastLogin: new Date("2023-02-01T00:00:00Z"),
            isActive: true,
          },
          { _id: "user3", lastLogin: null, isActive: true },
        ].slice(0, 100)
      );

      await checkStatus();

      expect(UserModel.prototype.updateMany).to.have.been.calledWith(
        { _id: { $in: ["user2", "user3"] } },
        { isActive: false }
      );
    });
  });
});
