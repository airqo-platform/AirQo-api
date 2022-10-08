resource "google_pubsub_subscription" "gcf_update_channel_data_update_channel_data" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-update_channel_data-update-channel-data"
  project                    = var.project-id

  push_config {
    push_endpoint = "https://cde5261b52d219fd1234ec1dd3d22b28-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/${var.project-id}/topics/update-channel-data?pubsub_trigger=true"
  }

  topic = "projects/${var.project-id}/topics/update-channel-data"
}
# terraform import google_pubsub_subscription.gcf_update_channel_data_update_channel_data projects/${var.project-id}/subscriptions/gcf-update_channel_data-update-channel-data
