resource "google_pubsub_subscription" "gcf_update_raw_clarity_data_in_analytics_db_us_central1_update_raw_clarity_data_in_analytics_db" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-update_raw_clarity_data_in_analytics_db-us-central1-update_raw_clarity_data_in_analytics_db"
  project                    = var.project-id

  push_config {
    push_endpoint = "https://0165499e8f5449118622916e5a4ed59b-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/${var.project-id}/topics/update_raw_clarity_data_in_analytics_db?pubsub_trigger=true"
  }

  topic = "projects/${var.project-id}/topics/update_raw_clarity_data_in_analytics_db"
}
# terraform import google_pubsub_subscription.gcf_update_raw_clarity_data_in_analytics_db_us_central1_update_raw_clarity_data_in_analytics_db projects/${var.project-id}/subscriptions/gcf-update_raw_clarity_data_in_analytics_db-us-central1-update_raw_clarity_data_in_analytics_db
