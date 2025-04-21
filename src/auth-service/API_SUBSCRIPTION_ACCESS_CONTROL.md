# API Subscription Access Control

## Overview

AirQo's API subscription system provides tiered access to our air quality data and analytics services. Different subscription tiers offer varying levels of access to API endpoints, historical data, and premium features like forecasts and insights.

## Subscription Tiers

AirQo offers three subscription tiers:

| Plan              | Cost       | Features                                               |
| ----------------- | ---------- | ------------------------------------------------------ |
| **Free Tier**     | $0/month   | Limited access to recent measurements                  |
| **Standard Tier** | $50/month  | Access to recent and historical measurements           |
| **Premium Tier**  | $150/month | All Standard Tier features plus Forecasts and Insights |

## Access Permissions by Tier

### Free Tier

- **Recent Measurements**: Access to air quality data from the past 24 hours
- **Basic Metadata**: Access to basic information about devices, sites, cohorts, and grids

### Standard Tier

- All Free Tier features, plus:
- **Historical Measurements**: Access to historical air quality data beyond the last 24 hours
- **Extended Metadata**: Enhanced metadata for all resources

### Premium Tier

- All Standard Tier features, plus:
- **Forecasts**: Access to air quality forecasting data
- **Insights**: Access to advanced analytics and insights

## Rate Limits

Each subscription tier includes rate limits to ensure service stability:

| Tier         | Hourly Limit   | Daily Limit     | Monthly Limit    |
| ------------ | -------------- | --------------- | ---------------- |
| **Free**     | 100 requests   | 1,000 requests  | 10,000 requests  |
| **Standard** | 1,000 requests | 10,000 requests | 100,000 requests |
| **Premium**  | 5,000 requests | 50,000 requests | 500,000 requests |

Rate limit information is included in API responses via the following headers:

- `X-RateLimit-Limit-Hourly`: Maximum hourly requests
- `X-RateLimit-Remaining-Hourly`: Remaining hourly requests
- `X-RateLimit-Limit-Daily`: Maximum daily requests
- `X-RateLimit-Remaining-Daily`: Remaining daily requests

## Resource Access

Access to specific resources (devices, sites, cohorts, grids) is tied to your user account. You can only access data for resources that have been explicitly assigned to your account.

## Getting Started

### 1. Create an Account

To use the AirQo API, first create an account at https://analytics.airqo.net/account/login

### 2. Register a Client Application

After creating your account:

1. Log in to the AirQo Analytics platform
2. Navigate to Account Settings
3. Go to the API tab
4. Register a new CLIENT application
5. Submit a client activation request
6. Wait for manual activation (you'll receive an email confirmation)

### 3. Generate an Access Token

Once your client application is activated:

1. Return to the API tab in Account Settings
2. Use your activated client to generate an access token
3. Copy the token for use in your API requests

### 4. Use the Token in API Requests

Include your token as a query parameter in all API requests:

```
GET https://api.airqo.net/api/v2/measurements/recent?token=YOUR_TOKEN
```

## API Endpoints

The available endpoints depend on your subscription tier:

### Free Tier Endpoints

- `/api/v2/devices/measurements/recent` - Get recent measurements (last 24 hours)
- `/api/v2/devices` - List available devices
- `/api/v2/devices/sites` - List available sites
- `/api/v2/devices/cohorts` - List available cohorts
- `/api/v2/devices/grids` - List available grids

### Standard Tier Endpoints

All Free Tier endpoints, plus:

- `/api/v2/devices/measurements` - Access historical measurements with date filtering

### Premium Tier Endpoints

All Standard Tier endpoints, plus:

- `/api/v2/devices/forecasts` - Access air quality forecasts
- `/api/v2/devices/insights` - Access advanced analytics and insights

## Error Responses

When your request exceeds your subscription tier's permissions or rate limits, you'll receive one of the following responses:

### Subscription Tier Limitation

```json
{
  "success": false,
  "message": "Your Free subscription does not include access to historical measurements",
  "status": 403,
  "errors": {
    "reason": "subscription_tier",
    "message": "Your Free subscription does not include access to historical measurements"
  }
}
```

### Rate Limit Exceeded

```json
{
  "success": false,
  "message": "Rate limit exceeded. Please try again later.",
  "status": 429,
  "errors": {
    "message": "Hourly rate limit exceeded",
    "limit": 100,
    "current": 101,
    "reset": "Please try again in less than an hour"
  }
}
```

### Resource Access Denied

```json
{
  "success": false,
  "message": "You don't have access to this specific device",
  "status": 403,
  "errors": {
    "reason": "resource_access",
    "message": "You don't have access to this specific device"
  }
}
```

## FAQ

### How do I upgrade my subscription?

To upgrade your subscription, go to your account settings in the AirQo Analytics platform and select the "Subscriptions" tab. Follow the instructions to upgrade to a higher tier.

### What happens when I reach my rate limit?

When you reach your rate limit, requests will be temporarily blocked with a 429 (Too Many Requests) status code. The response will include information about when the limit will reset.

### Can I access historical data with the Free tier?

No, the Free tier only allows access to data from the past 24 hours. To access historical data, you need at least the Standard tier subscription.

### How can I check my current usage?

Your current usage and remaining requests can be seen in the rate limit headers of API responses. You can also view detailed usage statistics in your AirQo Analytics account.

### How do I get access to specific devices, sites, cohorts, or grids?

Access to specific resources is managed by the AirQo team. Contact support@airqo.net to request access to additional resources.

### What happens if my subscription expires?

If your subscription expires, your access will be downgraded to the Free tier. You'll maintain access to recent measurements but lose access to historical data, forecasts, and insights.

### Can I create multiple access tokens?

Yes, you can create multiple access tokens for different applications or use cases. Each token will inherit the permissions of your subscription tier.

### How secure is my access token?

Your access token should be treated like a password. Do not share it publicly and ensure it's only transmitted over secure connections (HTTPS).

## Support

For questions or support regarding API subscriptions, please contact:

- Email: support@airqo.net
- Support Portal: https://support.airqo.net
