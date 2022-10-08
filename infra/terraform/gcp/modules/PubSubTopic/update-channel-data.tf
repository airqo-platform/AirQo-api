resource "google_pubsub_topic" "update_channel_data" {
  name    = "update-channel-data"
  project = var.project-id
}
# terraform import google_pubsub_topic.update_channel_data projects/${var.project-id}/topics/update-channel-data
