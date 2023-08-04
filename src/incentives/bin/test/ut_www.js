require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const app = require("@root/app");
const constants = require("@config/constants");

chai.use(chaiHttp);
const { expect } = chai;

describe("Server", () => {
  let server;

  before((done) => {
    server = app.listen(constants.PORT, done);
  });

  after((done) => {
    server.close(done);
  });

  it("should respond with 200 OK on a valid request", (done) => {
    chai
      .request(app)
      .get("/")
      .end((err, res) => {
        expect(res).to.have.status(200);
        done();
      });
  });

  it("should handle specific listen errors", (done) => {
    const otherServer = app.listen(constants.PORT);
    otherServer.on("error", (error) => {
      expect(error).to.exist;
      otherServer.close(done);
    });
  });
});
