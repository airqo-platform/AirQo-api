resource "google_pubsub_topic" "device" {
  name    = "device"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.device projects/airqo-250220/topics/device
