resource "google_pubsub_topic" "kcca_hourly_device_measurements" {
  name    = "kcca-hourly-device-measurements"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.kcca_hourly_device_measurements projects/airqo-250220/topics/kcca-hourly-device-measurements
