resource "google_pubsub_topic" "state" {
  name    = "state"
  project = var.project-id
}
# terraform import google_pubsub_topic.state projects/${var.project-id}/topics/state
