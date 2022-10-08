resource "google_pubsub_topic" "telemetry" {
  name    = "telemetry"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.telemetry projects/airqo-250220/topics/telemetry
