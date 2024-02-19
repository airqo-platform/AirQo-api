base_url = "/api/v2"
route = {
    "root": "/",
    "next_24hr_forecasts": f"{base_url}/predict/hourly-forecast",
    "all_24hr_forecasts": f"{base_url}/predict/hourly-forecasts",
    "next_1_week_forecasts": f"{base_url}/predict/daily-forecast",
    "all_1_week_forecasts": f"{base_url}/predict/daily-forecasts",
    "search_predictions": f"{base_url}/predict/search",
    "predict_for_heatmap": f"{base_url}/predict/heatmap",
    "parish_predictions": f"{base_url}/predict/parishes",
    "fetch_faulty_devices": f"{base_url}/predict/faulty-devices",
}
