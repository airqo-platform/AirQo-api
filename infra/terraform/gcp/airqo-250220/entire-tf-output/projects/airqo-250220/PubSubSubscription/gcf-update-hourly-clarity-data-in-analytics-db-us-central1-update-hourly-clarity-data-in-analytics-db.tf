resource "google_pubsub_subscription" "gcf_update_hourly_clarity_data_in_analytics_db_us_central1_update_hourly_clarity_data_in_analytics_db" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-update_hourly_clarity_data_in_analytics_db-us-central1-update_hourly_clarity_data_in_analytics_db"
  project                    = "airqo-250220"

  push_config {
    push_endpoint = "https://03a7ac4644a0f5e1827b97668e5573ee-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/update_hourly_clarity_data_in_analytics_db?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/update_hourly_clarity_data_in_analytics_db"
}
# terraform import google_pubsub_subscription.gcf_update_hourly_clarity_data_in_analytics_db_us_central1_update_hourly_clarity_data_in_analytics_db projects/airqo-250220/subscriptions/gcf-update_hourly_clarity_data_in_analytics_db-us-central1-update_hourly_clarity_data_in_analytics_db
