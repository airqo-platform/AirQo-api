resource "google_pubsub_topic" "kcca_raw_device_measurements" {
  name    = "kcca-raw-device-measurements"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.kcca_raw_device_measurements projects/airqo-250220/topics/kcca-raw-device-measurements
