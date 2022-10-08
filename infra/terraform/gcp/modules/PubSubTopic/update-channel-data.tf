resource "google_pubsub_topic" "update_channel_data" {
  name    = "update-channel-data"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.update_channel_data projects/airqo-250220/topics/update-channel-data
