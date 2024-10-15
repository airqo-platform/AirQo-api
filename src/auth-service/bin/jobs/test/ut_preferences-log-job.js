require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const sinonChai = require("sinon-chai");

describe("logUserPreferences", () => {
  let UserModel, PreferenceModel;

  beforeEach(() => {
    // Set up mocks
    UserModel = sinon.mock(UserModel);
    PreferenceModel = sinon.mock(PreferenceModel);

    sinon.stub(UserModel.prototype, "find").resolves(
      [
        { _id: "user1", email: "user1@example.com" },
        { _id: "user2", email: "user2@example.com" },
        { _id: "user3", email: "user3@example.com" },
      ].slice(0, 100)
    );

    sinon.stub(PreferenceModel.prototype, "find").resolves(
      [
        { _id: "pref1", user_id: "user1", selected_sites: ["site1"] },
        { _id: "pref2", user_id: "user2", selected_sites: [] },
        { _id: "pref3", user_id: "user3", selected_sites: undefined },
      ].slice(0, 100)
    );

    sinon.stub(stringify, "default").returns(JSON.stringify({}));

    sinon.stub(console, "info");
    sinon.stub(console, "error");
  });

  afterEach(() => {
    // Restore mocks
    UserModel.restore();
    PreferenceModel.restore();
    stringified.restore();
    console.info.restore();
    console.error.restore();
  });

  describe("successful execution", () => {
    it("should log the correct percentage of users without selected sites", async () => {
      await logUserPreferences();

      expect(UserModel.prototype.find).to.have.been.calledThrice;
      expect(PreferenceModel.prototype.find).to.have.been.calledThrice;
      expect(console.info).to.have.been.calledOnce;
      expect(console.info).to.have.been.calledWithMatch(
        "Total count of users without any Customised Locations:",
        "which is",
        "% of all Analytics users."
      );
    });
  });

  describe("no users found", () => {
    it("should not log anything when no users are found", async () => {
      sinon.stub(UserModel.prototype, "find").resolves([]);

      await logUserPreferences();

      expect(console.info).to.not.have.been.called;
    });
  });

  describe("error handling", () => {
    it("should log error when executing the function fails", async () => {
      sinon.stub(UserModel.prototype, "find").throws(new Error("Test error"));

      await logUserPreferences();

      expect(console.error).to.have.been.calledWith(
        `🐛🐛 Error in logUserPreferences: Test error`
      );
    });
  });

  describe("empty selected sites", () => {
    it("should count users with empty selected sites", async () => {
      sinon.stub(PreferenceModel.prototype, "find").resolves(
        [
          { _id: "pref1", user_id: "user1", selected_sites: [] },
          { _id: "pref2", user_id: "user2", selected_sites: undefined },
        ].slice(0, 100)
      );

      await logUserPreferences();

      expect(console.info).to.have.been.calledWithMatch(
        "Total count of users without any Customised Locations:",
        "which is",
        "% of all Analytics users."
      );
    });
  });

  describe("undefined selected sites", () => {
    it("should count users with undefined selected sites", async () => {
      sinon.stub(PreferenceModel.prototype, "find").resolves(
        [
          { _id: "pref1", user_id: "user1", selected_sites: null },
          { _id: "pref2", user_id: "user2", selected_sites: undefined },
        ].slice(0, 100)
      );

      await logUserPreferences();

      expect(console.info).to.have.been.calledWithMatch(
        "Total count of users without any Customised Locations:",
        "which is",
        "% of all Analytics users."
      );
    });
  });
});
