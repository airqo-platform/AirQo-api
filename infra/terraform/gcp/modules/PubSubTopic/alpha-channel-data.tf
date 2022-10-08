resource "google_pubsub_topic" "alpha_channel_data" {
  name    = "alpha-channel-data"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.alpha_channel_data projects/airqo-250220/topics/alpha-channel-data
