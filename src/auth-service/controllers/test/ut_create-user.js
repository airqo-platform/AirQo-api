require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const createUserUtil = require("@utils/create-user");
const controlAccessUtil = require("@utils/control-access");
const createUser = require("@controllers/create-user");
const chai = require("chai");
chai.use(require("sinon-chai"));

describe("createUserController", () => {
  describe("listStatistics", () => {
    it("should return a list of user statistics when validation passes", async () => {
      // Mock the request and response objects
      const req = { query: { tenant: "example-tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.listStatistics function
      const listStatisticsStub = sinon.stub(createUserUtil, "listStatistics");
      listStatisticsStub.withArgs("example-tenant").resolves({
        success: true,
        message: "Success",
        data: [{ userStats: "example" }],
      });

      // Call the controller function
      await createUser.listStatistics(req, res);

      // Assertions
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnceWithMatch({ success: true })).to.be.true;

      // Restore the stub
      listStatisticsStub.restore();
    });

    it("should return an error response when validation fails", async () => {
      // Mock the request and response objects
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await createUser.listStatistics(req, res);

      // Assertions
      expect(res.status.calledOnceWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
    });
  });
  describe("listLogs", () => {
    it("should return a list of user statistics when validation passes", async () => {
      // Mock the request and response objects
      const req = { query: { tenant: "example-tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").returns([{ nestedErrors: [] }]);

      // Mock the createUserUtil.listLogs function
      const listLogsStub = sinon.stub(createUserUtil, "listLogs");
      listLogsStub.withArgs(sinon.match.object).resolves({
        success: true,
        message: "Success",
        data: [{ logData: "example" }],
      });

      // Call the controller function
      await createUser.listLogs(req, res);

      // Assertions
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnceWithMatch({ success: true })).to.be.true;

      // Restore the stubs
      validationResult.isEmpty.restore();
      validationResult.errors.restore();
      listLogsStub.restore();
    });

    it("should return an error response when validation fails", async () => {
      // Mock the request and response objects
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function
      sinon.stub(validationResult, "isEmpty").returns(true);
      sinon.stub(validationResult, "errors").returns([{ nestedErrors: [] }]);

      // Call the controller function
      await createUser.listLogs(req, res);

      // Assertions
      expect(res.status.calledOnceWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledOnce).to.be.true;

      // Restore the stubs
      validationResult.isEmpty.restore();
      validationResult.errors.restore();
    });

    it("should return an error response when createUserUtil.listLogs returns an error", async () => {
      // Mock the request and response objects
      const req = { query: { tenant: "example-tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").returns([{ nestedErrors: [] }]);

      // Mock the createUserUtil.listLogs function to return an error
      const errorMessage = "An error occurred";
      const listLogsStub = sinon.stub(createUserUtil, "listLogs");
      listLogsStub
        .withArgs(sinon.match.object)
        .rejects(new Error(errorMessage));

      // Call the controller function
      await createUser.listLogs(req, res);

      // Assertions
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnceWithMatch({ success: false })).to.be.true;
      expect(res.json.firstCall.args[0].errors.message).to.equal(errorMessage);

      // Restore the stubs
      validationResult.isEmpty.restore();
      validationResult.errors.restore();
      listLogsStub.restore();
    });
  });
  describe("list", () => {
    it("should return a list of users when validation passes", async () => {
      // Mock the request and response objects
      const req = { query: { tenant: "example-tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").returns([{ nestedErrors: [] }]);

      // Mock the createUserUtil.list function
      const listStub = sinon.stub(createUserUtil, "list");
      listStub.withArgs(sinon.match.object).resolves({
        success: true,
        message: "Success",
        data: [{ userData: "example" }],
      });

      // Call the controller function
      await createUser.list(req, res);

      // Assertions
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnceWithMatch({ success: true })).to.be.true;

      // Restore the stubs
      validationResult.isEmpty.restore();
      validationResult.errors.restore();
      listStub.restore();
    });

    it("should return an error response when validation fails", async () => {
      // Mock the request and response objects
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function
      sinon.stub(validationResult, "isEmpty").returns(true);
      sinon.stub(validationResult, "errors").returns([{ nestedErrors: [] }]);

      // Call the controller function
      await createUser.list(req, res);

      // Assertions
      expect(res.status.calledOnceWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledOnce).to.be.true;

      // Restore the stubs
      validationResult.isEmpty.restore();
      validationResult.errors.restore();
    });

    it("should return an error response when createUserUtil.list returns an error", async () => {
      // Mock the request and response objects
      const req = { query: { tenant: "example-tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").returns([{ nestedErrors: [] }]);

      // Mock the createUserUtil.list function to return an error
      const errorMessage = "An error occurred";
      const listStub = sinon.stub(createUserUtil, "list");
      listStub.withArgs(sinon.match.object).rejects(new Error(errorMessage));

      // Call the controller function
      await createUser.list(req, res);

      // Assertions
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnceWithMatch({ success: false })).to.be.true;
      expect(res.json.firstCall.args[0].errors.message).to.equal(errorMessage);

      // Restore the stubs
      validationResult.isEmpty.restore();
      validationResult.errors.restore();
      listStub.restore();
    });
  });
  describe("googleCallback", () => {
    it("should set the access_token cookie and redirect", async () => {
      // Mock the request and response objects
      const token = "example-token";
      const req = {
        user: {
          toAuthJSON: sinon.stub().returns({ token }),
        },
      };
      const res = {
        cookie: sinon.stub(),
        redirect: sinon.stub(),
        status: sinon.stub(),
        json: sinon.stub(),
      };
      res.status.returnsThis();
      res.json.returnsThis();

      // Call the controller function
      await createUser.googleCallback(req, res);

      // Assertions
      expect(
        res.cookie.calledOnceWithExactly("access_token", token, {
          httpOnly: true,
          secure: true,
        })
      ).to.be.true;
      expect(
        res.redirect.calledOnceWithExactly(
          constants.GMAIL_VERIFICATION_SUCCESS_REDIRECT
        )
      ).to.be.true;
      expect(res.status.called).to.be.false;
      expect(res.json.called).to.be.false;
    });

    it("should return an internal server error response on error", async () => {
      // Mock the request and response objects
      const errorMessage = "An error occurred";
      const req = {
        user: {
          toAuthJSON: sinon.stub().throws(new Error(errorMessage)),
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await createUser.googleCallback(req, res);

      // Assertions
      expect(res.status.calledOnceWithExactly(httpStatus.INTERNAL_SERVER_ERROR))
        .to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: errorMessage },
        })
      ).to.be.true;
    });
  });
  describe("generateVerificationToken", () => {
    it("should generate and return the verification token", async () => {
      // Mock the request and response objects
      const tenant = "example-tenant";
      const token = "example-token";
      const req = {
        query: { tenant },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function to return empty errors
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock the controlAccessUtil.generateVerificationToken function to return success
      sinon.stub(controlAccessUtil, "generateVerificationToken").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Token generated and sent to user's email address",
        token,
      });

      // Call the controller function
      await createUser.generateVerificationToken(req, res);

      // Assertions
      expect(res.status.calledOnceWithExactly(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: true,
          message: "Token generated and sent to user's email address",
          token,
        })
      ).to.be.true;

      // Restore the stubs
      validationResult.isEmpty.restore();
      controlAccessUtil.generateVerificationToken.restore();
    });

    it("should handle bad request errors", async () => {
      // Mock the request and response objects
      const req = {};
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function to return errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon
        .stub(validationResult, "errors")
        .returns([{ nestedErrors: "example-error" }]);

      // Call the controller function
      await createUser.generateVerificationToken(req, res);

      // Assertions
      expect(res.status.calledOnceWithExactly(httpStatus.BAD_REQUEST)).to.be
        .true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: "example-error",
        })
      ).to.be.true;

      // Restore the stubs
      validationResult.isEmpty.restore();
      validationResult.errors.restore();
    });

    it("should return an internal server error response on error", async () => {
      // Mock the request and response objects
      const req = {};
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function to return empty errors
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock the controlAccessUtil.generateVerificationToken function to throw an error
      sinon
        .stub(controlAccessUtil, "generateVerificationToken")
        .throws(new Error("example-error"));

      // Call the controller function
      await createUser.generateVerificationToken(req, res);

      // Assertions
      expect(res.status.calledOnceWithExactly(httpStatus.INTERNAL_SERVER_ERROR))
        .to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "internal server error",
          errors: { message: "example-error" },
        })
      ).to.be.true;

      // Restore the stubs
      validationResult.isEmpty.restore();
      controlAccessUtil.generateVerificationToken.restore();
    });
  });
  describe("verifyVerificationToken", () => {
    it("should verify the verification token and return a successful response", async () => {
      // Mock the request and response objects
      const tenant = "example-tenant";
      const data = "example-data";
      const req = {
        query: { tenant },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function to return empty errors
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock the controlAccessUtil.verifyVerificationToken function to return success
      sinon.stub(controlAccessUtil, "verifyVerificationToken").resolves({
        success: true,
        status: httpStatus.OK,
        message: "token verified sucessfully",
        data,
      });

      // Call the controller function
      await createUser.verifyVerificationToken(req, res);

      // Assertions
      expect(res.status.calledOnceWithExactly(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: true,
          message: "token verified sucessfully",
          sign_in_link: data,
        })
      ).to.be.true;

      // Restore the stubs
      validationResult.isEmpty.restore();
      controlAccessUtil.verifyVerificationToken.restore();
    });

    it("should handle bad request errors", async () => {
      // Mock the request and response objects
      const req = {};
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function to return errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon
        .stub(validationResult, "errors")
        .returns([{ nestedErrors: "example-error" }]);

      // Call the controller function
      await createUser.verifyVerificationToken(req, res);

      // Assertions
      expect(res.status.calledOnceWithExactly(httpStatus.BAD_REQUEST)).to.be
        .true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: "example-error",
        })
      ).to.be.true;

      // Restore the stubs
      validationResult.isEmpty.restore();
      validationResult.errors.restore();
    });

    it("should return an internal server error response on error", async () => {
      // Mock the request and response objects
      const req = {};
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult function to return empty errors
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock the controlAccessUtil.verifyVerificationToken function to throw an error
      sinon
        .stub(controlAccessUtil, "verifyVerificationToken")
        .throws(new Error("example-error"));

      // Call the controller function
      await createUser.verifyVerificationToken(req, res);

      // Assertions
      expect(res.status.calledOnceWithExactly(httpStatus.INTERNAL_SERVER_ERROR))
        .to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "internal server error",
          errors: { message: "example-error" },
        })
      ).to.be.true;

      // Restore the stubs
      validationResult.isEmpty.restore();
      controlAccessUtil.verifyVerificationToken.restore();
    });
  });
  describe("verify", () => {
    it("should return a successful response with a valid token message", () => {
      // Mock the request and response objects
      const req = {};
      const res = {
        status: (status) => ({
          json: (data) => {
            expect(status).to.equal(httpStatus.OK);
            expect(data).to.deep.equal({
              success: true,
              message: "this token is valid",
              response: "valid token",
            });
          },
        }),
      };

      // Call the controller function
      createUser.verify(req, res);
    });
  });
  describe("verifyEmail", () => {
    it("should return a successful response with email verified message when email is verified", async () => {
      // Mock the request and response objects
      const tenant = "airqo";
      const req = {
        query: { tenant },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult to return no errors
      sinon.stub(validationResult(req), "isEmpty").returns(true);

      // Mock the controlAccessUtil.verifyEmail function to return a success response
      sinon.stub(controlAccessUtil, "verifyEmail").resolves({
        success: true,
        status: httpStatus.OK,
        message: "email verified successfully",
      });

      // Call the controller function
      await createUser.verifyEmail(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "email verified successfully",
        })
      ).to.be.true;

      // Restore the stubbed functions to their original implementations
      validationResult(req).isEmpty.restore();
      controlAccessUtil.verifyEmail.restore();
    });

    it("should return an error response when there are validation errors", async () => {
      // Mock the request and response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult to return errors
      sinon.stub(validationResult(req), "isEmpty").returns(false);
      sinon
        .stub(validationResult(req), "errors")
        .returns([{ nestedErrors: "Some validation error" }]);

      // Call the controller function
      await createUser.verifyEmail(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          errors: { nestedErrors: "Some validation error" },
        })
      ).to.be.true;

      // Restore the stubbed functions to their original implementations
      validationResult(req).isEmpty.restore();
      validationResult(req).errors.restore();
    });

    it("should return an error response when verifyEmail function returns an error response", async () => {
      // Mock the request and response objects
      const tenant = "airqo";
      const req = {
        query: { tenant },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the validationResult to return no errors
      sinon.stub(validationResult(req), "isEmpty").returns(true);

      // Mock the controlAccessUtil.verifyEmail function to return an error response
      sinon.stub(controlAccessUtil, "verifyEmail").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Verification failed",
        errors: { someError: "An internal error occurred" },
      });

      // Call the controller function
      await createUser.verifyEmail(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Verification failed",
          errors: { someError: "An internal error occurred" },
        })
      ).to.be.true;

      // Restore the stubbed functions to their original implementations
      validationResult(req).isEmpty.restore();
      controlAccessUtil.verifyEmail.restore();
    });
  });
  describe("deleteMobileUserData", () => {
    it("should return a successful response when app data is deleted", async () => {
      // Mock the request and response objects
      const req = {};
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.deleteMobileUserData function to return a success response
      sinon.stub(createUserUtil, "deleteMobileUserData").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Data deleted successfully",
      });

      // Call the controller function
      await createUser.deleteMobileUserData(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Data deleted successfully",
        })
      ).to.be.true;

      // Restore the stubbed function to its original implementation
      createUserUtil.deleteMobileUserData.restore();
    });

    it("should return an error response when deleteMobileUserData function returns an error response", async () => {
      // Mock the request and response objects
      const req = {};
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.deleteMobileUserData function to return an error response
      sinon.stub(createUserUtil, "deleteMobileUserData").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Deletion failed",
        errors: { someError: "An internal error occurred" },
      });

      // Call the controller function
      await createUser.deleteMobileUserData(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Deletion failed",
          errors: { someError: "An internal error occurred" },
        })
      ).to.be.true;

      // Restore the stubbed function to its original implementation
      createUserUtil.deleteMobileUserData.restore();
    });
  });
  describe("lookUpFirebaseUser", () => {
    let req, res;

    beforeEach(() => {
      req = {};
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return the existing user when request is valid", async () => {
      req.query = {};
      req.query.tenant = "example_tenant";

      const createUserUtilStub = sinon
        .stub(createUserUtil, "lookUpFirebaseUser")
        .resolves([
          {
            success: true,
            status: httpStatus.OK,
            message: "User found",
            data: { name: "John Doe" },
          },
        ]);

      await createUser.lookUpFirebaseUser(req, res);

      expect(createUserUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "User found",
        user: { name: "John Doe" },
        exists: true,
        status: "exists",
      });
    });

    it("should handle errors when user does not exist", async () => {
      req.query = {};
      req.query.tenant = "example_tenant";

      const createUserUtilStub = sinon
        .stub(createUserUtil, "lookUpFirebaseUser")
        .resolves([
          {
            success: false,
            status: httpStatus.NOT_FOUND,
            message: "User not found",
            errors: { message: "User not found" },
          },
        ]);

      await createUser.lookUpFirebaseUser(req, res);

      expect(createUserUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.NOT_FOUND);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "User not found",
        exists: false,
        errors: { message: "User not found" },
      });
    });

    it("should handle internal server errors", async () => {
      req.query = {};
      req.query.tenant = "example_tenant";

      const createUserUtilStub = sinon
        .stub(createUserUtil, "lookUpFirebaseUser")
        .rejects(new Error("Internal Server Error"));

      await createUser.lookUpFirebaseUser(req, res);

      expect(createUserUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        error: "Internal Server Error",
      });
    });
  });
  describe("loginWithFirebase()", () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {},
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should successfully login with Firebase when request is valid", async () => {
      req.body = {
        email: "example@example.com",
        phoneNumber: "1234567890",
        uid: "example_uid",
        providerId: "example_providerId",
        providerUid: "example_providerUid",
      };

      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      const createUserUtilStub = sinon
        .stub(createUserUtil, "loginWithFirebase")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Login successful",
          data: { name: "John Doe", token: "example_token" },
        });

      await createUser.loginWithFirebase(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(createUserUtilStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Login successful",
        name: "John Doe",
        token: "example_token",
      });
    });

    it("should handle validation errors", async () => {
      req.body = {
        email: "example@example.com",
        phoneNumber: "1234567890",
        uid: "example_uid",
        providerId: "example_providerId",
        providerUid: "example_providerUid",
      };

      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              { param: "email", message: "Invalid email" },
              { param: "phoneNumber", message: "Invalid phone number" },
            ],
          },
        ],
      });

      const badRequestStub = sinon.stub().returnsThis();
      const convertErrorArrayToObjectStub = sinon.stub().returns({
        email: "Invalid email",
        phoneNumber: "Invalid phone number",
      });

      await createUser.loginWithFirebase(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(badRequestStub).to.have.been.calledOnceWith(
        res,
        "Unable to signup with Firebase",
        {
          email: "Invalid email",
          phoneNumber: "Invalid phone number",
        }
      );
    });

    it("should handle login failure", async () => {
      req.body = {
        email: "example@example.com",
        phoneNumber: "1234567890",
        uid: "example_uid",
        providerId: "example_providerId",
        providerUid: "example_providerUid",
      };

      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      const createUserUtilStub = sinon
        .stub(createUserUtil, "loginWithFirebase")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Login failed",
          errors: { message: "Internal Server Error" },
        });

      await createUser.loginWithFirebase(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(createUserUtilStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Unable to login with Firebase",
        exists: false,
        errors: { message: "Internal Server Error" },
      });
    });

    it("should handle internal server errors", async () => {
      req.body = {
        email: "example@example.com",
        phoneNumber: "1234567890",
        uid: "example_uid",
        providerId: "example_providerId",
        providerUid: "example_providerUid",
      };

      const validationResultStub = sinon
        .stub()
        .throws(new Error("Validation error"));

      const internalServerErrorStub = sinon.stub();

      await createUser.loginWithFirebase(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(internalServerErrorStub).to.have.been.calledOnceWith(res, {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Validation error" },
        error: "Validation error",
      });
    });
  });
  describe("createFirebaseUser", () => {
    let req, res;

    beforeEach(() => {
      req = {};
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should successfully create a Firebase user when request is valid", async () => {
      req.query = {};
      req.query.tenant = "example_tenant";

      const createUserUtilStub = sinon
        .stub(createUserUtil, "createFirebaseUser")
        .resolves([
          {
            success: true,
            status: httpStatus.OK,
            message: "User created successfully",
            data: [{ name: "John Doe" }],
          },
        ]);

      await createUser.createFirebaseUser(req, res);

      expect(createUserUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "User created successfully",
        user: { name: "John Doe" },
        exists: true,
        status: "exists",
      });
    });

    it("should handle errors when user creation fails", async () => {
      req.query = {};
      req.query.tenant = "example_tenant";

      const createUserUtilStub = sinon
        .stub(createUserUtil, "createFirebaseUser")
        .resolves([
          {
            success: false,
            status: httpStatus.BAD_REQUEST,
            message: "User creation failed",
            errors: { message: "Invalid request" },
          },
        ]);

      await createUser.createFirebaseUser(req, res);

      expect(createUserUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.BAD_REQUEST);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "User creation failed",
        errors: { message: "Invalid request" },
      });
    });

    it("should handle internal server errors", async () => {
      req.query = {};
      req.query.tenant = "example_tenant";

      const createUserUtilStub = sinon
        .stub(createUserUtil, "createFirebaseUser")
        .rejects(new Error("Internal Server Error"));

      await createUser.createFirebaseUser(req, res);

      expect(createUserUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        error: "Internal Server Error",
      });
    });
  });
  describe("sendFeedback", () => {
    it("should return a successful response when sending feedback is successful", async () => {
      // Mock the request and response objects
      const req = {
        // Add the required properties of the request object for sending feedback
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.sendFeedback function to return a success response
      sinon.stub(createUserUtil, "sendFeedback").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Feedback sent successfully",
      });

      // Call the controller function
      await sendFeedbackController.sendFeedback(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Feedback sent successfully",
          status: httpStatus.OK,
        })
      ).to.be.true;

      // Restore the stubbed function to its original implementation
      createUserUtil.sendFeedback.restore();
    });

    it("should return an error response when sending feedback fails", async () => {
      // Mock the request and response objects
      const req = {
        // Add the required properties of the request object for sending feedback
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.sendFeedback function to return an error response
      sinon.stub(createUserUtil, "sendFeedback").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to send feedback",
        errors: {
          someError: "Some error message",
        },
      });

      // Call the controller function
      await sendFeedbackController.sendFeedback(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to send feedback",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            someError: "Some error message",
          },
        })
      ).to.be.true;

      // Restore the stubbed function to its original implementation
      createUserUtil.sendFeedback.restore();
    });
  });
  describe("forgot", () => {
    it("should return a successful response when forgot password request is successful", async () => {
      // Mock the request and response objects
      const req = {
        // Add the required properties of the request object for forgot password
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.forgotPassword function to return a success response
      sinon.stub(createUserUtil, "forgotPassword").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Password reset email sent successfully",
        data: {
          // Some data related to the request
        },
      });

      // Call the controller function
      await forgotController.forgot(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Password reset email sent successfully",
          response: {
            // Some data related to the request
          },
        })
      ).to.be.true;

      // Restore the stubbed function to its original implementation
      createUserUtil.forgotPassword.restore();
    });

    it("should return an error response when forgot password request fails", async () => {
      // Mock the request and response objects
      const req = {
        // Add the required properties of the request object for forgot password
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.forgotPassword function to return an error response
      sinon.stub(createUserUtil, "forgotPassword").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to send password reset email",
        error: "Some error message",
        errors: {
          someError: "Some error message",
        },
      });

      // Call the controller function
      await forgotController.forgot(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to send password reset email",
          error: "Some error message",
          errors: {
            someError: "Some error message",
          },
        })
      ).to.be.true;

      // Restore the stubbed function to its original implementation
      createUserUtil.forgotPassword.restore();
    });
  });
  describe("register", () => {
    it("should return a successful response when user registration is successful", async () => {
      // Mock the request and response objects
      const req = {
        // Add the required properties of the request object for user registration
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.register function to return a success response
      sinon.stub(createUserUtil, "register").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User registered successfully",
        data: {
          // Some data related to the registered user
        },
      });

      // Call the controller function
      await registerController.register(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "User registered successfully",
          user: {
            // Some data related to the registered user
          },
        })
      ).to.be.true;

      // Restore the stubbed function to its original implementation
      createUserUtil.register.restore();
    });

    it("should return an error response when user registration fails", async () => {
      // Mock the request and response objects
      const req = {
        // Add the required properties of the request object for user registration
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.register function to return an error response
      sinon.stub(createUserUtil, "register").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to register user",
        errors: {
          someError: "Some error message",
        },
        error: "Some error message",
      });

      // Call the controller function
      await registerController.register(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to register user",
          errors: {
            someError: "Some error message",
          },
          error: "Some error message",
        })
      ).to.be.true;

      // Restore the stubbed function to its original implementation
      createUserUtil.register.restore();
    });
  });
  describe("create", () => {
    it("should return a successful response when user creation is successful", async () => {
      // Mock the request and response objects
      const req = {
        body: {
          // Add the required properties of the request body for user creation
        },
        query: {
          // Add the required properties of the query object for tenant
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.create function to return a success response
      sinon.stub(createUserUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User created successfully",
        data: {
          // Some data related to the created user
        },
      });

      // Call the controller function
      await createController.create(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "User created successfully",
          user: {
            // Some data related to the created user
          },
        })
      ).to.be.true;

      // Restore the stubbed function to its original implementation
      createUserUtil.create.restore();
    });

    it("should return an error response when user creation fails", async () => {
      // Mock the request and response objects
      const req = {
        body: {
          // Add the required properties of the request body for user creation
        },
        query: {
          // Add the required properties of the query object for tenant
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock the createUserUtil.create function to return an error response
      sinon.stub(createUserUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to create user",
        errors: {
          someError: "Some error message",
        },
      });

      // Call the controller function
      await createController.create(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to create user",
          errors: {
            someError: "Some error message",
          },
        })
      ).to.be.true;

      // Restore the stubbed function to its original implementation
      createUserUtil.create.restore();
    });
  });
  describe("login", () => {
    it("should return a successful response when user login is successful", async () => {
      // Mock the request and response objects
      const req = {
        query: {
          // Add the required properties of the query object for tenant
        },
        auth: {
          success: true,
          // Add other properties of the auth object if needed for testing
        },
        user: {
          // Add the properties of the user object returned from the auth middleware
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await loginController.login(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith(req.user.toAuthJSON())).to.be.true;
    });

    it("should return an error response when user login fails", async () => {
      // Mock the request and response objects
      const req = {
        query: {
          // Add the required properties of the query object for tenant
        },
        auth: {
          success: false,
          message: "Invalid credentials",
          // Add other properties of the auth object if needed for testing
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await loginController.login(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Invalid credentials",
        })
      ).to.be.true;
    });

    it("should return a redirection response when the account has been moved permanently", async () => {
      // Mock the request and response objects
      const req = {
        query: {
          tenant: "example_tenant",
          // Add the required properties of the query object for tenant
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await loginController.login(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.MOVED_PERMANENTLY)).to.be.true;
      expect(
        res.json.calledWith({
          message:
            "The account has been moved permanently to a new location, please reach out to: info@airqo.net",
          location: "https://platform.airqo.net/",
          errors: {
            message:
              "The account has been moved permanently to a new location, please reach out to: info@airqo.net",
            location: "https://platform.airqo.net/",
          },
        })
      ).to.be.true;
    });
  });
  describe("guest", () => {
    it("should return a successful response with the guestId when the guest session is created successfully", async () => {
      // Mock the request and response objects
      const req = {
        session: {},
        user: {
          guestId: "guest123", // Replace with the actual guestId generated
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await guestController.guest(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          guestId: req.user.guestId,
        })
      ).to.be.true;
      // Assert that the guest session is created in the request object
      expect(req.session.guest).to.be.true;
    });

    it("should return an error response when there are validation errors in the request", async () => {
      // Mock the request and response objects
      const req = {
        session: {},
        user: {
          guestId: "guest123", // Replace with the actual guestId generated
        },
        // Add properties of the validationResult object to simulate validation errors
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await guestController.guest(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          // Add expected errors object based on the validation errors in the request
        })
      ).to.be.true;
      // Assert that the guest session is not created in the request object
      expect(req.session.guest).to.be.undefined;
    });

    it("should return an error response when there is an error creating the guest session", async () => {
      // Mock the request and response objects
      const req = {
        session: {},
        user: {
          guestId: "guest123", // Replace with the actual guestId generated
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      // Mock the save method to simulate an error
      req.session.save = sinon.stub().callsFake((callback) => {
        callback(new Error("Failed to save guest session"));
      });

      // Call the controller function
      await guestController.guest(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Error creating guest session",
        })
      ).to.be.true;
      // Assert that the guest session is not created in the request object
      expect(req.session.guest).to.be.undefined;
    });
  });
  describe("delete", () => {
    it("should return a successful response with the deleted user when the user is deleted successfully", async () => {
      // Mock the request and response objects
      const req = {
        query: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the deleteUserUtil.delete function to simulate a successful user deletion
      sinon.stub(deleteUser, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User deleted successfully",
        data: { username: "testuser", email: "testuser@example.com" }, // Replace with the actual user data
      });

      // Call the controller function
      await deleteController.delete(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "User deleted successfully",
          user: { username: "testuser", email: "testuser@example.com" }, // Replace with the actual user data
        })
      ).to.be.true;

      // Restore the stubbed function
      deleteUser.delete.restore();
    });

    it("should return an error response when there are validation errors in the request", async () => {
      // Mock the request and response objects
      const req = {
        query: {},
        // Add any required properties in the request object
        // Add properties of the validationResult object to simulate validation errors
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await deleteController.delete(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          // Add expected errors object based on the validation errors in the request
        })
      ).to.be.true;
    });

    it("should return an error response when there is an error deleting the user", async () => {
      // Mock the request and response objects
      const req = {
        query: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the deleteUserUtil.delete function to simulate an error while deleting the user
      sinon
        .stub(deleteUser, "delete")
        .rejects(new Error("Failed to delete user"));

      // Call the controller function
      await deleteController.delete(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          error: "Failed to delete user",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;

      // Restore the stubbed function
      deleteUser.delete.restore();
    });
  });
  describe("update", () => {
    it("should return a successful response with the updated user when the user is updated successfully", async () => {
      // Mock the request and response objects
      const req = {
        query: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the updateUserUtil.update function to simulate a successful user update
      sinon.stub(updateUser, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User updated successfully",
        data: { username: "testuser", email: "testuser@example.com" }, // Replace with the actual updated user data
      });

      // Call the controller function
      await updateController.update(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "User updated successfully",
          user: { username: "testuser", email: "testuser@example.com" }, // Replace with the actual updated user data
        })
      ).to.be.true;

      // Restore the stubbed function
      updateUser.update.restore();
    });

    it("should return an error response when there are validation errors in the request", async () => {
      // Mock the request and response objects
      const req = {
        query: {},
        // Add any required properties in the request object
        // Add properties of the validationResult object to simulate validation errors
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await updateController.update(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          // Add expected errors object based on the validation errors in the request
        })
      ).to.be.true;
    });

    it("should return an error response when there is an error updating the user", async () => {
      // Mock the request and response objects
      const req = {
        query: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the updateUserUtil.update function to simulate an error while updating the user
      sinon
        .stub(updateUser, "update")
        .rejects(new Error("Failed to update user"));

      // Call the controller function
      await updateController.update(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Failed to update user" },
        })
      ).to.be.true;

      // Restore the stubbed function
      updateUser.update.restore();
    });
  });
  describe("loginInViaEmail", () => {
    it("should return a successful response with the login link and token when the email sign-in link is generated successfully", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the generateSignInWithEmailLink function to simulate a successful login link generation
      sinon
        .stub(generateSignInWithEmailLink, "generateSignInWithEmailLink")
        .callsFake((request, callback) => {
          const value = {
            success: true,
            status: httpStatus.OK,
            message: "Email sign-in link generated successfully",
            data: {
              link: "https://example.com/email-signin-link", // Replace with the actual generated link
              token: "some-token", // Replace with the actual token
              email: "testuser@example.com", // Replace with the actual email
              emailLinkCode: "some-email-link-code", // Replace with the actual email link code
            },
          };
          callback(value);
        });

      // Call the controller function
      await loginViaEmailController.loginInViaEmail(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Email sign-in link generated successfully",
          login_link: "https://example.com/email-signin-link", // Replace with the actual generated link
          token: "some-token", // Replace with the actual token
          email: "testuser@example.com", // Replace with the actual email
          emailLinkCode: "some-email-link-code", // Replace with the actual email link code
        })
      ).to.be.true;

      // Restore the stubbed function
      generateSignInWithEmailLink.generateSignInWithEmailLink.restore();
    });

    it("should return an error response when there are validation errors in the request", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        // Add any required properties in the request object
        // Add properties of the validationResult object to simulate validation errors
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await loginViaEmailController.loginInViaEmail(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          // Add expected errors object based on the validation errors in the request
        })
      ).to.be.true;
    });

    it("should return an error response when there is an error generating the email sign-in link", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the generateSignInWithEmailLink function to simulate an error while generating the email sign-in link
      sinon
        .stub(generateSignInWithEmailLink, "generateSignInWithEmailLink")
        .callsFake((request, callback) => {
          const value = {
            success: false,
            status: httpStatus.INTERNAL_SERVER_ERROR,
            message: "Failed to generate email sign-in link",
            errors: { message: "Failed to generate email sign-in link" },
          };
          callback(value);
        });

      // Call the controller function
      await loginViaEmailController.loginInViaEmail(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to generate email sign-in link",
          errors: { message: "Failed to generate email sign-in link" },
        })
      ).to.be.true;

      // Restore the stubbed function
      generateSignInWithEmailLink.generateSignInWithEmailLink.restore();
    });
  });
  describe("emailAuth", () => {
    it("should return a successful response with the authentication link and token when the email sign-in link is generated successfully", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        params: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the generateSignInWithEmailLink function to simulate a successful email authentication link generation
      sinon
        .stub(generateSignInWithEmailLink, "generateSignInWithEmailLink")
        .callsFake((request, callback) => {
          const value = {
            success: true,
            status: httpStatus.OK,
            message: "Email authentication link generated successfully",
            data: {
              link: "https://example.com/auth-link", // Replace with the actual generated link
              token: "some-token", // Replace with the actual token
              emailLinkCode: "some-email-link-code", // Replace with the actual email link code
              email: "testuser@example.com", // Replace with the actual email
            },
          };
          callback(value);
        });

      // Call the controller function
      await emailAuthController.emailAuth(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Email authentication link generated successfully",
          auth_link: "https://example.com/auth-link", // Replace with the actual generated link
          token: "some-token", // Replace with the actual token
          auth_code: "some-email-link-code", // Replace with the actual email link code
          email: "testuser@example.com", // Replace with the actual email
        })
      ).to.be.true;

      // Restore the stubbed function
      generateSignInWithEmailLink.generateSignInWithEmailLink.restore();
    });

    it("should return an error response when there are validation errors in the request", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        params: {},
        // Add any required properties in the request object
        // Add properties of the validationResult object to simulate validation errors
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await emailAuthController.emailAuth(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          // Add expected errors object based on the validation errors in the request
        })
      ).to.be.true;
    });

    it("should return an error response when there is an error generating the email authentication link", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        params: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the generateSignInWithEmailLink function to simulate an error while generating the email authentication link
      sinon
        .stub(generateSignInWithEmailLink, "generateSignInWithEmailLink")
        .callsFake((request, callback) => {
          const value = {
            success: false,
            status: httpStatus.INTERNAL_SERVER_ERROR,
            message: "Failed to generate email authentication link",
            errors: { message: "Failed to generate email authentication link" },
          };
          callback(value);
        });

      // Call the controller function
      await emailAuthController.emailAuth(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to generate email authentication link",
          errors: { message: "Failed to generate email authentication link" },
        })
      ).to.be.true;

      // Restore the stubbed function
      generateSignInWithEmailLink.generateSignInWithEmailLink.restore();
    });
  });
  describe("updateForgottenPassword", () => {
    it("should return a successful response with the updated user data when the forgotten password is updated successfully", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the updateForgottenPassword function to simulate a successful password update
      sinon
        .stub(updateForgottenPassword, "updateForgottenPassword")
        .callsFake((request) => {
          const responseFromUpdateForgottenPassword = {
            success: true,
            status: httpStatus.OK,
            message: "Password updated successfully",
            data: {
              // Replace with the actual updated user data
            },
          };
          return responseFromUpdateForgottenPassword;
        });

      // Call the controller function
      await updateForgottenPasswordController.updateForgottenPassword(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Password updated successfully",
          // Add expected updated user data
        })
      ).to.be.true;

      // Restore the stubbed function
      updateForgottenPassword.updateForgottenPassword.restore();
    });

    it("should return an error response when there are validation errors in the request", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        // Add any required properties in the request object
        // Add properties of the validationResult object to simulate validation errors
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await updateForgottenPasswordController.updateForgottenPassword(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          // Add expected errors object based on the validation errors in the request
        })
      ).to.be.true;
    });

    it("should return an error response when there is an error updating the forgotten password", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the updateForgottenPassword function to simulate an error while updating the forgotten password
      sinon
        .stub(updateForgottenPassword, "updateForgottenPassword")
        .callsFake((request) => {
          const responseFromUpdateForgottenPassword = {
            success: false,
            status: httpStatus.INTERNAL_SERVER_ERROR,
            message: "Failed to update forgotten password",
            errors: { message: "Failed to update forgotten password" },
          };
          return responseFromUpdateForgottenPassword;
        });

      // Call the controller function
      await updateForgottenPasswordController.updateForgottenPassword(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to update forgotten password",
          errors: { message: "Failed to update forgotten password" },
        })
      ).to.be.true;

      // Restore the stubbed function
      updateForgottenPassword.updateForgottenPassword.restore();
    });
  });
  describe("updateKnownPassword", () => {
    it("should return a successful response with the updated user data when the known password is updated successfully", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the updateKnownPassword function to simulate a successful password update
      sinon
        .stub(updateKnownPassword, "updateKnownPassword")
        .callsFake((request) => {
          const responseFromUpdateKnownPassword = {
            success: true,
            status: httpStatus.OK,
            message: "Password updated successfully",
            data: {
              // Replace with the actual updated user data
            },
          };
          return responseFromUpdateKnownPassword;
        });

      // Call the controller function
      await updateKnownPasswordController.updateKnownPassword(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Password updated successfully",
          // Add expected updated user data
        })
      ).to.be.true;

      // Restore the stubbed function
      updateKnownPassword.updateKnownPassword.restore();
    });

    it("should return an error response when there are validation errors in the request", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        // Add any required properties in the request object
        // Add properties of the validationResult object to simulate validation errors
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await updateKnownPasswordController.updateKnownPassword(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          // Add expected errors object based on the validation errors in the request
        })
      ).to.be.true;
    });

    it("should return an error response when there is an error updating the known password", async () => {
      // Mock the request and response objects
      const req = {
        body: {},
        query: {},
        // Add any required properties in the request object
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the updateKnownPassword function to simulate an error while updating the known password
      sinon
        .stub(updateKnownPassword, "updateKnownPassword")
        .callsFake((request) => {
          const responseFromUpdateKnownPassword = {
            success: false,
            status: httpStatus.INTERNAL_SERVER_ERROR,
            message: "Failed to update known password",
            errors: { message: "Failed to update known password" },
          };
          return responseFromUpdateKnownPassword;
        });

      // Call the controller function
      await updateKnownPasswordController.updateKnownPassword(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to update known password",
          errors: { message: "Failed to update known password" },
        })
      ).to.be.true;

      // Restore the stubbed function
      updateKnownPassword.updateKnownPassword.restore();
    });
  });
  describe("subscribeToNewsLetter", () => {
    it("should return a successful response when the user is subscribed to the newsletter", async () => {
      // Mock the request and response objects
      const req = {
        body: {
          // Add any required properties in the request body
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the subscribeToNewsLetter function to simulate a successful subscription
      sinon
        .stub(subscribeToNewsLetter, "subscribeToNewsLetter")
        .callsFake((request) => {
          const responseFromSubscribeToNewsLetter = {
            success: true,
            status: httpStatus.OK,
            message: "Successfully subscribed to the newsletter",
          };
          return responseFromSubscribeToNewsLetter;
        });

      // Call the controller function
      await subscribeToNewsLetterController.subscribeToNewsLetter(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Successfully subscribed to the newsletter",
        })
      ).to.be.true;

      // Restore the stubbed function
      subscribeToNewsLetter.subscribeToNewsLetter.restore();
    });

    it("should return an error response when there are validation errors in the request", async () => {
      // Mock the request and response objects
      const req = {
        body: {
          // Add any required properties in the request body
        },
        // Add properties of the validationResult object to simulate validation errors
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      await subscribeToNewsLetterController.subscribeToNewsLetter(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          // Add expected errors object based on the validation errors in the request
        })
      ).to.be.true;
    });

    it("should return an error response when there is an error while subscribing to the newsletter", async () => {
      // Mock the request and response objects
      const req = {
        body: {
          // Add any required properties in the request body
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Stub the subscribeToNewsLetter function to simulate an error while subscribing to the newsletter
      sinon
        .stub(subscribeToNewsLetter, "subscribeToNewsLetter")
        .callsFake((request) => {
          const responseFromSubscribeToNewsLetter = {
            success: false,
            status: httpStatus.INTERNAL_SERVER_ERROR,
            message: "Failed to subscribe to the newsletter",
            errors: { message: "Failed to subscribe to the newsletter" },
          };
          return responseFromSubscribeToNewsLetter;
        });

      // Call the controller function
      await subscribeToNewsLetterController.subscribeToNewsLetter(req, res);

      // Assert that the response is as expected
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Failed to subscribe to the newsletter",
          errors: { message: "Failed to subscribe to the newsletter" },
        })
      ).to.be.true;

      // Restore the stubbed function
      subscribeToNewsLetter.subscribeToNewsLetter.restore();
    });
  });
  describe("signUpWithFirebase", () => {
    let req, res;

    beforeEach(() => {
      req = {};
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should successfully sign up with Firebase when request is valid", async () => {
      req.query = {};
      req.query.tenant = "example_tenant";

      const createUserUtilStub = sinon
        .stub(createUserUtil, "signUpWithFirebase")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Sign up successful",
          data: { name: "John Doe" },
        });

      await createUser.signUpWithFirebase(req, res);

      expect(createUserUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Sign up successful",
        user: { name: "John Doe" },
        exists: true,
        status: "exists",
      });
    });

    it("should handle errors when sign up fails", async () => {
      req.query = {};
      req.query.tenant = "example_tenant";

      const createUserUtilStub = sinon
        .stub(createUserUtil, "signUpWithFirebase")
        .resolves({
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Sign up failed",
          errors: { message: "Invalid request" },
        });

      await createUser.signUpWithFirebase(req, res);

      expect(createUserUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.BAD_REQUEST);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Sign up failed",
        exists: false,
        errors: { message: "Invalid request" },
      });
    });

    it("should handle internal server errors", async () => {
      req.query = {};
      req.query.tenant = "example_tenant";

      const createUserUtilStub = sinon
        .stub(createUserUtil, "signUpWithFirebase")
        .rejects(new Error("Internal Server Error"));

      await createUser.signUpWithFirebase(req, res);

      expect(createUserUtilStub).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        error: "Internal Server Error",
      });
    });
  });
  describe("verifyFirebaseCustomToken", () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {},
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should successfully verify Firebase custom token when request is valid", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      req.query = {
        tenant: "example_tenant",
      };
      const expectedRequest = Object.assign({}, req);
      expectedRequest.query = {
        tenant: "example_tenant",
      };

      const verifyFirebaseCustomTokenStub = sinon
        .stub(createUserUtil, "verifyFirebaseCustomToken")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Verification successful",
          data: { name: "John Doe", email: "example@example.com" },
        });

      await createUser.verifyFirebaseCustomToken(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(verifyFirebaseCustomTokenStub).to.have.been.calledOnceWith(
        expectedRequest
      );
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Verification successful",
        name: "John Doe",
        email: "example@example.com",
      });
    });

    it("should handle validation errors", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [{ param: "tenant", message: "Invalid tenant" }],
          },
        ],
      });

      const badRequestStub = sinon.stub().returnsThis();
      const convertErrorArrayToObjectStub = sinon.stub().returns({
        tenant: "Invalid tenant",
      });

      await createUser.verifyFirebaseCustomToken(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(badRequestStub).to.have.been.calledOnceWith(
        res,
        "Unable to signup with Firebase",
        {
          tenant: "Invalid tenant",
        }
      );
    });

    it("should handle verification failure", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      const verifyFirebaseCustomTokenStub = sinon
        .stub(createUserUtil, "verifyFirebaseCustomToken")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Verification failed",
          errors: { message: "Internal Server Error" },
        });

      await createUser.verifyFirebaseCustomToken(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(verifyFirebaseCustomTokenStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Unable to login with Firebase",
        exists: false,
        errors: { message: "Internal Server Error" },
      });
    });

    it("should handle internal server errors", async () => {
      const validationResultStub = sinon
        .stub()
        .throws(new Error("Validation error"));

      const internalServerErrorStub = sinon.stub();

      await createUser.verifyFirebaseCustomToken(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(internalServerErrorStub).to.have.been.calledOnceWith(res, {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Validation error" },
      });
    });
  });
});
