resource "google_pubsub_topic" "check_device_status" {
  name    = "check_device_status"
  project = var.project-id
}
# terraform import google_pubsub_topic.check_device_status projects/${var.project-id}/topics/check_device_status
