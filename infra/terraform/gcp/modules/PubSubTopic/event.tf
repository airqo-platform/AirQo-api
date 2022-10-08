resource "google_pubsub_topic" "event" {
  name    = "event"
  project = var.project-id
}
# terraform import google_pubsub_topic.event projects/${var.project-id}/topics/event
