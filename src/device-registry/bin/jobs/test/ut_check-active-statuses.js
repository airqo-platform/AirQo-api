require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const sinonChai = require("sinon-chai");

const checkActiveStatuses = require("@bin/jobs/check-active-statuses");

const DeviceModelMock = sinon.mock(DeviceModel);
const logTextSpy = sinon.spy(console.log);
const logObjectSpy = sinon.spy(console.log);
const loggerErrorSpy = sinon.spy(logger.error);

beforeEach(() => {
  DeviceModelMock = sinon.mock(DeviceModel);
  logTextSpy = sinon.spy(console.log);
  logObjectSpy = sinon.spy(console.log);
  loggerErrorSpy = sinon.spy(logger.error);
});

afterEach(() => {
  sinon.restore();
});

describe("checkActiveStatuses", () => {
  describe("when devices have incorrect statuses", () => {
    it("should log deployed devices with incorrect statuses", async () => {
      DeviceModelMock.expects("countDocuments")
        .twice()
        .resolves(5);

      const result = await checkActiveStatuses();

      expect(logTextSpy).to.have.been.calledWith(sinon.match.string);
      expect(logObjectSpy).to.have.been.calledWith(sinon.match.object);
      expect(logger.info).to.have.been.calledWith(sinon.match.string);
      expect(logTextSpy).to.have.been.calledWith(sinon.match.string);
      expect(logger.info).to.have.been.calledWith(sinon.match.string);

      sinon.assert.notCalled(loggerErrorSpy);
    });
  });

  describe("when devices have missing status fields", () => {
    it("should log deployed devices missing status", async () => {
      DeviceModelMock.expects("countDocuments")
        .twice()
        .resolves(3);

      const result = await checkActiveStatuses();

      expect(logTextSpy).to.have.been.calledWith(sinon.match.string);
      expect(logObjectSpy).to.have.been.calledWith(sinon.match.object);
      expect(logger.info).to.have.been.calledWith(sinon.match.string);
      expect(logTextSpy).to.have.been.calledWith(sinon.match.string);
      expect(logger.info).to.have.been.calledWith(sinon.match.string);

      sinon.assert.notCalled(loggerErrorSpy);
    });
  });

  describe("when both conditions are met", () => {
    it("should log both deployed devices with incorrect statuses and missing status fields", async () => {
      DeviceModelMock.expects("countDocuments")
        .thrice()
        .resolves([5, 3]);

      const result = await checkActiveStatuses();

      expect(logTextSpy).to.have.been.calledThrice();
      expect(logObjectSpy).to.have.been.calledTwice();
      expect(logger.info).to.have.been.calledTwice();
      expect(logger.info).to.have.been.calledWith(sinon.match.string);
      expect(logger.info).to.have.been.calledWith(sinon.match.string);

      sinon.assert.notCalled(loggerErrorSpy);
    });
  });

  describe("when error occurs", () => {
    it("should log the error message", async () => {
      const error = new Error("Test error");

      DeviceModelMock.expects("countDocuments").throws(error);

      await checkActiveStatuses();

      expect(logTextSpy).to.have.been.calledWith(sinon.match.string);
      expect(logger.error).to.have.been.calledWith(sinon.match.string);
      expect(logger.error).to.have.been.calledWith(sinon.match.string);
      expect(logger.error).to.have.been.calledWith(sinon.match.string);

      sinon.assert.notCalled(logObjectSpy);
      sinon.assert.notCalled(logger.info);
    });
  });
});
