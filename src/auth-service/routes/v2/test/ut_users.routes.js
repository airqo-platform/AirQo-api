require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const app = express();
const proxyquire = require("proxyquire");
const router = require("@routes/v2/users");
const { ObjectId } = require("mongoose").Types;
chai.use(require("sinon-chai"));
const { body, query } = require("express-validator");
app.use(express.json());
app.use("/", route);
app.use((error, req, res, next) => {
  // this error handler is necessary otherwise express stops if any middleware throws error
  res.status(500).json({ error: error.toString() });
});

// Import controllers and middleware (if needed)
const createUserController = require("@controllers/create-user");

let createUserControllerStub = {};
let passportStub = {};
let route = proxyquire("@routes/v1/users", {
  "@controllers/create-user": createUserControllerStub,
  "@middleware/passport": passportStub,
});

const postIdPayload = {
  // the payload for the POST '/verify' route
};

const verifyEmailPayload = {
  token: "test_token",
  email: "test_user@mail.com",
};

describe("User API Routes", () => {
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
  describe("Middleware", () => {
    // Tests for the 'headers' middleware function
    it("should set appropriate headers for CORS", () => {
      // Test the headers middleware function here
      // Use Sinon to create fake 'req', 'res', and 'next' objects
      // Check if the appropriate headers are set in the 'res' object
    });
  });

  describe("GET /deleteMobileUserData/:userId/:token", () => {
    // Tests for the 'deleteMobileUserData' route and controller function
    it("should delete mobile user data", () => {
      // Test the 'deleteMobileUserData' route and controller function here
      // Use Sinon to mock any database operations if necessary
      // Make a request to the route and check the response
      // Ensure the correct controller function is called with the right parameters
    });
  });

  describe("POST /loginUser", () => {
    // Tests for the 'loginUser' route and controller function
    it("should authenticate user and return JWT token", () => {
      // Test the 'loginUser' route and controller function here
      // Use Sinon to mock any database operations if necessary
      // Make a request to the route and check the response
      // Ensure the correct controller function is called with the right parameters
    });
  });

  describe("/verify endpoints", function () {
    beforeEach(() => {
      // stub auth middleware functions
      passportStub.setJWTAuth = sinon.stub().callsNext();
      passportStub.authJWT = sinon.stub().callsNext();
    });

    afterEach(() => {
      sinon.restore();
    });

    // POST /verify
    it("POST /verify: should verify successfully with setJWTAuth and authJWT", function (done) {
      createUserControllerStub.verify = function (req, res) {
        res.sendStatus(200);
      };

      request(app).post("/verify").send(postIdPayload).expect(200, done);
    });

    // GET /verify/:user_id/:token
    it("GET /verify/:user_id/:token: should verify email successfully", function (done) {
      createUserControllerStub.verifyEmail = function (req, res) {
        res.sendStatus(200);
      };

      const params = {
        user_id: new ObjectId(),
        token: "test_token",
      };

      request(app)
        .get(`/verify/${params.user_id}/${params.token}`)
        .expect(200, done);
    });

    it("GET /verify/:user_id/:token: should return error when user_id and token are not provided", function (done) {
      const params = { user_id: "", token: "" };

      request(app)
        .get(`/verify/${params.user_id}/${params.token}`)
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);
          expect(res.body.errors[0]).to.have.property(
            "msg",
            "the user ID param is missing in the request"
          );
          expect(res.body.errors[1]).to.have.property(
            "msg",
            "the token param is missing in the request"
          );
          done();
        });
    });

    it("GET /verify/:user_id/:token: should return error when user_id is not a valid Mongo objectID", function (done) {
      const params = { user_id: "invalid_id", token: "test_token" };

      request(app)
        .get(`/verify/${params.user_id}/${params.token}`)
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);
          expect(res.body.errors[0]).to.have.property(
            "msg",
            "the user ID must be an object ID"
          );
          done();
        });
    });
  });

  describe("POST /firebase/create", () => {
    it("should create Firebase user with email", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      req.body.email = "example@example.com";

      const createFirebaseUserStub = sinon
        .stub(createUserController, "createFirebaseUser")
        .resolves({
          success: true,
          message: "User created",
        });

      await createUserController.createFirebaseUser(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(createFirebaseUserStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "User created",
      });
    });

    it("should create Firebase user with phoneNumber", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      req.body.phoneNumber = "1234567890";

      const createFirebaseUserStub = sinon
        .stub(createUserController, "createFirebaseUser")
        .resolves({
          success: true,
          message: "User created",
        });

      await createUserController.createFirebaseUser(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(createFirebaseUserStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "User created",
      });
    });

    it("should handle validation errors", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            param: "email",
            msg: "Invalid email",
          },
        ],
      });

      const badRequestStub = sinon.stub().returnsThis();

      await createUserController.createFirebaseUser(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(badRequestStub).to.have.been.calledOnceWith(
        res,
        "Validation error",
        { email: "Invalid email" }
      );
    });
  });

  describe("POST /firebase/login", () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should login with Firebase using email", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      req.body.email = "example@example.com";

      const loginWithFirebaseStub = sinon
        .stub(createUserController, "loginWithFirebase")
        .resolves({
          success: true,
          message: "Login successful",
        });

      await createUserController.loginWithFirebase(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(loginWithFirebaseStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Login successful",
      });
    });

    it("should login with Firebase using phoneNumber", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      req.body.phoneNumber = "1234567890";

      const loginWithFirebaseStub = sinon
        .stub(createUserController, "loginWithFirebase")
        .resolves({
          success: true,
          message: "Login successful",
        });

      await createUserController.loginWithFirebase(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(loginWithFirebaseStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Login successful",
      });
    });

    it("should handle validation errors", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            param: "phoneNumber",
            msg: "Invalid phoneNumber",
          },
        ],
      });

      const badRequestStub = sinon.stub().returnsThis();

      await createUserController.loginWithFirebase(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(badRequestStub).to.have.been.calledOnceWith(
        res,
        "Validation error",
        { phoneNumber: "Invalid phoneNumber" }
      );
    });
  });

  describe("POST /firebase/signup", () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should sign up with Firebase using email", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      req.body.email = "example@example.com";

      const signUpWithFirebaseStub = sinon
        .stub(createUserController, "signUpWithFirebase")
        .resolves({
          success: true,
          message: "Sign up successful",
        });

      await createUserController.signUpWithFirebase(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(signUpWithFirebaseStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Sign up successful",
      });
    });

    it("should sign up with Firebase using phoneNumber", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      req.body.phoneNumber = "1234567890";

      const signUpWithFirebaseStub = sinon
        .stub(createUserController, "signUpWithFirebase")
        .resolves({
          success: true,
          message: "Sign up successful",
        });

      await createUserController.signUpWithFirebase(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(signUpWithFirebaseStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Sign up successful",
      });
    });

    it("should handle validation errors", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            param: "phoneNumber",
            msg: "Invalid phoneNumber",
          },
        ],
      });

      const badRequestStub = sinon.stub().returnsThis();

      await createUserController.signUpWithFirebase(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(badRequestStub).to.have.been.calledOnceWith(
        res,
        "Validation error",
        { phoneNumber: "Invalid phoneNumber" }
      );
    });
  });

  describe("POST /firebase/verify", () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should verify Firebase user with email", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      req.body.email = "example@example.com";

      const verifyFirebaseUserStub = sinon
        .stub(createUserController, "verifyFirebaseUser")
        .resolves({
          success: true,
          message: "User verified",
        });

      await createUserController.verifyFirebaseUser(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(verifyFirebaseUserStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "User verified",
      });
    });

    it("should verify Firebase user with phoneNumber", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(true),
      });

      req.body.phoneNumber = "1234567890";

      const verifyFirebaseUserStub = sinon
        .stub(createUserController, "verifyFirebaseUser")
        .resolves({
          success: true,
          message: "User verified",
        });

      await createUserController.verifyFirebaseUser(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(verifyFirebaseUserStub).to.have.been.calledOnceWith(req);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "User verified",
      });
    });

    it("should handle validation errors", async () => {
      const validationResultStub = sinon.stub().returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            param: "email",
            msg: "Invalid email",
          },
        ],
      });

      const badRequestStub = sinon.stub().returnsThis();

      await createUserController.verifyFirebaseUser(req, res);

      expect(validationResultStub).to.have.been.calledOnceWith(req);
      expect(badRequestStub).to.have.been.calledOnceWith(
        res,
        "Validation error",
        { email: "Invalid email" }
      );
    });
  });
});
