resource "google_pubsub_topic" "management" {
  name    = "management"
  project = var.project-id
}
# terraform import google_pubsub_topic.management projects/${var.project-id}/topics/management
