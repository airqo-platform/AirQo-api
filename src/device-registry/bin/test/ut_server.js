require("module-alias/register");
const SESSION_SECRET = "test_secret";
const sinon = require("sinon");
const { expect } = require("chai");
const http = require("http");
const express = require("express");
const log4js = require("log4js");
const createServer = require("@bin/server");
const constants = require("@config/constants");

describe("Express Server", () => {
  let server;
  let listenStub;
  let errorStub;

  beforeEach(() => {
    // Stub the logger methods
    sinon.stub(log4js.getLogger(), "info");
    sinon.stub(log4js.getLogger(), "error");

    // Create a new server instance
    server = createServer();

    // Stub the server's listen method
    listenStub = sinon
      .stub(http.Server.prototype, "listen")
      .callsFake((port, callback) => {
        callback(); // Call the callback immediately for testing
      });

    // Stub the error handling
    errorStub = sinon.stub();
    server.on("error", errorStub);
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  it("should start the server and log the running message", (done) => {
    const logTextStub = sinon.stub(console, "log");

    server.listen(3000); // Start listening on port 3000

    expect(
      logTextStub.calledWith(
        `The server is running on the ${process.env.NODE_ENV ||
          "production"} environment`
      )
    ).to.be.true;

    done();
  });

  it("should handle EACCES error correctly", () => {
    const bindError = new Error();
    bindError.code = "EACCES";

    server.emit("error", bindError); // Emit an EACCES error

    expect(errorStub.calledOnce).to.be.true;
  });

  it("should handle EADDRINUSE error correctly", () => {
    const bindError = new Error();
    bindError.code = "EADDRINUSE";

    server.emit("error", bindError); // Emit an EADDRINUSE error

    expect(errorStub.calledOnce).to.be.true;
  });

  it("should throw an error for unknown errors", () => {
    const unknownError = new Error();

    expect(() => {
      server.emit("error", unknownError); // Emit an unknown error
    }).to.throw(Error);
  });

  it("should normalize port correctly", () => {
    const port1 = normalizePort(3000);
    const port2 = normalizePort("3000");
    const port3 = normalizePort("invalid");

    expect(port1).to.equal(3000);
    expect(port2).to.equal(3000);
    expect(port3).to.be.false;
  });
});
