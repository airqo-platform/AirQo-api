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

  let origCloudName, origApiKey, origApiSecret;

  beforeEach(() => {
    // Save and inject env vars so @config/cloudinary reads deterministic values
    origCloudName = process.env.CLOUD_NAME;
    origApiKey = process.env.CLOUDINARY_API_KEY;
    origApiSecret = process.env.CLOUDINARY_API_SECRET;

    process.env.CLOUD_NAME = env.CLOUD_NAME;
    process.env.CLOUDINARY_API_KEY = env.CLOUDINARY_API_KEY;
    process.env.CLOUDINARY_API_SECRET = env.CLOUDINARY_API_SECRET;

    configStub = sinon.stub();

    // Require @config/cloudinary AFTER env and stubs are in place
    cloudinary = proxyquire("@config/cloudinary", {
      cloudinary: { v2: { config: configStub } },
    });
  });

  afterEach(() => {
    process.env.CLOUD_NAME = origCloudName;
    process.env.CLOUDINARY_API_KEY = origApiKey;
    process.env.CLOUDINARY_API_SECRET = origApiSecret;
    sinon.restore();
  });

  it("should export the cloudinary v2 instance", () => {
    expect(cloudinary).to.exist;
  });

  it("should call cloudinary.config with the correct credential values", () => {
    expect(configStub.calledOnce).to.be.true;
    const args = configStub.firstCall.args[0];
    expect(args.cloud_name).to.equal(env.CLOUD_NAME);
    expect(args.api_key).to.equal(env.CLOUDINARY_API_KEY);
    expect(args.api_secret).to.equal(env.CLOUDINARY_API_SECRET);
  });
});
