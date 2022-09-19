resource "google_pubsub_topic" "update_channel_data" {
  name    = "update-channel-data"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.update_channel_data projects/airqo-250220/topics/update-channel-data
