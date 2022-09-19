resource "google_pubsub_topic" "cron_channel_data" {
  name    = "cron-channel-data"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.cron_channel_data projects/airqo-250220/topics/cron-channel-data
