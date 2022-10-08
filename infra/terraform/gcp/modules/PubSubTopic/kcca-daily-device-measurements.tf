resource "google_pubsub_topic" "kcca_daily_device_measurements" {
  name    = "kcca-daily-device-measurements"
  project = var.project-id
}
# terraform import google_pubsub_topic.kcca_daily_device_measurements projects/${var.project-id}/topics/kcca-daily-device-measurements
