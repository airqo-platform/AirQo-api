require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const sinonChai = require("sinon-chai");

describe("updatePreferences", () => {
  let UserModel, PreferenceModel, SelectedSiteModel;

  beforeEach(() => {
    // Set up mocks
    try {
      sinon.stub(PreferenceModel.prototype, "find").resolves([]);
      sinon.stub(PreferenceModel.prototype, "create").resolves({});
      sinon.stub(PreferenceModel.prototype, "findOneAndUpdate").resolves({});

      sinon
        .stub(SelectedSiteModel.prototype, "find")
        .resolves([{ site_id: "site1" }, { site_id: "site2" }]);

      sinon
        .stub(UserModel.prototype, "find")
        .resolves([{ _id: "user1" }, { _id: "user2" }]);
    } catch (error) {
      console.error("Error in test setup:", error);
      throw error;
    }
  });

  afterEach(() => {
    // Restore mocks
    sinon.restore();
  });

  describe("successful execution", () => {
    it("should update preferences for users", async () => {
      await updatePreferences();

      expect(PreferenceModel.prototype.create).to.have.been.calledTwice;
      expect(PreferenceModel.prototype.findOneAndUpdate).to.have.been
        .calledOnce;
      expect(
        PreferenceModel.prototype.create.getCall(0).args[0]
      ).to.deep.equal(/* expected first create call args */);
      expect(
        PreferenceModel.prototype.create.getCall(1).args[0]
      ).to.deep.equal(/* expected second create call args */);
      expect(
        PreferenceModel.prototype.findOneAndUpdate.getCall(0).args
      ).to.deep.equal(/* expected findOneAndUpdate call args */);
    });
  });

  describe("error handling", () => {
    it("should log errors when creating preferences fails", async () => {
      const errorMock = new Error("Test error");
      sinon.stub(PreferenceModel.prototype, "create").rejects(errorMock);

      await updatePreferences();

      expect(logObject).to.have.been.calledWith("error", errorMock);
    });

    it("should log errors when updating preferences fails", async () => {
      const errorMock = new Error("Test error");
      sinon
        .stub(PreferenceModel.prototype, "findOneAndUpdate")
        .rejects(errorMock);

      await updatePreferences();

      expect(logObject).to.have.been.calledWith("error", errorMock);
    });

    it("should log errors when fetching selected sites fails", async () => {
      const errorMock = new Error("Test error");
      SelectedSiteModel.prototype.find.rejects(errorMock);

      await updatePreferences();

      expect(logObject).to.have.been.calledWith("error", errorMock);
    });

    it("should log errors when fetching users fails", async () => {
      const errorMock = new Error("Test error");
      UserModel.prototype.find.rejects(errorMock);

      await updatePreferences();

      expect(logObject).to.have.been.calledWith("error", errorMock);
    });
  });

  describe("edge cases", () => {
    it("should handle empty selected sites", async () => {
      sinon.stub(SelectedSiteModel.prototype, "find").resolves([]);

      await updatePreferences();

      expect(PreferenceModel.prototype.create).to.not.have.been.called;
    });

    it("should handle no users found", async () => {
      sinon.stub(UserModel.prototype, "find").resolves([]);

      await updatePreferences();

      expect(PreferenceModel.prototype.create).to.not.have.been.called;
    });

    it("should handle empty selected sites", async () => {
      SelectedSiteModel.prototype.find.resolves([]);

      await updatePreferences();

      expect(PreferenceModel.prototype.create).to.not.have.been.called;
      expect(logObject).to.have.been.calledWith(
        "info",
        "No selected sites found. Skipping preference update."
      );
    });

    it("should handle no users found", async () => {
      UserModel.prototype.find.resolves([]);

      await updatePreferences();

      expect(PreferenceModel.prototype.create).to.not.have.been.called;
      expect(logObject).to.have.been.calledWith(
        "info",
        "No users found. Skipping preference update."
      );
    });
  });
});
