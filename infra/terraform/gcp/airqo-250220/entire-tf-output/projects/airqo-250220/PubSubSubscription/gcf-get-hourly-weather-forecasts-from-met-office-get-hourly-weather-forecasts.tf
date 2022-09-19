resource "google_pubsub_subscription" "gcf_get_hourly_weather_forecasts_from_met_office_get_hourly_weather_forecasts" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-get_hourly_weather_forecasts_from_met_office-get_hourly_weather_forecasts"
  project                    = "airqo-250220"

  push_config {
    push_endpoint = "https://e2a7ac142353841aa82d89363fdbed72-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/get_hourly_weather_forecasts?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/get_hourly_weather_forecasts"
}
# terraform import google_pubsub_subscription.gcf_get_hourly_weather_forecasts_from_met_office_get_hourly_weather_forecasts projects/airqo-250220/subscriptions/gcf-get_hourly_weather_forecasts_from_met_office-get_hourly_weather_forecasts
