require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const { ObjectId } = require("mongoose").Types;
const proxyquire = require("proxyquire");
chai.use(require("sinon-chai"));

// The real, un-proxied controller — used as the default behavior for every
// stubbed route below, so that tests which don't override a given method
// still exercise the real controller (and, through it, real validation via
// extractErrorsFromRequest/handleRequest).
const createUserController = require("@controllers/user.controller");

// Express captures each route handler by reference at router-registration
// time (which happens once, below, when the router is required), so
// reassigning a property on the proxyquire stub object from inside an it()
// block has no effect on routes that already registered the old reference.
// Instead, every controller/middleware method actually exercised by a test
// is registered as a stable wrapper that delegates to a per-test-mutable
// "*Impl" variable (same convention used by ut_groups.routes.js). Each Impl
// defaults to delegating to the real controller/middleware; individual
// tests reassign the Impl variable, and the top-level afterEach resets it.
const defaultVerifyImpl = (req, res, next) =>
  createUserController.verify(req, res, next);
const defaultVerifyEmailImpl = (req, res, next) =>
  createUserController.verifyEmail(req, res, next);
const defaultListFeedbackStaffImpl = (req, res, next) =>
  createUserController.listFeedbackStaff(req, res, next);
const defaultCreateFirebaseUserImpl = (req, res, next) =>
  createUserController.createFirebaseUser(req, res, next);
const defaultLoginWithFirebaseImpl = (req, res, next) =>
  createUserController.loginWithFirebase(req, res, next);
const defaultSignUpWithFirebaseImpl = (req, res, next) =>
  createUserController.signUpWithFirebase(req, res, next);
const defaultVerifyFirebaseCustomTokenImpl = (req, res, next) =>
  createUserController.verifyFirebaseCustomToken(req, res, next);
const defaultEnhancedJWTAuthImpl = (req, res, next) => next();

let verifyImpl = defaultVerifyImpl;
let verifyEmailImpl = defaultVerifyEmailImpl;
let listFeedbackStaffImpl = defaultListFeedbackStaffImpl;
let createFirebaseUserImpl = defaultCreateFirebaseUserImpl;
let loginWithFirebaseImpl = defaultLoginWithFirebaseImpl;
let signUpWithFirebaseImpl = defaultSignUpWithFirebaseImpl;
let verifyFirebaseCustomTokenImpl = defaultVerifyFirebaseCustomTokenImpl;
let enhancedJWTAuthImpl = defaultEnhancedJWTAuthImpl;

const createUserControllerStub = {
  verify: (req, res, next) => verifyImpl(req, res, next),
  verifyEmail: (req, res, next) => verifyEmailImpl(req, res, next),
  listFeedbackStaff: (req, res, next) => listFeedbackStaffImpl(req, res, next),
  createFirebaseUser: (req, res, next) =>
    createFirebaseUserImpl(req, res, next),
  loginWithFirebase: (req, res, next) => loginWithFirebaseImpl(req, res, next),
  signUpWithFirebase: (req, res, next) =>
    signUpWithFirebaseImpl(req, res, next),
  // routes/v2/users.routes.js wires POST /firebase/verify to
  // verifyFirebaseCustomToken — that's the method the controller actually
  // exports (see controllers/user.controller.js); verifyFirebaseUser does
  // not exist.
  verifyFirebaseCustomToken: (req, res, next) =>
    verifyFirebaseCustomTokenImpl(req, res, next),
};

const passportStub = {
  // POST /verify and GET /feedback/staff are wired through enhancedJWTAuth
  // (see routes/v2/users.routes.js) — that's the name this router actually
  // imports from @middleware/passport, so that's the property that needs
  // stubbing, not setJWTAuth/authJWT (neither of which this router uses).
  enhancedJWTAuth: (req, res, next) => enhancedJWTAuthImpl(req, res, next),
};

// requirePermissions is applied on GET /feedback/staff; it does a real
// RBAC/DB-backed permission lookup on req.user, which this route-wiring
// unit test cannot satisfy, so it's stubbed to an unconditional pass-through
// (same convention used by ut_groups.routes.js for the same middleware).
const permissionAuthStub = {
  requirePermissions: () => (req, res, next) => next(),
};

const route = proxyquire("@routes/v2/users.routes", {
  "@controllers/user.controller": createUserControllerStub,
  "@middleware/passport": passportStub,
  "@middleware/permissionAuth": permissionAuthStub,
});

const app = express();
app.use(express.json());
app.use("/", route);
// Mirrors the real app-level error handler (bin/server.js): the controller
// reports failures via next(new HttpError(...)), whose .statusCode/.errors
// need to be translated into an actual HTTP response the way the real app
// does, otherwise every controller-reported error looks like a generic 500
// with the wrong body shape.
app.use((error, req, res, next) => {
  const status = error.status || error.statusCode || 500;
  res.status(status).json({
    success: false,
    message: error.message,
    errors: error.errors ?? { message: error.message },
  });
});

const postIdPayload = {
  // the payload for the POST '/verify' route
};

describe("User API Routes", () => {
  afterEach(() => {
    sinon.restore();
    verifyImpl = defaultVerifyImpl;
    verifyEmailImpl = defaultVerifyEmailImpl;
    listFeedbackStaffImpl = defaultListFeedbackStaffImpl;
    createFirebaseUserImpl = defaultCreateFirebaseUserImpl;
    loginWithFirebaseImpl = defaultLoginWithFirebaseImpl;
    signUpWithFirebaseImpl = defaultSignUpWithFirebaseImpl;
    verifyFirebaseCustomTokenImpl = defaultVerifyFirebaseCustomTokenImpl;
    enhancedJWTAuthImpl = defaultEnhancedJWTAuthImpl;
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
      // stub the auth middleware so POST /verify doesn't hit real JWT
      // verification.
      enhancedJWTAuthImpl = sinon.stub().callsFake((req, res, next) => next());
    });

    // POST /verify
    it("POST /verify: should verify successfully with setJWTAuth and authJWT", function (done) {
      verifyImpl = function (req, res) {
        res.sendStatus(200);
      };

      request(app).post("/verify").send(postIdPayload).expect(200, done);
    });

    // GET /verify/:user_id/:token
    it("GET /verify/:user_id/:token: should verify email successfully", function (done) {
      verifyEmailImpl = function (req, res) {
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

    it("GET /verify/:user_id/:token: should return 404 when user_id and token are not provided", function (done) {
      // user_id and token are required path segments, not query/body
      // fields, so an empty value for either means the URL simply doesn't
      // match the "/verify/:user_id/:token" pattern at all — Express 404s
      // before any validator or controller runs. (The validators' "is
      // missing" messages for these two params can never actually surface
      // through this route: a matched request always has both segments
      // present.)
      request(app).get("/verify//").expect(404, done);
    });

    it("GET /verify/:user_id/:token: should return error when user_id is not a valid Mongo objectID", function (done) {
      const params = { user_id: "invalid_id", token: "test_token" };

      request(app)
        .get(`/verify/${params.user_id}/${params.token}`)
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);
          expect(res.body.errors[0]).to.have.property(
            "message",
            "the user ID must be an object ID"
          );
          done();
        });
    });
  });

  describe("POST /firebase/create", () => {
    it("should create Firebase user with email", async () => {
      const stub = sinon
        .stub()
        .callsFake((req, res) =>
          res.status(200).json({ success: true, message: "User created" })
        );
      createFirebaseUserImpl = stub;

      const res = await request(app)
        .post("/firebase/create")
        .send({ email: "example@example.com" });

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        success: true,
        message: "User created",
      });
      expect(stub).to.have.been.calledOnce;
    });

    it("should create Firebase user with phoneNumber", async () => {
      const stub = sinon
        .stub()
        .callsFake((req, res) =>
          res.status(200).json({ success: true, message: "User created" })
        );
      createFirebaseUserImpl = stub;

      const res = await request(app)
        .post("/firebase/create")
        .send({ phoneNumber: "1234567890" });

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        success: true,
        message: "User created",
      });
      expect(stub).to.have.been.calledOnce;
    });

    it("should handle validation errors", async () => {
      // Neither email nor phoneNumber supplied — real validators
      // (userValidations.firebaseCreate) reject this before the (real,
      // un-stubbed) controller ever calls Firebase/util code.
      const res = await request(app).post("/firebase/create").send({});

      expect(res.status).to.equal(400);
      expect(res.body.success).to.equal(false);
      const messages = res.body.errors.map((e) => e.message);
      expect(messages).to.include(
        "the user identifier is missing in request, consider using the email"
      );
      expect(messages).to.include(
        "the user identifier is missing in request, consider using the phoneNumber"
      );
    });
  });

  describe("POST /firebase/login", () => {
    it("should login with Firebase using email", async () => {
      const stub = sinon
        .stub()
        .callsFake((req, res) =>
          res.status(200).json({ success: true, message: "Login successful" })
        );
      loginWithFirebaseImpl = stub;

      const res = await request(app)
        .post("/firebase/login")
        .send({ email: "example@example.com" });

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        success: true,
        message: "Login successful",
      });
      expect(stub).to.have.been.calledOnce;
    });

    it("should login with Firebase using phoneNumber", async () => {
      const stub = sinon
        .stub()
        .callsFake((req, res) =>
          res.status(200).json({ success: true, message: "Login successful" })
        );
      loginWithFirebaseImpl = stub;

      const res = await request(app)
        .post("/firebase/login")
        .send({ phoneNumber: "1234567890" });

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        success: true,
        message: "Login successful",
      });
      expect(stub).to.have.been.calledOnce;
    });

    it("should handle validation errors", async () => {
      const res = await request(app).post("/firebase/login").send({});

      expect(res.status).to.equal(400);
      expect(res.body.success).to.equal(false);
      const messages = res.body.errors.map((e) => e.message);
      expect(messages).to.include(
        "the user identifier is missing in request, consider using the email"
      );
      expect(messages).to.include(
        "the user identifier is missing in request, consider using the phoneNumber"
      );
    });
  });

  describe("POST /firebase/signup", () => {
    it("should sign up with Firebase using email", async () => {
      const stub = sinon
        .stub()
        .callsFake((req, res) =>
          res
            .status(200)
            .json({ success: true, message: "Sign up successful" })
        );
      signUpWithFirebaseImpl = stub;

      const res = await request(app)
        .post("/firebase/signup")
        .send({ email: "example@example.com" });

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        success: true,
        message: "Sign up successful",
      });
      expect(stub).to.have.been.calledOnce;
    });

    it("should sign up with Firebase using phoneNumber", async () => {
      const stub = sinon
        .stub()
        .callsFake((req, res) =>
          res
            .status(200)
            .json({ success: true, message: "Sign up successful" })
        );
      signUpWithFirebaseImpl = stub;

      const res = await request(app)
        .post("/firebase/signup")
        .send({ phoneNumber: "1234567890" });

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        success: true,
        message: "Sign up successful",
      });
      expect(stub).to.have.been.calledOnce;
    });

    it("should handle validation errors", async () => {
      const res = await request(app).post("/firebase/signup").send({});

      expect(res.status).to.equal(400);
      expect(res.body.success).to.equal(false);
      const messages = res.body.errors.map((e) => e.message);
      expect(messages).to.include(
        "the user identifier is missing in request, consider using the email"
      );
      expect(messages).to.include(
        "the user identifier is missing in request, consider using the phoneNumber"
      );
    });
  });

  describe("POST /firebase/verify", () => {
    it("should verify Firebase user with email", async () => {
      const stub = sinon
        .stub()
        .callsFake((req, res) =>
          res.status(200).json({ success: true, message: "User verified" })
        );
      verifyFirebaseCustomTokenImpl = stub;

      const res = await request(app)
        .post("/firebase/verify")
        .send({ token: "test_token", email: "example@example.com" });

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        success: true,
        message: "User verified",
      });
      expect(stub).to.have.been.calledOnce;
    });

    it("should verify Firebase user with phoneNumber", async () => {
      const stub = sinon
        .stub()
        .callsFake((req, res) =>
          res.status(200).json({ success: true, message: "User verified" })
        );
      verifyFirebaseCustomTokenImpl = stub;

      const res = await request(app)
        .post("/firebase/verify")
        .send({ token: "test_token", phoneNumber: "1234567890" });

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        success: true,
        message: "User verified",
      });
      expect(stub).to.have.been.calledOnce;
    });

    it("should handle validation errors", async () => {
      // token is missing entirely, and neither email nor phoneNumber is
      // supplied — real validators (userValidations.firebaseVerify) reject
      // this before the (real, un-stubbed) controller runs.
      const res = await request(app).post("/firebase/verify").send({});

      expect(res.status).to.equal(400);
      expect(res.body.success).to.equal(false);
      const messages = res.body.errors.map((e) => e.message);
      expect(messages).to.include("the token is missing in the request body");
    });
  });

  describe("GET /feedback/staff", () => {
    it("should return 200 and call listFeedbackStaff when authenticated", async () => {
      const stub = sinon
        .stub()
        .callsFake((req, res) =>
          res.status(200).json({ success: true, data: [] })
        );
      listFeedbackStaffImpl = stub;
      enhancedJWTAuthImpl = sinon.stub().callsFake((req, res, next) => {
        req.user = { _id: new ObjectId(), email: "admin@example.com" };
        next();
      });

      const res = await request(app)
        .get("/feedback/staff")
        .set("Authorization", "JWT testtoken");

      expect(res.status).to.equal(200);
      expect(stub).to.have.been.calledOnce;
    });
  });
});
