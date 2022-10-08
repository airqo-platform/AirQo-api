resource "google_pubsub_topic" "get_kcca_device_measurements" {
  name    = "get-kcca-device-measurements"
  project = var.project-id
}
# terraform import google_pubsub_topic.get_kcca_device_measurements projects/${var.project-id}/topics/get-kcca-device-measurements
