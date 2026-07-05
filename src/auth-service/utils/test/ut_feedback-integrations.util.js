require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");

const rewireIntegrations = rewire("@utils/feedback-integrations.util");

describe("feedback-integrations util", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("dispatchIntegrations()", () => {
    it("should resolve without throwing even when both integrations fail", async () => {
      const origConstants = rewireIntegrations.__get__("constants");
      rewireIntegrations.__set__("constants", {
        ...origConstants,
        SLACK_FEEDBACK_WEBHOOK_URL: null,
        JIRA_BASE_URL: null,
        JIRA_EMAIL: null,
        JIRA_API_TOKEN: null,
        JIRA_PROJECT_KEY: null,
      });

      const { dispatchIntegrations } = rewireIntegrations;

      const feedback = {
        email: "user@example.com",
        subject: "Test",
        message: "Test message",
        category: "bug",
        platform: "web",
        actionable: true,
      };

      let threw = false;
      try {
        await dispatchIntegrations(feedback);
      } catch {
        threw = true;
      }

      expect(threw).to.equal(false);

      rewireIntegrations.__set__("constants", origConstants);
    });

    it("should resolve without throwing for non-actionable feedback", async () => {
      const origConstants = rewireIntegrations.__get__("constants");
      rewireIntegrations.__set__("constants", {
        ...origConstants,
        SLACK_FEEDBACK_WEBHOOK_URL: null,
        JIRA_BASE_URL: null,
      });

      const { dispatchIntegrations } = rewireIntegrations;

      const feedback = {
        email: "user@example.com",
        subject: "Nice!",
        message: "Great app",
        category: "general",
        platform: "web",
        actionable: false,
      };

      let threw = false;
      try {
        await dispatchIntegrations(feedback);
      } catch {
        threw = true;
      }

      expect(threw).to.equal(false);

      rewireIntegrations.__set__("constants", origConstants);
    });
  });

  describe("notifySlack (internal via httpsPost)", () => {
    it("should skip Slack dispatch when SLACK_FEEDBACK_WEBHOOK_URL is not set", async () => {
      const origConstants = rewireIntegrations.__get__("constants");
      rewireIntegrations.__set__("constants", {
        ...origConstants,
        SLACK_FEEDBACK_WEBHOOK_URL: null,
      });

      const notifySlack = rewireIntegrations.__get__("notifySlack");

      let threw = false;
      try {
        await notifySlack({ subject: "s", message: "m", category: "bug", platform: "web", email: "a@b.com", actionable: true });
      } catch {
        threw = true;
      }

      expect(threw).to.equal(false);

      rewireIntegrations.__set__("constants", origConstants);
    });
  });

  describe("createJiraIssue (internal)", () => {
    it("should skip JIRA when required config is missing", async () => {
      const origConstants = rewireIntegrations.__get__("constants");
      rewireIntegrations.__set__("constants", {
        ...origConstants,
        JIRA_BASE_URL: null,
        JIRA_EMAIL: null,
        JIRA_API_TOKEN: null,
        JIRA_PROJECT_KEY: null,
      });

      const createJiraIssue = rewireIntegrations.__get__("createJiraIssue");

      let threw = false;
      try {
        await createJiraIssue({ subject: "s", message: "m", category: "bug", actionable: true });
      } catch {
        threw = true;
      }

      expect(threw).to.equal(false);

      rewireIntegrations.__set__("constants", origConstants);
    });

    it("should skip JIRA when feedback is not actionable", async () => {
      const origConstants = rewireIntegrations.__get__("constants");
      rewireIntegrations.__set__("constants", {
        ...origConstants,
        JIRA_BASE_URL: "https://jira.example.com",
        JIRA_EMAIL: "user@example.com",
        JIRA_API_TOKEN: "token",
        JIRA_PROJECT_KEY: "PROJ",
      });

      const createJiraIssue = rewireIntegrations.__get__("createJiraIssue");

      let threw = false;
      try {
        await createJiraIssue({ subject: "s", message: "m", category: "general", actionable: false });
      } catch {
        threw = true;
      }

      expect(threw).to.equal(false);

      rewireIntegrations.__set__("constants", origConstants);
    });
  });

  describe("httpsPost (internal)", () => {
    it("should reject on an invalid URL", async () => {
      const httpsPost = rewireIntegrations.__get__("httpsPost");

      let error;
      try {
        await httpsPost("not-a-url", { data: "test" });
      } catch (err) {
        error = err;
      }

      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.include("Invalid URL");
    });

    it("should reject on a non-HTTPS URL", async () => {
      const httpsPost = rewireIntegrations.__get__("httpsPost");

      let error;
      try {
        await httpsPost("http://example.com/hook", { data: "test" });
      } catch (err) {
        error = err;
      }

      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.include("Only HTTPS URLs");
    });
  });
});
