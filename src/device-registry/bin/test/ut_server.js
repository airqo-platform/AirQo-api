require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const http = require("http");
const express = require("express");
const createServer = require("@bin/server");

describe("createServer", () => {
  let httpCreateServerStub;
  let appSetStub;
  let httpListenStub;
  let consoleErrorStub;
  let consoleLogStub;
  let serverAddressStub;
  let debugStub;

  beforeEach(() => {
    // Create stubs for required modules/functions
    httpCreateServerStub = sinon.stub(http, "createServer");
    appSetStub = sinon.stub();
    httpListenStub = sinon.stub();
    consoleErrorStub = sinon.stub(console, "error");
    consoleLogStub = sinon.stub(console, "log");
    serverAddressStub = sinon.stub();
    debugStub = sinon.stub();

    httpCreateServerStub.returns({
      listen: httpListenStub,
      on: sinon.stub().callsFake((event, cb) => {
        if (event === "error") {
          cb({ code: "EADDRINUSE" });
        }
      }),
      address: serverAddressStub,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should create and start the server", () => {
    // Mock the environment variable
    process.env.PORT = "5000";

    try {
      // Call the createServer function
      createServer();

      // Check if the necessary functions are called with the correct arguments
      expect(httpCreateServerStub.calledOnce).to.be.true;
      expect(appSetStub.calledWithExactly("port", "5000")).to.be.true;
      expect(httpListenStub.calledWithExactly("5000")).to.be.true;
      expect(
        consoleLogStub.calledOnceWithExactly(
          "The server is running on the production environment"
        )
      ).to.be.true;
      expect(serverAddressStub.calledOnce).to.be.true;
      expect(debugStub.calledOnce).to.be.true;
    } catch (error) {
      throw error;
    }
  });

  it("should handle server listen error", () => {
    // Mock the environment variable
    process.env.PORT = "5000";

    try {
      // Call the createServer function
      createServer();

      // Check if the error is caught and logged
      expect(
        consoleErrorStub.calledOnceWithExactly("Port 5000 is already in use")
      ).to.be.true;
      expect(process.exit.calledOnceWithExactly(1)).to.be.true;
    } catch (error) {
      throw error;
    }
  });

  // Add more test cases as needed
});
