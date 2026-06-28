require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru().noPreserveCache();

describe("Cloudinary Configuration", () => {
  let configStub;
  let cloudinary;

  const env = {
    CLOUD_NAME: "sample_cloud_name",
    CLOUDINARY_API_KEY: "sample_api_key",
    CLOUDINARY_API_SECRET: "sample_api_secret",
  };

  beforeEach(() => {
    configStub = sinon.stub();

    // Require @config/cloudinary AFTER stubs are in place so config() is captured
    cloudinary = proxyquire("@config/cloudinary", {
      cloudinary: { v2: { config: configStub } },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should export the cloudinary v2 instance", () => {
    expect(cloudinary).to.exist;
  });

  it("should call cloudinary.config with cloud_name, api_key, api_secret", () => {
    expect(configStub.calledOnce).to.be.true;
    const args = configStub.firstCall.args[0];
    expect(args).to.have.property("cloud_name");
    expect(args).to.have.property("api_key");
    expect(args).to.have.property("api_secret");
  });
});
