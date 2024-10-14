require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const sinonChai = require("sinon-chai");

describe("sendAlertsForExpiringTokens", () => {
  let AccessTokenModel;

  beforeEach(() => {
    // Set up mocks
    AccessTokenModel = sinon.mock(AccessTokenModel);
    sinon.stub(AccessTokenModel.prototype, "getExpiringTokens").returns(
      Promise.resolve({
        success: true,
        data: [
          {
            user: {
              email: "test@example.com",
              firstName: "John",
              lastName: "Doe",
            },
          },
          {
            user: {
              email: "test2@example.com",
              firstName: "Jane",
              lastName: "Smith",
            },
          },
        ],
      })
    );

    sinon.stub(console, "info");
    sinon.stub(console, "error");
  });

  afterEach(() => {
    // Restore mocks
    AccessTokenModel.restore();
    console.info.restore();
    console.error.restore();
  });

  describe("successful execution", () => {
    it("should fetch expiring tokens and send emails", async () => {
      await sendAlertsForExpiringTokens();

      expect(AccessTokenModel.prototype.getExpiringTokens).to.have.been
        .calledOnce;
      expect(
        AccessTokenModel.prototype.getExpiringTokens
      ).to.have.been.calledWith({
        skip: 0,
        limit: 100,
      });

      const emailPromises = [
        {
          user: {
            email: "test@example.com",
            firstName: "John",
            lastName: "Doe",
          },
        },
        {
          user: {
            email: "test2@example.com",
            firstName: "Jane",
            lastName: "Smith",
          },
        },
      ];

      expect(mailer.expandingToken).to.have.been.calledTwice;
      expect(mailer.expandingToken).to.have.been.calledWithMatch({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      });
      expect(mailer.expandingToken).to.have.been.calledWithMatch({
        email: "test2@example.com",
        firstName: "Jane",
        lastName: "Smith",
      });
    });
  });

  describe("no expiring tokens found", () => {
    it("should log info message when no tokens are found", async () => {
      AccessTokenModel.mock().getExpiringTokens.resolves({
        success: true,
        data: [],
      });

      await sendAlertsForExpiringTokens();

      expect(console.info).to.have.been.calledWith(
        "No expiring tokens found for this month."
      );
    });
  });

  describe("error handling", () => {
    it("should log error when fetching tokens fails", async () => {
      AccessTokenModel.mock().getExpiringTokens.rejects(
        new Error("Test error")
      );

      await sendAlertsForExpiringTokens();

      expect(console.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error -- Test error`
      );
    });
  });
});
