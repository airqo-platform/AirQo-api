resource "google_pubsub_topic" "slack" {
  name    = "slack"
  project = var.project-id
}
# terraform import google_pubsub_topic.slack projects/${var.project-id}/topics/slack
