resource "google_pubsub_topic" "kcca_processed_device_measurements" {
  name    = "kcca-processed-device-measurements"
  project = var.project-id
}
# terraform import google_pubsub_topic.kcca_processed_device_measurements projects/${var.project-id}/topics/kcca-processed-device-measurements
