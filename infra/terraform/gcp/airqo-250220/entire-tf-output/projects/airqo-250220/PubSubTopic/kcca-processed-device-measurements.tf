resource "google_pubsub_topic" "kcca_processed_device_measurements" {
  name    = "kcca-processed-device-measurements"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.kcca_processed_device_measurements projects/airqo-250220/topics/kcca-processed-device-measurements
