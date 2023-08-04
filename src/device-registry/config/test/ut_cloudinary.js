require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const cloudinary = require("@config/cloudinary");

describe("Cloudinary Configuration", () => {
  // Create stubs for environment variables
  const env = {
    CLOUD_NAME: "sample_cloud_name",
    CLOUDINARY_API_KEY: "sample_api_key",
    CLOUDINARY_API_SECRET: "sample_api_secret",
  };

  before(() => {
    // Stub the process.env object with our custom environment variables
    sinon.stub(process, "env").value(env);
  });

  after(() => {
    // Restore the original process.env object after the tests
    sinon.restore();
  });

  describe("Cloudinary Configuration Initialization", () => {
    it("should initialize Cloudinary with the correct configuration", () => {
      const cloudinaryConfigSpy = sinon.spy(cloudinary, "config");

      // Require the module again to trigger the configuration
      // This should happen inside the cloudinaryConfig module
      require("./cloudinaryConfig");

      // Assert that cloudinary.config was called with the correct values
      expect(cloudinaryConfigSpy.calledOnce).to.be.true;
      expect(cloudinaryConfigSpy.firstCall.args[0]).to.deep.equal({
        cloud_name: env.CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
      });

      cloudinaryConfigSpy.restore();
    });
  });

  // Add more describe blocks for other configuration tests if necessary
});
