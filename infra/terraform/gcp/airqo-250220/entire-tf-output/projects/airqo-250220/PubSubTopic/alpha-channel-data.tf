resource "google_pubsub_topic" "alpha_channel_data" {
  name    = "alpha-channel-data"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.alpha_channel_data projects/airqo-250220/topics/alpha-channel-data
