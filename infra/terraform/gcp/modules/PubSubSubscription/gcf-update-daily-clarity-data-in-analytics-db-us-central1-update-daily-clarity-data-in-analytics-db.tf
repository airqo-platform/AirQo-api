resource "google_pubsub_subscription" "gcf_update_daily_clarity_data_in_analytics_db_us_central1_update_daily_clarity_data_in_analytics_db" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-update_daily_clarity_data_in_analytics_db-us-central1-update_daily_clarity_data_in_analytics_db"
  project                    = var.project-id

  push_config {
    push_endpoint = "https://85d603a3900bee5e81a41d124fad437f-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/${var.project-id}/topics/update_daily_clarity_data_in_analytics_db?pubsub_trigger=true"
  }

  topic = "projects/${var.project-id}/topics/update_daily_clarity_data_in_analytics_db"
}
# terraform import google_pubsub_subscription.gcf_update_daily_clarity_data_in_analytics_db_us_central1_update_daily_clarity_data_in_analytics_db projects/${var.project-id}/subscriptions/gcf-update_daily_clarity_data_in_analytics_db-us-central1-update_daily_clarity_data_in_analytics_db
