resource "google_pubsub_topic" "pa_channel_data" {
  name    = "pa-channel-data"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.pa_channel_data projects/airqo-250220/topics/pa-channel-data
