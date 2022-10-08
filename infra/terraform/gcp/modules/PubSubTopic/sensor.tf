resource "google_pubsub_topic" "sensor" {
  name    = "sensor"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.sensor projects/airqo-250220/topics/sensor
