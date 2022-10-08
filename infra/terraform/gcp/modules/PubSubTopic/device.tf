resource "google_pubsub_topic" "device" {
  name    = "device"
  project = var.project-id
}
# terraform import google_pubsub_topic.device projects/${var.project-id}/topics/device
