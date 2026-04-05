# Predict API

## Daily Forecasting

Route:
`GET /api/v2/predict/daily-forecasting`

Optional query parameter: 
`site_id`

Behavior:
- Uses `date.today()` as the start date.
- Returns a 7-day window from today.
- With `site_id`, returns forecasts for that site only.
- Without `site_id`, returns all forecast records in the same 7-day window.

Required env vars:
- `MONGO_URI`
- `MONGO_DATABASE_NAME`
- `MONGO_SITE_DAILY_FORECAST_COLLECTION`
