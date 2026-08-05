require("module-alias/register");

process.env.CLOUD_NAME = process.env.CLOUD_NAME || "test-cloud";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "test-key";
process.env.CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET || "test-secret";

const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
chai.use(require("sinon-chai"));

const createUserUtil = require("@utils/user.util");
const tokenUtil = require("@utils/token.util");

const createUser = rewire("@controllers/user.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createUserController", () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: { tenant: "airqo" }, body: {}, params: {}, headers: {} };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
      send: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    createUser.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("listStatistics", () => {
    it("should return a list of user statistics when validation passes", async () => {
      sinon.stub(createUserUtil, "listStatistics").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success",
        data: [{ userStats: "example" }],
      });

      await createUser.listStatistics(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.listStatistics(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "listStatistics").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Error" },
      });
      await createUser.listStatistics(req, res, next);
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "listStatistics").rejects(new Error("DB error"));
      await createUser.listStatistics(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listLogs", () => {
    it("should return a list of logs when validation passes", async () => {
      sinon.stub(createUserUtil, "listLogs").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success",
        data: [{ logData: "example" }],
      });

      await createUser.listLogs(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.listLogs(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "listLogs").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Error" },
      });
      await createUser.listLogs(req, res, next);
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "listLogs").rejects(new Error("DB error"));
      await createUser.listLogs(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list", () => {
    it("should return a list of users when validation passes", async () => {
      sinon.stub(createUserUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success",
        data: [{ userData: "example" }],
      });

      await createUser.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, users: sinon.match.array })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.list(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "list").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Error" },
      });
      await createUser.list(req, res, next);
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "list").rejects(new Error("DB error"));
      await createUser.list(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("verifyEmail", () => {
    it("should verify email successfully", async () => {
      sinon.stub(tokenUtil, "verifyEmail").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Email verified successfully",
        data: { verified: true },
      });

      await createUser.verifyEmail(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.verifyEmail(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(tokenUtil, "verifyEmail").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Verification failed",
        errors: { message: "Error" },
      });
      await createUser.verifyEmail(req, res, next);
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(tokenUtil, "verifyEmail").rejects(new Error("DB error"));
      await createUser.verifyEmail(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("deleteMobileUserData", () => {
    it("should delete app data successfully", async () => {
      sinon.stub(createUserUtil, "deleteMobileUserData").resolves({
        success: true,
        status: httpStatus.OK,
        message: "App data deleted",
        data: { deleted: true },
      });

      await createUser.deleteMobileUserData(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.deleteMobileUserData(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "deleteMobileUserData").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Error" },
      });
      await createUser.deleteMobileUserData(req, res, next);
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "deleteMobileUserData").rejects(new Error("DB error"));
      await createUser.deleteMobileUserData(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("lookUpFirebaseUser", () => {
    it("should return existing user when request is valid", async () => {
      sinon.stub(createUserUtil, "lookUpFirebaseUser").resolves([{
        success: true,
        status: httpStatus.OK,
        message: "User found",
        data: { uid: "user123" },
      }]);

      await createUser.lookUpFirebaseUser(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, user: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.lookUpFirebaseUser(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "lookUpFirebaseUser").resolves([{
        success: false,
        status: httpStatus.NOT_FOUND,
        message: "User not found",
        errors: { message: "Error" },
      }]);
      await createUser.lookUpFirebaseUser(req, res, next);
      expect(res.status.calledWith(httpStatus.NOT_FOUND)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "lookUpFirebaseUser").rejects(new Error("DB error"));
      await createUser.lookUpFirebaseUser(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("loginWithFirebase", () => {
    it("should login with Firebase successfully", async () => {
      sinon.stub(createUserUtil, "loginWithFirebase").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Login successful",
        data: { token: "firebase_token" },
      });

      await createUser.loginWithFirebase(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.loginWithFirebase(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle login failure", async () => {
      sinon.stub(createUserUtil, "loginWithFirebase").resolves({
        success: false,
        status: httpStatus.UNAUTHORIZED,
        message: "Login failed",
        errors: { message: "Invalid credentials" },
      });
      await createUser.loginWithFirebase(req, res, next);
      expect(res.status.calledWith(httpStatus.UNAUTHORIZED)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "loginWithFirebase").rejects(new Error("Firebase error"));
      await createUser.loginWithFirebase(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("createFirebaseUser", () => {
    it("should create Firebase user successfully", async () => {
      sinon.stub(createUserUtil, "createFirebaseUser").resolves([{
        success: true,
        status: httpStatus.OK,
        message: "User created",
        data: { uid: "new_user123" },
      }]);

      await createUser.createFirebaseUser(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, user: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.createFirebaseUser(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "createFirebaseUser").rejects(new Error("Firebase error"));
      await createUser.createFirebaseUser(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("sendFeedback", () => {
    it("should send feedback successfully", async () => {
      sinon.stub(createUserUtil, "sendFeedback").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Feedback sent successfully",
        data: { sent: true },
      });

      await createUser.sendFeedback(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.sendFeedback(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "sendFeedback").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to send feedback",
        errors: { message: "Error" },
      });
      await createUser.sendFeedback(req, res, next);
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "sendFeedback").rejects(new Error("Email error"));
      await createUser.sendFeedback(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("forgot", () => {
    it("should process forgot password request successfully", async () => {
      sinon.stub(createUserUtil, "forgotPassword").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Reset email sent",
        data: { email: "user@example.com" },
      });

      await createUser.forgot(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.forgot(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "forgotPassword").resolves({
        success: false,
        status: httpStatus.NOT_FOUND,
        message: "User not found",
        errors: { message: "Error" },
      });
      await createUser.forgot(req, res, next);
      expect(res.status.calledWith(httpStatus.NOT_FOUND)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "forgotPassword").rejects(new Error("DB error"));
      await createUser.forgot(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("register", () => {
    it("should register user successfully", async () => {
      sinon.stub(createUserUtil, "register").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User registered successfully",
        data: { _id: "user123", email: "user@example.com" },
      });

      await createUser.register(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, user: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.register(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "register").resolves({
        success: false,
        status: httpStatus.CONFLICT,
        message: "User already exists",
        errors: { message: "Error" },
      });
      await createUser.register(req, res, next);
      expect(res.status.calledWith(httpStatus.CONFLICT)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "register").rejects(new Error("DB error"));
      await createUser.register(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("create", () => {
    it("should create user successfully", async () => {
      sinon.stub(createUserUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User created successfully",
        data: { _id: "user123", email: "user@example.com" },
      });

      await createUser.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, user: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.create(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "User creation failed",
        errors: { message: "Error" },
      });
      await createUser.create(req, res, next);
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "create").rejects(new Error("DB error"));
      await createUser.create(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete", () => {
    it("should delete user successfully", async () => {
      sinon.stub(createUserUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User deleted successfully",
        data: { _id: "user123" },
      });

      await createUser.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, user: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.delete(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "delete").resolves({
        success: false,
        status: httpStatus.NOT_FOUND,
        message: "User not found",
        errors: { message: "Error" },
      });
      await createUser.delete(req, res, next);
      expect(res.status.calledWith(httpStatus.NOT_FOUND)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "delete").rejects(new Error("DB error"));
      await createUser.delete(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update", () => {
    it("should update user successfully", async () => {
      sinon.stub(createUserUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User updated successfully",
        data: { _id: "user123", email: "updated@example.com" },
      });

      await createUser.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, user: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.update(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "update").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Update failed",
        errors: { message: "Error" },
      });
      await createUser.update(req, res, next);
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "update").rejects(new Error("DB error"));
      await createUser.update(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("signUpWithFirebase", () => {
    it("should sign up with Firebase successfully", async () => {
      sinon.stub(createUserUtil, "signUpWithFirebase").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Sign up successful",
        data: { uid: "user123", email: "user@example.com" },
      });

      await createUser.signUpWithFirebase(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, user: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createUser.__set__("extractErrorsFromRequest", mockBadRequest);
      await createUser.signUpWithFirebase(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle util failure", async () => {
      sinon.stub(createUserUtil, "signUpWithFirebase").resolves({
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Sign up failed",
        errors: { message: "Invalid request" },
      });
      await createUser.signUpWithFirebase(req, res, next);
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createUserUtil, "signUpWithFirebase").rejects(new Error("Firebase error"));
      await createUser.signUpWithFirebase(req, res, next);
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("updateForgottenPassword", () => {
    it("should return success response when password is updated", async () => {
      sinon.stub(createUserUtil, "updateForgottenPassword").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Password updated successfully",
        data: { _id: "userId" },
      });

      await createUser.updateForgottenPassword(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Password updated successfully",
          user: { _id: "userId" },
        })
      ).to.be.true;
    });

    it("should return failure response when util returns error", async () => {
      sinon.stub(createUserUtil, "updateForgottenPassword").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to update forgotten password",
        errors: { message: "Failed to update forgotten password" },
      });

      await createUser.updateForgottenPassword(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to update forgotten password",
          errors: { message: "Failed to update forgotten password" },
        })
      ).to.be.true;
    });

    it("should call next with HttpError when util throws", async () => {
      sinon
        .stub(createUserUtil, "updateForgottenPassword")
        .rejects(new Error("DB error"));

      await createUser.updateForgottenPassword(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(Error);
    });
  });

  describe("updateKnownPassword", () => {
    it("should return success response when password is updated", async () => {
      sinon.stub(createUserUtil, "updateKnownPassword").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Password updated successfully",
        data: { _id: "userId" },
      });

      await createUser.updateKnownPassword(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Password updated successfully",
          user: { _id: "userId" },
        })
      ).to.be.true;
    });

    it("should return failure response when util returns error", async () => {
      sinon.stub(createUserUtil, "updateKnownPassword").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to update known password",
        errors: { message: "Failed to update known password" },
      });

      await createUser.updateKnownPassword(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to update known password",
          errors: { message: "Failed to update known password" },
        })
      ).to.be.true;
    });

    it("should call next with HttpError when util throws", async () => {
      sinon
        .stub(createUserUtil, "updateKnownPassword")
        .rejects(new Error("DB error"));

      await createUser.updateKnownPassword(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(Error);
    });
  });

  describe("subscribeToNewsLetter", () => {
    it("should return success response when user is subscribed", async () => {
      sinon.stub(createUserUtil, "subscribeToNewsLetter").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Successfully subscribed to the newsletter",
      });

      await createUser.subscribeToNewsLetter(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Successfully subscribed to the newsletter",
        })
      ).to.be.true;
    });

    it("should return failure response when util returns error", async () => {
      sinon.stub(createUserUtil, "subscribeToNewsLetter").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to subscribe to the newsletter",
        errors: { message: "Failed to subscribe to the newsletter" },
      });

      await createUser.subscribeToNewsLetter(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to subscribe to the newsletter",
          errors: { message: "Failed to subscribe to the newsletter" },
        })
      ).to.be.true;
    });

    it("should call next with HttpError when util throws", async () => {
      sinon
        .stub(createUserUtil, "subscribeToNewsLetter")
        .rejects(new Error("DB error"));

      await createUser.subscribeToNewsLetter(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(Error);
    });
  });

  describe("verifyFirebaseCustomToken", () => {
    it("should return success response when token is verified", async () => {
      sinon.stub(createUserUtil, "verifyFirebaseCustomToken").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Verification successful",
        data: { name: "John Doe", email: "example@example.com" },
      });

      await createUser.verifyFirebaseCustomToken(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Verification successful",
        data: { name: "John Doe", email: "example@example.com" },
      });
    });

    it("should return failure response when util returns error", async () => {
      sinon.stub(createUserUtil, "verifyFirebaseCustomToken").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Verification failed",
        errors: { message: "Internal Server Error" },
      });

      await createUser.verifyFirebaseCustomToken(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Verification failed",
        errors: { message: "Internal Server Error" },
      });
    });

    it("should call next with HttpError when util throws", async () => {
      sinon
        .stub(createUserUtil, "verifyFirebaseCustomToken")
        .rejects(new Error("Internal Server Error"));

      await createUser.verifyFirebaseCustomToken(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(Error);
    });
  });

  describe("syncAnalyticsAndMobile", () => {
    it("should return success response when sync succeeds", async () => {
      const syncUtilStub = sinon
        .stub(createUserUtil, "syncAnalyticsAndMobile")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Sync successful",
          data: { name: "John Doe" },
        });

      await createUser.syncAnalyticsAndMobile(req, res, next);

      expect(syncUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Sync successful",
        data: { name: "John Doe" },
      });
    });

    it("should return failure response when util returns error", async () => {
      const syncUtilStub = sinon
        .stub(createUserUtil, "syncAnalyticsAndMobile")
        .resolves({
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Unable to sync Analytics and Mobile Accounts",
          errors: { message: "Invalid request" },
        });

      await createUser.syncAnalyticsAndMobile(req, res, next);

      expect(syncUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.BAD_REQUEST);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Unable to sync Analytics and Mobile Accounts",
        errors: { message: "Invalid request" },
      });
    });

    it("should call next with HttpError when util throws", async () => {
      const syncUtilStub = sinon
        .stub(createUserUtil, "syncAnalyticsAndMobile")
        .rejects(new Error("Internal Server Error"));

      await createUser.syncAnalyticsAndMobile(req, res, next);

      expect(syncUtilStub).to.have.been.calledOnce;
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(Error);
    });
  });
});
