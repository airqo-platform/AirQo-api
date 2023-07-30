require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const app = express();

// Import controllers and middleware (if needed)
const createUserController = require("@controllers/create-user");

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
  // Add more describe blocks for other routes and controller functions...

  // Add a describe block for each route and its corresponding controller function

  // Add tests for other routes and controller functions...
});

// Helper function to start the server and handle cleanup
function startServer() {
  const server = app.listen(3000, () => {
    console.log("Server started");
  });
  return server;
}

function closeServer(server) {
  server.close(() => {
    console.log("Server closed");
  });
}

// Start the server before running tests and close it after tests are finished
let server;
before(() => {
  server = startServer();
});

after(() => {
  closeServer(server);
});
