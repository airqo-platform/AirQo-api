resource "google_pubsub_topic" "telemetry" {
  name    = "telemetry"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.telemetry projects/airqo-250220/topics/telemetry
