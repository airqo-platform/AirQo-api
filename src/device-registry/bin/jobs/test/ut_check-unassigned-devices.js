require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const sinonChai = require("sinon-chai");
const checkUnassignedDevices = require("@bin/jobs/check-unassigned-devices");

describe("checkUnassignedDevices", () => {
  let DeviceModelMock;
  let logTextSpy;
  let logObjectSpy;

  beforeEach(() => {
    DeviceModelMock = sinon.mock(DeviceModel);
    logTextSpy = sinon.spy(console.log);
    logObjectSpy = sinon.spy(console.log);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("when devices are assigned to categories", () => {
    it("should not log anything", async () => {
      DeviceModelMock.expects("countDocuments").resolves(100);
      DeviceModelMock.expects("aggregate").resolves([
        { _id: "device1" },
        { _id: "device2" },
      ]);

      await checkUnassignedDevices();

      expect(logTextSpy).to.not.have.been.calledWith(sinon.match.string);
      expect(logObjectSpy).to.not.have.been.calledWith(sinon.match.any);
    });
  });

  describe("when devices are not assigned to categories", () => {
    it("should log the percentage and unique device names", async () => {
      UNASSIGNED_THRESHOLD = 50;

      DeviceModelMock.expects("countDocuments").resolves(100);
      DeviceModelMock.expects("aggregate").resolves([
        { _id: "device1" },
        { _id: "device2" },
      ]);

      await checkUnassignedDevices();

      expect(logTextSpy).to.have.been.calledWith(sinon.match.string);
      expect(logTextSpy).to.have.been.calledWith(sinon.match.string);
      expect(logObjectSpy).to.have.been.calledWith(sinon.match.object);
      expect(logObjectSpy).to.have.been.calledWith(sinon.match.object);
    });

    it("should not log when percentage is below threshold", async () => {
      UNASSIGNED_THRESHOLD = 60;

      DeviceModelMock.expects("countDocuments").resolves(100);
      DeviceModelMock.expects("aggregate").resolves([
        { _id: "device1" },
        { _id: "device2" },
      ]);

      await checkUnassignedDevices();

      expect(logTextSpy).to.not.have.been.calledWith(sinon.match.string);
      expect(logObjectSpy).to.not.have.been.calledWith(sinon.match.object);
    });
  });

  describe("when an error occurs", () => {
    it("should log the error message", async () => {
      const error = new Error("Test error");

      DeviceModelMock.expects("countDocuments").rejects.error(error);

      await checkUnassignedDevices();

      expect(logTextSpy).to.have.been.calledWith(sinon.match.string);
      expect(logger.error).to.have.been.calledWith(sinon.match.string);
      expect(logger.error).to.have.been.calledWith(sinon.match.string);
    });
  });
});
