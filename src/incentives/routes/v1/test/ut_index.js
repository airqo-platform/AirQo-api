const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const router = require("./router"); // Import your router module here

describe("Router Tests", () => {
  let app;

  before(() => {
    app = express();
    app.use("/api/v1", router); // Mount the router under the desired path
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should use /transactions route", () => {
    const transactionsRouteStub = sinon
      .stub()
      .returns("transactions middleware");
    sinon
      .stub(require("@routes/v1/transactions"), "use")
      .callsFake(transactionsRouteStub);

    const route = app._router.stack.find(
      (layer) => layer.route.path === "/transactions"
    );

    expect(route).to.not.be.undefined;
    expect(transactionsRouteStub.calledOnce).to.be.true;
    expect(route.route.stack[0].handle).to.equal("transactions middleware");
  });

  it("should use /hosts route", () => {
    const hostsRouteStub = sinon.stub().returns("hosts middleware");
    sinon.stub(require("@routes/v1/hosts"), "use").callsFake(hostsRouteStub);

    const route = app._router.stack.find(
      (layer) => layer.route.path === "/hosts"
    );

    expect(route).to.not.be.undefined;
    expect(hostsRouteStub.calledOnce).to.be.true;
    expect(route.route.stack[0].handle).to.equal("hosts middleware");
  });
});
