resource "google_pubsub_topic" "kcca_daily_device_measurements" {
  name    = "kcca-daily-device-measurements"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.kcca_daily_device_measurements projects/airqo-250220/topics/kcca-daily-device-measurements
