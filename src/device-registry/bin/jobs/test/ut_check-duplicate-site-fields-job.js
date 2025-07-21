require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const {
  checkDuplicateSiteFields,
  FIELDS_TO_CHECK,
} = require("@bin/jobs/check-duplicate-site-fields-job");
const SitesModel = require("@models/Site");
const log4js = require("log4js");
const { logText, logObject } = require("@utils/log");

describe("Duplicate Site Fields Checker", () => {
  let sandbox;
  let loggerStub;
  let findStub;
  let logTextStub;
  let logObjectStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    loggerStub = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
    };
    sandbox.stub(log4js, "getLogger").returns(loggerStub);
    findStub = sandbox.stub();
    sandbox.stub(SitesModel, "airqo").returns({ find: findStub });
    logTextStub = sandbox.stub();
    logObjectStub = sandbox.stub();
    sandbox.stub(require("@utils/log"), "logText").callsFake(logTextStub);
    sandbox.stub(require("@utils/log"), "logObject").callsFake(logObjectStub);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("checkDuplicateSiteFields", () => {
    it("should detect and report duplicate field values", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: "Duplicate Name",
          search_name: "unique1",
          description: "Duplicate Desc",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: "Duplicate Name",
          search_name: "unique2",
          description: "Duplicate Desc",
        },
        {
          _id: "3",
          generated_name: "site3",
          name: "Unique Name",
          search_name: "unique3",
          description: "Unique Desc",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(loggerStub.warn.called).to.be.true;
      expect(logTextStub.calledWith("⚠️ Duplicate site field values detected!"))
        .to.be.true;
      expect(
        logTextStub.calledWith(
          'Value "Duplicate Name" shared by sites: site1, site2'
        )
      ).to.be.true;
      expect(
        logTextStub.calledWith(
          'Value "Duplicate Desc" shared by sites: site1, site2'
        )
      ).to.be.true;
    });

    it("should handle multiple sets of duplicates for the same field", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: "Duplicate Name 1",
          description: "Desc A",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: "Duplicate Name 1",
          description: "Desc B",
        },
        {
          _id: "3",
          generated_name: "site3",
          name: "Duplicate Name 2",
          description: "Desc A",
        },
        {
          _id: "4",
          generated_name: "site4",
          name: "Duplicate Name 2",
          description: "Desc B",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(
        logTextStub.calledWith(
          'Value "Duplicate Name 1" shared by sites: site1, site2'
        )
      ).to.be.true;
      expect(
        logTextStub.calledWith(
          'Value "Duplicate Name 2" shared by sites: site3, site4'
        )
      ).to.be.true;
    });

    it("should handle case sensitivity in duplicate detection", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: "Test Name",
          description: "Test Description",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: "test name",
          description: "TEST DESCRIPTION",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(logTextStub.calledWith("✅ No duplicate field values found")).to.be
        .true;
    });

    it("should handle empty string values", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: "",
          description: "",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: "",
          description: "",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(logTextStub.calledWith("⚠️ Duplicate site field values detected!"))
        .to.be.true;
      expect(logTextStub.calledWith('Value "" shared by sites: site1, site2'))
        .to.be.true;
    });

    it("should handle special characters in field values", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: "Test@#$%",
          description: "Test\nMultiline",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: "Test@#$%",
          description: "Test\nMultiline",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(
        logTextStub.calledWith('Value "Test@#$%" shared by sites: site1, site2')
      ).to.be.true;
      expect(
        logTextStub.calledWith(
          'Value "Test\\nMultiline" shared by sites: site1, site2'
        )
      ).to.be.true;
    });

    it("should handle very long field values", async () => {
      const longString = "a".repeat(1000);
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: longString,
          description: "Test",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: longString,
          description: "Test",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(loggerStub.warn.called).to.be.true;
    });

    it("should handle missing fields", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          // name field missing
          description: "Test",
        },
        {
          _id: "2",
          generated_name: "site2",
          // name field missing
          description: "Test",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(
        logTextStub.calledWith('Value "Test" shared by sites: site1, site2')
      ).to.be.true;
    });

    it("should handle missing fields", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          // name field missing
          description: "Test",
        },
        {
          _id: "2",
          generated_name: "site2",
          // name field missing
          description: "Test",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      // Should only detect duplicate in description field
      expect(
        logTextStub.calledWith('Value "Test" shared by sites: site1, site2')
      ).to.be.true;
    });
    it("should handle non-string field values", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: 123,
          description: true,
        },
        {
          _id: "2",
          generated_name: "site2",
          name: 123,
          description: true,
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(logTextStub.calledWith("⚠️ Duplicate site field values detected!"))
        .to.be.true;
    });
    it("should handle database timeout errors", async () => {
      const timeoutError = new Error("Database operation timeout");
      timeoutError.code = "ETIMEDOUT";
      findStub.rejects(timeoutError);

      await checkDuplicateSiteFields();

      expect(
        loggerStub.error.calledWith(
          "🐛 Error checking duplicate site fields: Database operation timeout"
        )
      ).to.be.true;
    });
  });

  describe("FIELDS_TO_CHECK configuration", () => {
    it("should contain the required fields", () => {
      expect(FIELDS_TO_CHECK).to.include("name");
      expect(FIELDS_TO_CHECK).to.include("search_name");
      expect(FIELDS_TO_CHECK).to.include("description");
    });

    it("should be an array", () => {
      expect(FIELDS_TO_CHECK).to.be.an("array");
    });

    it("should not contain duplicate fields", () => {
      const uniqueFields = new Set(FIELDS_TO_CHECK);
      expect(uniqueFields.size).to.equal(FIELDS_TO_CHECK.length);
    });

    it("should not contain empty strings", () => {
      expect(FIELDS_TO_CHECK.every((field) => field.length > 0)).to.be.true;
    });

    it("should not contain whitespace-only strings", () => {
      expect(FIELDS_TO_CHECK.every((field) => field.trim().length > 0)).to.be
        .true;
    });

    it("should contain only string values", () => {
      expect(FIELDS_TO_CHECK.every((field) => typeof field === "string")).to.be
        .true;
    });
  });

  describe("Edge Cases", () => {
    it("should handle sites with duplicate values across multiple fields", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: "Duplicate",
          search_name: "Duplicate",
          description: "Duplicate",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: "Duplicate",
          search_name: "Duplicate",
          description: "Duplicate",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      FIELDS_TO_CHECK.forEach((field) => {
        expect(
          logTextStub.calledWith(
            'Value "Duplicate" shared by sites: site1, site2'
          )
        ).to.be.true;
      });
    });

    it("should handle Unicode characters in field values", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: "Test 测试",
          description: "Description 描述",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: "Test 测试",
          description: "Description 描述",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(
        logTextStub.calledWith(
          'Value "Test 测试" shared by sites: site1, site2'
        )
      ).to.be.true;
    });

    it("should handle sites with all fields being null", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: null,
          search_name: null,
          description: null,
        },
        {
          _id: "2",
          generated_name: "site2",
          name: null,
          search_name: null,
          description: null,
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(logTextStub.calledWith("✅ No duplicate field values found")).to.be
        .true;
    });
    it("should handle sites with duplicate values across multiple fields", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: "Duplicate",
          search_name: "Duplicate",
          description: "Duplicate",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: "Duplicate",
          search_name: "Duplicate",
          description: "Duplicate",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      FIELDS_TO_CHECK.forEach((field) => {
        expect(
          logTextStub.calledWith(
            'Value "Duplicate" shared by sites: site1, site2'
          )
        ).to.be.true;
      });
    });

    it("should handle very long field values", async () => {
      const longString = "a".repeat(1000);
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: longString,
          description: "Test",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: longString,
          description: "Test",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(loggerStub.warn.called).to.be.true;
    });

    it("should handle empty string values", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: "",
          description: "",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: "",
          description: "",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(logTextStub.calledWith("⚠️ Duplicate site field values detected!"))
        .to.be.true;
      expect(logTextStub.calledWith('Value "" shared by sites: site1, site2'))
        .to.be.true;
    });

    it("should handle special characters in field values", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: "Test@#$%",
          description: "Test\nMultiline",
        },
        {
          _id: "2",
          generated_name: "site2",
          name: "Test@#$%",
          description: "Test\nMultiline",
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(
        logTextStub.calledWith('Value "Test@#$%" shared by sites: site1, site2')
      ).to.be.true;
      expect(
        logTextStub.calledWith(
          'Value "Test\\nMultiline" shared by sites: site1, site2'
        )
      ).to.be.true;
    });

    it("should handle non-string field values", async () => {
      const mockSites = [
        {
          _id: "1",
          generated_name: "site1",
          name: 123,
          description: true,
        },
        {
          _id: "2",
          generated_name: "site2",
          name: 123,
          description: true,
        },
      ];

      findStub.resolves(mockSites);

      await checkDuplicateSiteFields();

      expect(logTextStub.calledWith("⚠️ Duplicate site field values detected!"))
        .to.be.true;
    });

    it("should handle database timeout errors", async () => {
      const timeoutError = new Error("Database operation timeout");
      timeoutError.code = "ETIMEDOUT";
      findStub.rejects(timeoutError);

      await checkDuplicateSiteFields();

      expect(
        loggerStub.error.calledWith(
          "🐛 Error checking duplicate site fields: Database operation timeout"
        )
      ).to.be.true;
    });
  });
});
