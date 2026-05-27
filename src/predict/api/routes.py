base_url = "/api/v2"
route = {
    "root": "/",
    "next_24hr_forecasts": f"{base_url}/predict/hourly-forecast",
    "all_24hr_forecasts": f"{base_url}/predict/hourly-forecasts",
    "next_1_week_forecasts": f"{base_url}/predict/daily-forecast",
    "all_1_week_forecasts": f"{base_url}/predict/daily-forecasts",
    "site_daily_forecasts": f"{base_url}/predict/daily-forecasting",
    "site_hourly_forecasts": f"{base_url}/predict/hourly-forecasting",
    "grid_daily_forecasts": f"{base_url}/predict/daily-forecasting/grids/<grid_id>",
    "grid_hourly_forecasts": f"{base_url}/predict/hourly-forecasting/grids/<grid_id>",
    "cohort_daily_forecasts": f"{base_url}/predict/daily-forecasting/cohorts/<cohort_id>",
    "cohort_hourly_forecasts": f"{base_url}/predict/hourly-forecasting/cohorts/<cohort_id>",
    "search_predictions": f"{base_url}/predict/search",
    "predict_for_heatmap": f"{base_url}/predict/heatmap",
    "parish_predictions": f"{base_url}/predict/parishes",
    "fetch_faulty_devices": f"{base_url}/predict/faulty-devices",
}
