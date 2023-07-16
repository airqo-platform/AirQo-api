require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const app = require("../app");

chai.use(chaiHttp);
const { expect } = chai;

describe("Server", () => {
  let server;

  before((done) => {
    server = app.listen(3000, done);
  });

  after((done) => {
    server.close(done);
  });

  it("should respond with 404 Not Found on a non-existent endpoint", (done) => {
    chai
      .request(app)
      .get("/non-existent-endpoint")
      .end((err, res) => {
        expect(res).to.have.status(404);
        expect(res.body).to.deep.equal({
          success: false,
          message: "this endpoint does not exist",
          errors: { message: "Not Found" },
        });
        done();
      });
  });

  it("should handle a 400 Bad Request error", (done) => {
    chai
      .request(app)
      .get("/api/v1/incentives/hosts")
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body).to.deep.equal({
          success: false,
          message: "bad request errors",
          errors: { message: "Bad Request" },
        });
        done();
      });
  });

  // Add more tests for different error scenarios and routes

  it("should respond with 200 OK on a valid request", (done) => {
    chai
      .request(app)
      .get("/api/v1/incentives/hosts")
      .end((err, res) => {
        expect(res).to.have.status(200);
        // Assert the expected response body
        done();
      });
  });
});
