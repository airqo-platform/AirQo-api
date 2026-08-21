require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const {
  HttpError,
  extractErrorsFromRequest,
  enhancedErrorHandler,
  createOrgContextError,
  createValidationError,
  convertErrorArrayToObject,
} = require("@utils/shared/errors");
// Internal but stable string key that express-validator's `validationResult`
// reads errors from (see express-validator/src/validation-result.js and
// express-validator/src/base.js). Used here to build a minimal fake `req`
// without running real express-validator middleware.
const { contextsKey } = require("express-validator/src/base");

const buildReqWithErrors = (errorGroups) => ({
  [contextsKey]: errorGroups.map((errors) => ({ errors })),
});

describe("errors-util", () => {
  describe("HttpError", () => {
    it("should set the message and statusCode", () => {
      const err = new HttpError("Something went wrong", 500);

      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal("Something went wrong");
      expect(err.statusCode).to.equal(500);
      expect(err.errors).to.be.null;
    });

    it("should keep enhanced error objects (debugCode/details/suggestions) as-is", () => {
      const errors = {
        debugCode: "ORG_ACCESS_DENIED",
        details: { orgId: "123" },
        suggestions: ["check your access"],
      };

      const err = new HttpError("Access denied", 403, errors);

      expect(err.errors).to.deep.equal(errors);
    });

    it("should keep array-format errors as-is", () => {
      const errors = [{ param: "email", message: "Invalid email", location: "body" }];

      const err = new HttpError("Validation failed", 400, errors);

      expect(err.errors).to.deep.equal(errors);
    });

    it("should convert legacy param->message object errors into array format", () => {
      const errors = { email: "Invalid email", password: "Too short" };

      const err = new HttpError("Validation failed", 400, errors);

      expect(err.errors).to.deep.equal([
        { param: "email", message: "Invalid email", location: "body" },
        { param: "password", message: "Too short", location: "body" },
      ]);
    });

    it("should keep complex non-validation error objects as-is", () => {
      const errors = { nested: { code: 1 }, count: 2 };

      const err = new HttpError("Something complex", 500, errors);

      expect(err.errors).to.deep.equal(errors);
    });

    it("should keep primitive errors as-is", () => {
      const err = new HttpError("Simple error", 400, "just a string");

      expect(err.errors).to.equal("just a string");
    });
  });

  describe("extractErrorsFromRequest", () => {
    it("should return null when there are no validation errors", () => {
      const req = buildReqWithErrors([]);

      expect(extractErrorsFromRequest(req)).to.be.null;
    });

    it("should extract regular errors with param, message, and location", () => {
      const req = buildReqWithErrors([
        [{ param: "email", msg: "Invalid email", location: "body" }],
      ]);

      const result = extractErrorsFromRequest(req);

      expect(result).to.deep.equal([
        { param: "email", message: "Invalid email", location: "body" },
      ]);
    });

    it("should default location to 'body' when missing", () => {
      const req = buildReqWithErrors([[{ param: "email", msg: "Invalid email" }]]);

      const result = extractErrorsFromRequest(req);

      expect(result).to.deep.equal([
        { param: "email", message: "Invalid email", location: "body" },
      ]);
    });

    it("should flatten nested errors from oneOf() validators", () => {
      const req = buildReqWithErrors([
        [
          {
            param: "_error",
            msg: "Invalid value",
            nestedErrors: [
              { param: "phone", msg: "Invalid phone", location: "body" },
              { path: "email", message: "Invalid email", location: "body" },
            ],
          },
        ],
      ]);

      const result = extractErrorsFromRequest(req);

      expect(result).to.deep.equal([
        { param: "phone", message: "Invalid phone", location: "body" },
        { param: "email", message: "Invalid email", location: "body" },
      ]);
    });

    it("should remove duplicate errors for the same param and location, keeping the first occurrence", () => {
      const req = buildReqWithErrors([
        [
          { param: "email", msg: "Invalid email", location: "body" },
          { param: "email", msg: "Email is required", location: "body" },
        ],
      ]);

      const result = extractErrorsFromRequest(req);

      expect(result).to.deep.equal([
        { param: "email", message: "Invalid email", location: "body" },
      ]);
    });
  });

  describe("enhancedErrorHandler", () => {
    let req;
    let res;
    let next;
    let statusStub;
    let jsonStub;

    beforeEach(() => {
      next = sinon.stub();
      res = {
        headersSent: false,
        status: function () {
          return this;
        },
        json: function () {
          return this;
        },
      };
      statusStub = sinon.stub(res, "status").returnsThis();
      jsonStub = sinon.stub(res, "json").returnsThis();
      req = {
        originalUrl: "/api/v2/users",
        method: "GET",
        user: { _id: "user1", email: "user@example.com" },
        organizationContext: { orgId: "org1" },
        get: sinon.stub().withArgs("User-Agent").returns("test-agent"),
        ip: "127.0.0.1",
        connection: { remoteAddress: "127.0.0.1" },
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call next(err) without responding when headers are already sent", () => {
      res.headersSent = true;
      const err = new HttpError("Too late", 500);

      enhancedErrorHandler(err, req, res, next);

      expect(next.calledOnceWithExactly(err)).to.be.true;
      expect(statusStub.called).to.be.false;
      expect(jsonStub.called).to.be.false;
    });

    it("should respond with the error's statusCode, message, and default status of 500 when unset", () => {
      const err = new Error("Unexpected failure");

      enhancedErrorHandler(err, req, res, next);

      expect(statusStub.calledOnceWithExactly(500)).to.be.true;
      const response = jsonStub.firstCall.args[0];
      expect(response.success).to.be.false;
      expect(response.message).to.equal("Unexpected failure");
      expect(response.status).to.equal(500);
    });

    it("should attach errors array for validation-style (array) errors", () => {
      const validationErrors = [
        { param: "email", message: "Invalid email", location: "body" },
      ];
      const err = new HttpError("Validation failed", 400, validationErrors);

      enhancedErrorHandler(err, req, res, next);

      expect(statusStub.calledOnceWithExactly(400)).to.be.true;
      const response = jsonStub.firstCall.args[0];
      expect(response.errors).to.deep.equal(validationErrors);
    });

    it("should attach debugCode, details, suggestions, and a help block for known debugCodes", () => {
      const err = createOrgContextError("ACCESS_DENIED", {
        details: { orgId: "org1" },
        suggestions: ["contact admin"],
      });

      enhancedErrorHandler(err, req, res, next);

      expect(statusStub.calledOnceWithExactly(403)).to.be.true;
      const response = jsonStub.firstCall.args[0];
      expect(response.debugCode).to.equal("ORG_ACCESS_DENIED");
      expect(response.details).to.deep.equal({ orgId: "org1" });
      expect(response.suggestions).to.deep.equal(["contact admin"]);
      expect(response.help).to.be.an("object");
      expect(response.help.message).to.equal("Organization access was denied");
    });

    it("should attach errors for backward-compatible non-object error values", () => {
      const err = new Error("Legacy failure");
      err.statusCode = 400;
      err.errors = "some legacy error string";

      enhancedErrorHandler(err, req, res, next);

      const response = jsonStub.firstCall.args[0];
      expect(response.errors).to.equal("some legacy error string");
    });

    it("should include request context (url, method, user, org context) since NODE_ENV is not production", () => {
      const err = new HttpError("Failure", 400);

      enhancedErrorHandler(err, req, res, next);

      const response = jsonStub.firstCall.args[0];
      expect(response.context).to.be.an("object");
      expect(response.context.url).to.equal("/api/v2/users");
      expect(response.context.method).to.equal("GET");
      expect(response.context.userId).to.equal("user1");
      expect(response.context.userEmail).to.equal("user@example.com");
      expect(response.context.organizationContext).to.deep.equal({ orgId: "org1" });
    });
  });

  describe("createOrgContextError", () => {
    it("should create an ACCESS_DENIED HttpError with statusCode 403", () => {
      const err = createOrgContextError("ACCESS_DENIED");

      expect(err).to.be.instanceOf(HttpError);
      expect(err.statusCode).to.equal(403);
      expect(err.message).to.equal(
        "You don't have access to this organization"
      );
      expect(err.errors.debugCode).to.equal("ORG_ACCESS_DENIED");
    });

    it("should create an ID_MISSING HttpError with statusCode 400", () => {
      const err = createOrgContextError("ID_MISSING");

      expect(err.statusCode).to.equal(400);
      expect(err.errors.debugCode).to.equal("ORG_ID_MISSING");
    });

    it("should create an AUTH_MISSING HttpError with statusCode 401", () => {
      const err = createOrgContextError("AUTH_MISSING");

      expect(err.statusCode).to.equal(401);
      expect(err.errors.debugCode).to.equal("ORG_AUTH_MISSING");
    });

    it("should use a custom message when provided in details", () => {
      const err = createOrgContextError("ACCESS_DENIED", {
        message: "Custom denial message",
      });

      expect(err.message).to.equal("Custom denial message");
    });

    it("should throw for an unknown error type", () => {
      expect(() => createOrgContextError("NOT_A_REAL_TYPE")).to.throw(
        "Unknown organization context error type: NOT_A_REAL_TYPE"
      );
    });
  });

  describe("createValidationError", () => {
    it("should create a 400 HttpError with the given validation errors", () => {
      const validationErrors = { email: "Invalid email" };

      const err = createValidationError(validationErrors);

      expect(err).to.be.instanceOf(HttpError);
      expect(err.statusCode).to.equal(400);
      expect(err.message).to.equal("Validation failed");
      expect(err.errors).to.deep.equal([
        { param: "email", message: "Invalid email", location: "body" },
      ]);
    });

    it("should use a custom message when provided", () => {
      const err = createValidationError({ email: "Invalid email" }, "Custom message");

      expect(err.message).to.equal("Custom message");
    });
  });

  describe("convertErrorArrayToObject", () => {
    it("should convert an array of errors to an object", () => {
      const errors = [
        { param: "username", msg: "Username is required" },
        {
          param: "password",
          msg: "Password must be at least 8 characters long",
        },
        { param: "email", msg: "Invalid email format" },
      ];

      const result = convertErrorArrayToObject(errors);

      expect(result).to.deep.equal({
        username: "Username is required",
        password: "Password must be at least 8 characters long",
        email: "Invalid email format",
      });
    });

    it("should return an empty object for an empty array", () => {
      const errors = [];

      const result = convertErrorArrayToObject(errors);

      expect(result).to.deep.equal({});
    });

    it("should prefer item.message over item.msg when both are present", () => {
      const errors = [{ param: "email", message: "From message", msg: "From msg" }];

      const result = convertErrorArrayToObject(errors);

      expect(result).to.deep.equal({ email: "From message" });
    });
  });
});
