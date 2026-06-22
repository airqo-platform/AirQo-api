const https = require("https");
const constants = require("@config/constants");
const log4js = require("log4js");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- feedback-integrations-util`,
);

// Thin HTTPS POST helper — keeps this file self-contained with no extra deps.
const httpsPost = (url, body, extraHeaders = {}) =>
  new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error(`Invalid URL: ${url}`));
    }
    if (parsed.protocol !== "https:") {
      return reject(new Error(`Only HTTPS URLs are supported, got: ${parsed.protocol}`));
    }
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
        ...extraHeaders,
      },
    };
    const MAX_RESPONSE_BYTES = 1024 * 1024; // 1 MB
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => {
        data += c;
        if (Buffer.byteLength(data) > MAX_RESPONSE_BYTES) {
          req.destroy(new Error("Response body exceeded 1 MB limit"));
        }
      });
      res.on("end", () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.setTimeout(10000, () => req.destroy(new Error("Timed out")));
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });

// ── Slack ─────────────────────────────────────────────────────────────────────
// Requires: SLACK_FEEDBACK_WEBHOOK_URL
// Fires for every feedback submission (actionable or not).
// Format: Slack Block Kit — no bridge required; Incoming Webhooks accept this directly.
const notifySlack = async (feedback) => {
  const webhookUrl = constants.SLACK_FEEDBACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const category = (feedback.category || "general").replace(/_/g, " ");
  const isActionable = feedback.actionable !== false;
  const truncatedMessage = feedback.message && feedback.message.length > 300
    ? feedback.message.substring(0, 300) + "…"
    : feedback.message || "(no message)";
  const prefix = isActionable ? "🔴 Action Required" : "💬 New Feedback";
  const rawHeader = `${prefix} — ${category}`;
  // Slack header blocks have a 150-character hard limit.
  const headerText = rawHeader.length > 150 ? rawHeader.substring(0, 149) + "…" : rawHeader;

  const payload = {
    text: `New AirQo feedback: ${feedback.subject || "(no subject)"}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: headerText,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Subject:*\n${feedback.subject || "(none)"}` },
          { type: "mrkdwn", text: `*Category:*\n${category}` },
          { type: "mrkdwn", text: `*Platform:*\n${feedback.platform || "web"}` },
          { type: "mrkdwn", text: `*From:*\n${feedback.email || "anonymous"}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Message:*\n${truncatedMessage}` },
      },
    ],
  };

  const result = await httpsPost(webhookUrl, payload);
  if (result.statusCode !== 200) {
    logger.warn(`Slack integration: HTTP ${result.statusCode} — ${result.body}`);
  }
};

// ── JIRA ──────────────────────────────────────────────────────────────────────
// Requires: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY
// Optional: JIRA_ISSUE_TYPE (defaults to a category-based mapping)
// Only fires for actionable feedback (bugs, feature requests, performance issues).
// Uses JIRA Cloud REST API v3 with Atlassian Document Format (ADF) for description.
const createJiraIssue = async (feedback) => {
  const {
    JIRA_BASE_URL,
    JIRA_EMAIL,
    JIRA_API_TOKEN,
    JIRA_PROJECT_KEY,
    JIRA_ISSUE_TYPE,
  } = constants;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) return;
  if (!feedback.actionable) return;

  const issueTypeMap = {
    bug: "Bug",
    feature_request: "Story",
    performance: "Bug",
    ux_design: "Task",
    general: "Task",
    page_satisfaction: "Task",
    other: "Task",
  };
  const issueType = JIRA_ISSUE_TYPE || issueTypeMap[feedback.category] || "Task";
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const url = `${JIRA_BASE_URL.replace(/\/$/, "")}/rest/api/3/issue`;

  const body = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary: feedback.subject || "Feedback from AirQo",
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: feedback.message || "" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: `Submitted by: ${feedback.email || "anonymous"} | Platform: ${feedback.platform || "web"} | Category: ${feedback.category || "general"}`,
              },
            ],
          },
        ],
      },
      issuetype: { name: issueType },
      labels: ["airqo-feedback", feedback.category || "general"],
    },
  };

  const result = await httpsPost(url, body, {
    Authorization: `Basic ${auth}`,
  });
  if (result.statusCode < 200 || result.statusCode >= 300) {
    logger.warn(`JIRA integration: HTTP ${result.statusCode} — ${result.body}`);
  }
};

// ── Dispatcher ────────────────────────────────────────────────────────────────
// Calls all enabled integrations concurrently. Always resolves — a failure in
// one integration never affects the others or the feedback submission response.
const dispatchIntegrations = async (feedback) => {
  await Promise.allSettled([
    notifySlack(feedback).catch((err) =>
      logger.warn(`Slack integration error: ${err.message}`),
    ),
    createJiraIssue(feedback).catch((err) =>
      logger.warn(`JIRA integration error: ${err.message}`),
    ),
  ]);
};

module.exports = { dispatchIntegrations };
