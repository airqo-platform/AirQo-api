resource "google_pubsub_topic" "get_hourly_weather_forecasts" {
  name    = "get_hourly_weather_forecasts"
  project = var.project-id
}
# terraform import google_pubsub_topic.get_hourly_weather_forecasts projects/${var.project-id}/topics/get_hourly_weather_forecasts
