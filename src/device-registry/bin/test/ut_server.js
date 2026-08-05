require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const http = require("http");
const log4js = require("log4js");
const createServer = require("@bin/server");

describe("Express Server", () => {
  let server;
  let listenStub;

  before(() => {
    // Stub listen BEFORE createServer() so the real port is never bound.
    // Call createServer() only once — each call registers SIGINT/SIGTERM/
    // uncaughtException/unhandledRejection on process; multiple calls
    // accumulate handlers and can trigger gracefulShutdown during tests.
    listenStub = sinon
      .stub(http.Server.prototype, "listen")
      .callsFake(function (port, callback) {
        if (typeof callback === "function") callback();
        return this;
      });

    sinon.stub(log4js.getLogger(), "info");
    sinon.stub(log4js.getLogger(), "error");

    server = createServer();
  });

  after(() => {
    sinon.restore();
  });

  it("should return an http.Server instance", () => {
    expect(server).to.be.an.instanceof(http.Server);
  });

  it("should start listening on the configured port", () => {
    expect(listenStub.called).to.be.true;
  });

  it("should throw for unknown non-listen errors", () => {
    const unknownError = new Error("unexpected error");
    expect(() => {
      server.emit("error", unknownError);
    }).to.throw(Error, "unexpected error");
  });
});
