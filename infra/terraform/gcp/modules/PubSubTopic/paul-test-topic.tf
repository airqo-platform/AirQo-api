resource "google_pubsub_topic" "paul_test_topic" {
  name    = "paul_test_topic"
  project = var.project-id
}
# terraform import google_pubsub_topic.paul_test_topic projects/${var.project-id}/topics/paul_test_topic
