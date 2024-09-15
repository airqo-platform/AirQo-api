require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const app = express();
const proxyquire = require("proxyquire");
const router = require("@routes/v1/users");
const { ObjectId } = require("mongoose").Types;

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

  describe("POST /firebase/signup", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return 200 and call createUserController.signUpWithFirebase when email provided", (done) => {
      const signUpWithFirebaseStub = sinon.stub(
        createUserController,
        "signUpWithFirebase"
      );
      signUpWithFirebaseStub.resolves({ success: true });

      const user = { email: "test@example.com" };

      request(router)
        .post("/firebase/signup")
        .send(user)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(signUpWithFirebaseStub.calledOnce).to.be.true;
          expect(res.body).to.deep.equal({ success: true });
          done();
        });
    });

    it("should return 200 and call createUserController.signUpWithFirebase when phoneNumber provided", (done) => {
      const signUpWithFirebaseStub = sinon.stub(
        createUserController,
        "signUpWithFirebase"
      );
      signUpWithFirebaseStub.resolves({ success: true });

      const user = { phoneNumber: "+1234567890" };

      request(router)
        .post("/firebase/signup")
        .send(user)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(signUpWithFirebaseStub.calledOnce).to.be.true;
          expect(res.body).to.deep.equal({ success: true });
          done();
        });
    });

    it("should return 422 when email and phoneNumber are missing", (done) => {
      request(router)
        .post("/firebase/signup")
        .send({})
        .expect(422)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.errors).to.have.lengthOf(1);
          expect(res.body.errors[0].msg).to.equal(
            "the user identifier is missing in request, consider using the email"
          );
          done();
        });
    });

    it("should return 422 when both email and phoneNumber are provided", (done) => {
      const user = { email: "test@example.com", phoneNumber: "+1234567890" };

      request(router)
        .post("/firebase/signup")
        .send(user)
        .expect(422)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.errors).to.have.lengthOf(1);
          expect(res.body.errors[0].msg).to.equal(
            "the user identifier is missing in request, consider using the email"
          );
          done();
        });
    });

    it("should return 422 when email is invalid", (done) => {
      const user = { email: "invalid-email" };

      request(router)
        .post("/firebase/signup")
        .send(user)
        .expect(422)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.errors).to.have.lengthOf(1);
          expect(res.body.errors[0].msg).to.equal(
            "this is not a valid email address"
          );
          done();
        });
    });

    it("should return 422 when phoneNumber is invalid", (done) => {
      const user = { phoneNumber: "invalid-phone-number" };

      request(router)
        .post("/firebase/signup")
        .send(user)
        .expect(422)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.errors).to.have.lengthOf(1);
          expect(res.body.errors[0].msg).to.equal(
            "the phoneNumber must be valid"
          );
          done();
        });
    });
  });

  describe("/firebase/verify POST endpoint", function () {
    it("should successfully verify email", function (done) {
      createUserControllerStub.verifyFirebaseCustomToken = function (req, res) {
        res.sendStatus(200);
      };

      request(app)
        .post("/firebase/verify")
        .send(verifyEmailPayload)
        .expect(200, done);
    });

    it("should return validation error if token and email are not provided", function (done) {
      const payload = {};
      createUserControllerStub.verifyFirebaseCustomToken = function (req, res) {
        res.sendStatus(200);
      };

      request(app)
        .post("/firebase/verify")
        .send(payload)
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);
          expect(res.body.errors[0]).to.have.property(
            "msg",
            "the token is missing in the request body"
          );
          expect(res.body.errors[1]).to.have.property(
            "msg",
            "a user identifier is missing in request, consider using email"
          );
          done();
        });
    });

    it("should return validation error if email is not valid", function (done) {
      const payload = {
        token: "test_token",
        email: "test_user",
      };
      createUserControllerStub.verifyFirebaseCustomToken = function (req, res) {
        res.sendStatus(200);
      };

      request(app)
        .post("/firebase/verify")
        .send(payload)
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);
          expect(res.body.errors[0]).to.have.property(
            "msg",
            "this is not a valid email address"
          );
          done();
        });
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
});
