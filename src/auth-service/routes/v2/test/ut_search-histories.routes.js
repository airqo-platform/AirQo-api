require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const sinon = require("sinon");
const express = require("express");
const app = express();
const expect = chai.expect;
chai.use(chaiHttp);

const createSearchHistoryController = require("@controllers/create-search-history"); // Replace with the correct path to the controller file

describe("create-search-history Routes", () => {
  describe("headers middleware", () => {
    let req, res, next;

    beforeEach(() => {
      req = {};
      res = {
        header: sinon.stub(),
      };
      next = sinon.stub();
    });

    it("should set the correct headers and call 'next'", () => {
      // Call the middleware
      headers(req, res, next);

      // Assert that the appropriate headers were set
      expect(res.header.calledWith("Access-Control-Allow-Origin", "*")).to.be
        .true;
      expect(
        res.header.calledWith(
          "Access-Control-Allow-Headers",
          "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        )
      ).to.be.true;
      expect(
        res.header.calledWith(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE"
        )
      ).to.be.true;

      // Assert that 'next' was called
      expect(next.calledOnce).to.be.true;
    });
  });
  describe("GET /", () => {
    // Define test data, if needed

    before(() => {
      // Set up any necessary mocks or stubs using Sinon, if needed
    });

    after(() => {
      // Clean up any resources, if needed
    });

    beforeEach(() => {
      // Set up fresh request and response objects before each test case
    });

    afterEach(() => {
      // Clean up any modifications to request/response objects after each test case
    });

    it("should return 200 status and search histories when valid request is made", (done) => {
      // Set up any necessary request data, such as query parameters
      const req = {
        query: {
          tenant: "kcca", // Replace with the desired tenant value for testing
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      createSearchHistoryController
        .list(req, res)
        .then(() => {
          // Assert that the status and response were as expected
          expect(res.status).to.have.been.calledWith(200);
          expect(res.json).to.have.been.calledWith(
            sinon.match({ success: true, search_histories: sinon.match.array })
          );

          // Add additional assertions as needed based on the expected response
          // For example, you can check the properties of the returned search histories

          done();
        })
        .catch(done);
    });

    it("should return 400 status and bad request errors when invalid tenant is provided", (done) => {
      // Set up any necessary request data, such as query parameters
      const req = {
        query: {
          tenant: "invalid_tenant", // Replace with an invalid tenant value for testing
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      createSearchHistoryController
        .list(req, res)
        .then(() => {
          // Assert that the status and response were as expected
          expect(res.status).to.have.been.calledWith(400);
          expect(res.json).to.have.been.calledWith(
            sinon.match({ success: false, errors: sinon.match.object })
          );

          // Add additional assertions as needed based on the expected response
          // For example, you can check the specific error messages

          done();
        })
        .catch(done);
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("GET /users/:firebase_user_id", () => {
    // Define test data, if needed

    before(() => {
      // Set up any necessary mocks or stubs using Sinon, if needed
    });

    after(() => {
      // Clean up any resources, if needed
    });

    beforeEach(() => {
      // Set up fresh request and response objects before each test case
    });

    afterEach(() => {
      // Clean up any modifications to request/response objects after each test case
    });

    it("should return 200 status and search histories when valid request is made", (done) => {
      // Set up any necessary request data, such as query parameters and params
      const req = {
        query: {
          tenant: "kcca", // Replace with the desired tenant value for testing
        },
        params: {
          firebase_user_id: "some_user_id", // Replace with the desired firebase_user_id for testing
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      createSearchHistoryController
        .list(req, res)
        .then(() => {
          // Assert that the status and response were as expected
          expect(res.status).to.have.been.calledWith(200);
          expect(res.json).to.have.been.calledWith(
            sinon.match({ success: true, search_histories: sinon.match.array })
          );

          // Add additional assertions as needed based on the expected response
          // For example, you can check the properties of the returned search histories

          done();
        })
        .catch(done);
    });

    it("should return 400 status and bad request errors when invalid tenant is provided", (done) => {
      // Set up any necessary request data, such as query parameters and params
      const req = {
        query: {
          tenant: "invalid_tenant", // Replace with an invalid tenant value for testing
        },
        params: {
          firebase_user_id: "some_user_id", // Replace with the desired firebase_user_id for testing
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      createSearchHistoryController
        .list(req, res)
        .then(() => {
          // Assert that the status and response were as expected
          expect(res.status).to.have.been.calledWith(400);
          expect(res.json).to.have.been.calledWith(
            sinon.match({ success: false, errors: sinon.match.object })
          );

          // Add additional assertions as needed based on the expected response
          // For example, you can check the specific error messages

          done();
        })
        .catch(done);
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("POST /", () => {
    // Define test data, if needed

    before(() => {
      // Set up any necessary mocks or stubs using Sinon, if needed
    });

    after(() => {
      // Clean up any resources, if needed
    });

    beforeEach(() => {
      // Set up fresh request and response objects before each test case
    });

    afterEach(() => {
      // Clean up any modifications to request/response objects after each test case
    });

    it("should return 200 status and success message when valid request is made", (done) => {
      // Set up any necessary request data, such as query parameters and body
      const req = {
        query: {
          tenant: "kcca", // Replace with the desired tenant value for testing
        },
        body: {
          name: "Test Name", // Replace with the desired name value for testing
          location: "Test Location", // Replace with the desired location value for testing
          place_id: "Test Place ID", // Replace with the desired place_id value for testing
          firebase_user_id: "Test Firebase User ID", // Replace with the desired firebase_user_id value for testing
          latitude: "1.23456", // Replace with the desired latitude value for testing
          longitude: "12.34567", // Replace with the desired longitude value for testing
          date_time: "2023-07-25T12:34:56Z", // Replace with the desired date_time value for testing
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      createSearchHistoryController
        .create(req, res)
        .then(() => {
          // Assert that the status and response were as expected
          expect(res.status).to.have.been.calledWith(200);
          expect(res.json).to.have.been.calledWith(
            sinon.match({ success: true, message: sinon.match.string })
          );

          // Add additional assertions as needed based on the expected response

          done();
        })
        .catch(done);
    });

    it("should return 400 status and bad request errors when invalid request body is provided", (done) => {
      // Set up any necessary request data, such as query parameters and body
      const req = {
        query: {
          tenant: "invalid_tenant", // Replace with an invalid tenant value for testing
        },
        body: {}, // Empty body to simulate an invalid request
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      createSearchHistoryController
        .create(req, res)
        .then(() => {
          // Assert that the status and response were as expected
          expect(res.status).to.have.been.calledWith(400);
          expect(res.json).to.have.been.calledWith(
            sinon.match({ success: false, errors: sinon.match.object })
          );

          // Add additional assertions as needed based on the expected response
          // For example, you can check the specific error messages

          done();
        })
        .catch(done);
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("POST /syncSearchHistory/:firebase_user_id", () => {
    // Define test data, if needed

    before(() => {
      // Set up any necessary mocks or stubs using Sinon, if needed
    });

    after(() => {
      // Clean up any resources, if needed
    });

    beforeEach(() => {
      // Set up fresh request and response objects before each test case
    });

    afterEach(() => {
      // Clean up any modifications to request/response objects after each test case
    });

    it("should return 200 status and success message when valid request is made", (done) => {
      // Set up any necessary request data, such as query parameters and body
      const req = {
        query: {
          tenant: "kcca", // Replace with the desired tenant value for testing
        },
        params: {
          firebase_user_id: "TestFirebaseUserID", // Replace with the desired firebase_user_id value for testing
        },
        body: {
          search_histories: [
            {
              name: "Test Name 1", // Replace with the desired name value for testing
              location: "Test Location 1", // Replace with the desired location value for testing
              place_id: "Test Place ID 1", // Replace with the desired place_id value for testing
              firebase_user_id: "Test Firebase User ID 1", // Replace with the desired firebase_user_id value for testing
              latitude: "1.23456", // Replace with the desired latitude value for testing
              longitude: "12.34567", // Replace with the desired longitude value for testing
              date_time: "2023-07-25T12:34:56Z", // Replace with the desired date_time value for testing
            },
            // Add more search history objects as needed for testing
          ],
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      createSearchHistoryController
        .syncSearchHistory(req, res)
        .then(() => {
          // Assert that the status and response were as expected
          expect(res.status).to.have.been.calledWith(200);
          expect(res.json).to.have.been.calledWith(
            sinon.match({ success: true, message: sinon.match.string })
          );

          // Add additional assertions as needed based on the expected response

          done();
        })
        .catch(done);
    });

    it("should return 400 status and bad request errors when invalid request body is provided", (done) => {
      // Set up any necessary request data, such as query parameters and body
      const req = {
        query: {
          tenant: "invalid_tenant", // Replace with an invalid tenant value for testing
        },
        params: {
          firebase_user_id: "TestFirebaseUserID", // Replace with the desired firebase_user_id value for testing
        },
        body: {}, // Empty body to simulate an invalid request
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the controller function
      createSearchHistoryController
        .syncSearchHistory(req, res)
        .then(() => {
          // Assert that the status and response were as expected
          expect(res.status).to.have.been.calledWith(400);
          expect(res.json).to.have.been.calledWith(
            sinon.match({ success: false, errors: sinon.match.object })
          );

          // Add additional assertions as needed based on the expected response
          // For example, you can check the specific error messages

          done();
        })
        .catch(done);
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("PUT /:search_history_id", () => {
    // Define test data, if needed

    before(() => {
      // Set up any necessary mocks or stubs using Sinon, if needed
    });

    after(() => {
      // Clean up any resources, if needed
    });

    beforeEach(() => {
      // Set up fresh request and response objects before each test case
    });

    afterEach(() => {
      // Clean up any modifications to request/response objects after each test case
    });

    it("should return 200 status and success message when valid request is made", (done) => {
      // Set up any necessary request data, such as query parameters, parameters, and body
      const req = {
        params: {
          search_history_id: "TestSearchHistoryID", // Replace with the desired search_history_id value for testing
        },
        body: {
          name: "Test Name", // Replace with the desired name value for testing
          location: "Test Location", // Replace with the desired location value for testing
          place_id: "Test Place ID", // Replace with the desired place_id value for testing
          firebase_user_id: "Test Firebase User ID", // Replace with the desired firebase_user_id value for testing
          latitude: "1.23456", // Replace with the desired latitude value for testing
          longitude: "12.34567", // Replace with the desired longitude value for testing
          date_time: "2023-07-25T12:34:56Z", // Replace with the desired date_time value for testing
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the middleware and the controller function
      const middleware = createSearchHistoryController[0];
      const controller =
        createSearchHistoryController[createSearchHistoryController.length - 1];

      middleware(req, res, () => {
        controller(req, res)
          .then(() => {
            // Assert that the status and response were as expected
            expect(res.status).to.have.been.calledWith(200);
            expect(res.json).to.have.been.calledWith(
              sinon.match({ success: true, message: sinon.match.string })
            );

            // Add additional assertions as needed based on the expected response

            done();
          })
          .catch(done);
      });
    });

    it("should return 400 status and bad request errors when invalid request body is provided", (done) => {
      // Set up any necessary request data, such as query parameters, parameters, and body
      const req = {
        params: {
          search_history_id: "TestSearchHistoryID", // Replace with the desired search_history_id value for testing
        },
        body: {}, // Empty body to simulate an invalid request
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the middleware and the controller function
      const middleware = createSearchHistoryController[0];
      const controller =
        createSearchHistoryController[createSearchHistoryController.length - 1];

      middleware(req, res, () => {
        controller(req, res)
          .then(() => {
            // Assert that the status and response were as expected
            expect(res.status).to.have.been.calledWith(400);
            expect(res.json).to.have.been.calledWith(
              sinon.match({ success: false, errors: sinon.match.object })
            );

            // Add additional assertions as needed based on the expected response
            // For example, you can check the specific error messages

            done();
          })
          .catch(done);
      });
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("DELETE /:search_history_id", () => {
    // Define test data, if needed

    before(() => {
      // Set up any necessary mocks or stubs using Sinon, if needed
    });

    after(() => {
      // Clean up any resources, if needed
    });

    beforeEach(() => {
      // Set up fresh request and response objects before each test case
    });

    afterEach(() => {
      // Clean up any modifications to request/response objects after each test case
    });

    it("should return 200 status and success message when valid request is made", (done) => {
      // Set up any necessary request data, such as query parameters, parameters, and body
      const req = {
        params: {
          search_history_id: "TestSearchHistoryID", // Replace with the desired search_history_id value for testing
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the middleware and the controller function
      const middleware = createSearchHistoryController[0];
      const controller =
        createSearchHistoryController[createSearchHistoryController.length - 1];

      middleware(req, res, () => {
        controller(req, res)
          .then(() => {
            // Assert that the status and response were as expected
            expect(res.status).to.have.been.calledWith(200);
            expect(res.json).to.have.been.calledWith(
              sinon.match({ success: true, message: sinon.match.string })
            );

            // Add additional assertions as needed based on the expected response

            done();
          })
          .catch(done);
      });
    });

    it("should return 400 status and bad request errors when invalid search_history_id is provided", (done) => {
      // Set up any necessary request data, such as query parameters, parameters, and body
      const req = {
        params: {
          search_history_id: "InvalidSearchHistoryID", // Replace with an invalid search_history_id value for testing
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the middleware and the controller function
      const middleware = createSearchHistoryController[0];
      const controller =
        createSearchHistoryController[createSearchHistoryController.length - 1];

      middleware(req, res, () => {
        controller(req, res)
          .then(() => {
            // Assert that the status and response were as expected
            expect(res.status).to.have.been.calledWith(400);
            expect(res.json).to.have.been.calledWith(
              sinon.match({ success: false, errors: sinon.match.object })
            );

            // Add additional assertions as needed based on the expected response
            // For example, you can check the specific error messages

            done();
          })
          .catch(done);
      });
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("GET /:search_history_id", () => {
    // Define test data, if needed

    before(() => {
      // Set up any necessary mocks or stubs using Sinon, if needed
    });

    after(() => {
      // Clean up any resources, if needed
    });

    beforeEach(() => {
      // Set up fresh request and response objects before each test case
    });

    afterEach(() => {
      // Clean up any modifications to request/response objects after each test case
    });

    it("should return 200 status and data when valid request is made", (done) => {
      // Set up any necessary request data, such as query parameters, parameters, and body
      const req = {
        params: {
          search_history_id: "TestSearchHistoryID", // Replace with the desired search_history_id value for testing
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the middleware and the controller function
      const middleware = createSearchHistoryController[0];
      const controller =
        createSearchHistoryController[createSearchHistoryController.length - 1];

      middleware(req, res, () => {
        controller(req, res)
          .then(() => {
            // Assert that the status and response were as expected
            expect(res.status).to.have.been.calledWith(200);
            expect(res.json).to.have.been.calledWith(
              sinon.match({ success: true, data: sinon.match.object })
            );

            // Add additional assertions as needed based on the expected response

            done();
          })
          .catch(done);
      });
    });

    it("should return 400 status and bad request errors when invalid search_history_id is provided", (done) => {
      // Set up any necessary request data, such as query parameters, parameters, and body
      const req = {
        params: {
          search_history_id: "InvalidSearchHistoryID", // Replace with an invalid search_history_id value for testing
        },
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Call the middleware and the controller function
      const middleware = createSearchHistoryController[0];
      const controller =
        createSearchHistoryController[createSearchHistoryController.length - 1];

      middleware(req, res, () => {
        controller(req, res)
          .then(() => {
            // Assert that the status and response were as expected
            expect(res.status).to.have.been.calledWith(400);
            expect(res.json).to.have.been.calledWith(
              sinon.match({ success: false, errors: sinon.match.object })
            );

            // Add additional assertions as needed based on the expected response
            // For example, you can check the specific error messages

            done();
          })
          .catch(done);
      });
    });

    // Add more test cases as needed to cover different scenarios
  });
});
