require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const sinonChai = require("sinon-chai");
const checkUnassignedSites = require("@bin/jobs/check-unassigned-sites-job");

// Mock the dependencies
const SitesModelMock = sinon.mock(SitesModel);
const logTextSpy = sinon.spy(console.log);
const logObjectSpy = sinon.spy(console.log);
const loggerErrorSpy = sinon.spy(logger.error);

beforeEach(() => {
  SitesModelMock = sinon.mock(SitesModel);
  logTextSpy = sinon.spy(console.log);
  logObjectSpy = sinon.spy(console.log);
  loggerErrorSpy = sinon.spy(logger.error);
});

afterEach(() => {
  sinon.restore();
});

describe("checkUnassignedSites", () => {
  describe("when there are unassigned sites", () => {
    beforeEach(() => {
      SitesModelMock.expects("countDocuments")
        .once()
        .resolves(100);
      SitesModelMock.expects("aggregate")
        .once()
        .resolves([
          {
            _id: "site1",
          },
          {
            _id: "site2",
          },
        ]);
    });

    it("should log unassigned sites", async () => {
      await checkUnassignedSites();

      expect(logTextSpy).to.have.been.calledWith(sinon.match.string);
      expect(logObjectSpy).to.have.been.calledTwice();
      expect(logger.info).to.have.been.calledWith(sinon.match.string);

      sinon.assert.notCalled(loggerErrorSpy);
    });
  });

  describe("when there are no unassigned sites", () => {
    beforeEach(() => {
      SitesModelMock.expects("countDocuments")
        .once()
        .resolves(100);
      SitesModelMock.expects("aggregate")
        .once()
        .resolves([]);
    });

    it("should not log anything", async () => {
      await checkUnassignedSites();

      expect(logTextSpy).to.have.callCount(0);
      expect(logObjectSpy).to.have.callCount(0);
      expect(logger.info).to.have.callCount(0);

      sinon.assert.notCalled(loggerErrorSpy);
    });
  });

  describe("when error occurs", () => {
    beforeEach(() => {
      const error = new Error("Test error");
      SitesModelMock.expects("countDocuments").throws(error);
    });

    it("should log the error message", async () => {
      await checkUnassignedSites();

      expect(logTextSpy).to.have.been.calledWith(sinon.match.string);
      expect(logger.error).to.have.been.calledTwice();
      expect(logger.error).to.have.been.calledWith(sinon.match.string);

      sinon.assert.notCalled(logObjectSpy);
      sinon.assert.notCalled(logger.info);
    });
  });
});
