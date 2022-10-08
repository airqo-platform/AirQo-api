resource "google_pubsub_subscription" "gcf_update_preprocessed_hourly_data_update_processed_data" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-update_preprocessed_hourly_data-update_processed_data"
  project                    = var.project-id

  push_config {
    push_endpoint = "https://34ca704fc39e938eaa11e44cfface4ea-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/${var.project-id}/topics/update_processed_data?pubsub_trigger=true"
  }

  topic = "projects/${var.project-id}/topics/update_processed_data"
}
# terraform import google_pubsub_subscription.gcf_update_preprocessed_hourly_data_update_processed_data projects/${var.project-id}/subscriptions/gcf-update_preprocessed_hourly_data-update_processed_data
