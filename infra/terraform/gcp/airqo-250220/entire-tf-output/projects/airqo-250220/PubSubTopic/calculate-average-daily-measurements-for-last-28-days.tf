resource "google_pubsub_topic" "calculate_average_daily_measurements_for_last_28_days" {
  name    = "calculate_average_daily_measurements_for_last_28_days"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.calculate_average_daily_measurements_for_last_28_days projects/airqo-250220/topics/calculate_average_daily_measurements_for_last_28_days
