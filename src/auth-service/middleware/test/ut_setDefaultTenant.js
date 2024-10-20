require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const setDefaultTenant = require("@middleware/setDefaultTenant");
const constants = require("@config/constants");

describe("setDefaultTenant Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      query: {},
    };
    res = {};
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore(); // Restore the original functionality of stubbed methods
  });

  it("should set the default tenant if tenant is empty", () => {
    // Set up the constant for testing
    constants.DEFAULT_TENANT = "defaultTenant";

    const middleware = setDefaultTenant;
    middleware(req, res, next);

    expect(req.query.tenant).to.equal("defaultTenant");
    expect(next.calledOnce).to.be.true; // Ensure next() is called
  });

  it("should keep the existing tenant if provided", () => {
    req.query.tenant = "customTenant";

    const middleware = setDefaultTenant;
    middleware(req, res, next);

    expect(req.query.tenant).to.equal("customTenant");
    expect(next.calledOnce).to.be.true; // Ensure next() is called
  });

  it("should use 'airqo' as the default tenant if no constant is defined", () => {
    // Temporarily remove DEFAULT_TENANT for this test
    const originalDefaultTenant = constants.DEFAULT_TENANT;
    delete constants.DEFAULT_TENANT;

    const middleware = setDefaultTenant;
    middleware(req, res, next);

    expect(req.query.tenant).to.equal("airqo");
    expect(next.calledOnce).to.be.true; // Ensure next() is called

    // Restore the original constant value after test
    constants.DEFAULT_TENANT = originalDefaultTenant;
  });
});
