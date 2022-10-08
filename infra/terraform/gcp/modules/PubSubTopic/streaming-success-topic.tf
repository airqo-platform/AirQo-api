resource "google_pubsub_topic" "streaming_success_topic" {
  name    = "streaming_success_topic"
  project = var.project-id
}
# terraform import google_pubsub_topic.streaming_success_topic projects/${var.project-id}/topics/streaming_success_topic
