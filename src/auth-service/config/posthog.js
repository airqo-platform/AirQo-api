const posthogConfig = {
  apiKey: process.env.POSTHOG_API_KEY,
  host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
};

if (!posthogConfig.apiKey) {
  console.warn(
    "⚠️ PostHog API Key is not set in environment variables. Analytics will be disabled."
  );
}

module.exports = posthogConfig;
