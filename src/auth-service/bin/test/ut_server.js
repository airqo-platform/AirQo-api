require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const http = require("http");

const createServer = require("@bin/server");

describe("createServer", () => {
  let mockServer;
  let httpCreateServerStub;
  let consoleErrorStub;
  let processExitStub;

  beforeEach(() => {
    mockServer = {
      listen: sinon.stub(),
      on: sinon.stub(),
      address: sinon.stub().returns({ port: 5000 }),
    };
    httpCreateServerStub = sinon.stub(http, "createServer").returns(mockServer);
    consoleErrorStub = sinon.stub(console, "error");
    sinon.stub(console, "log");
    processExitStub = sinon.stub(process, "exit");
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should create and start the server", () => {
    process.env.PORT = "5000";

    createServer();

    expect(httpCreateServerStub.calledOnce).to.be.true;
    expect(mockServer.listen.calledWith(5000)).to.be.true;
    expect(mockServer.on.calledWith("error", sinon.match.func)).to.be.true;
    expect(mockServer.on.calledWith("listening", sinon.match.func)).to.be.true;
  });

  it("should handle server listen error", () => {
    process.env.PORT = "5000";

    mockServer.on.callsFake((event, cb) => {
      if (event === "error") {
        const err = new Error("Address already in use");
        err.code = "EADDRINUSE";
        err.syscall = "listen";
        cb(err);
      }
    });

    createServer();

    const errorMsg = consoleErrorStub.firstCall && consoleErrorStub.firstCall.args[0];
    expect(errorMsg).to.include("is already in use");
    expect(processExitStub.calledWith(1)).to.be.true;
  });
});
