resource "google_pubsub_topic" "slack" {
  name    = "slack"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.slack projects/airqo-250220/topics/slack
