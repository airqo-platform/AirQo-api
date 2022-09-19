resource "google_pubsub_topic" "device" {
  name    = "device"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.device projects/airqo-250220/topics/device
