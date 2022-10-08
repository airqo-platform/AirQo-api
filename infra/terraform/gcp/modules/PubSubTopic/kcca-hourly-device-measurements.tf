resource "google_pubsub_topic" "kcca_hourly_device_measurements" {
  name    = "kcca-hourly-device-measurements"
  project = var.project-id
}
# terraform import google_pubsub_topic.kcca_hourly_device_measurements projects/${var.project-id}/topics/kcca-hourly-device-measurements
