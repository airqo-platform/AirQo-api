resource "google_pubsub_topic" "state" {
  name    = "state"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.state projects/airqo-250220/topics/state
