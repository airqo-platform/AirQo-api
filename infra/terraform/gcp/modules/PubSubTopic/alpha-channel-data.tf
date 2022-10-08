resource "google_pubsub_topic" "alpha_channel_data" {
  name    = "alpha-channel-data"
  project = var.project-id
}
# terraform import google_pubsub_topic.alpha_channel_data projects/${var.project-id}/topics/alpha-channel-data
