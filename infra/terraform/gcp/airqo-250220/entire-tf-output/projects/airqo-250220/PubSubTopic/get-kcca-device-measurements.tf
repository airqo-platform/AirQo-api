resource "google_pubsub_topic" "get_kcca_device_measurements" {
  name    = "get-kcca-device-measurements"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.get_kcca_device_measurements projects/airqo-250220/topics/get-kcca-device-measurements
