resource "google_pubsub_topic" "get_hourly_weather_forecasts" {
  name    = "get_hourly_weather_forecasts"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.get_hourly_weather_forecasts projects/airqo-250220/topics/get_hourly_weather_forecasts
