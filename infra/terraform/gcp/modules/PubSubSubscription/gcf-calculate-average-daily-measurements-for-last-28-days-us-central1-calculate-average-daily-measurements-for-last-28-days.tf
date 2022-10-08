resource "google_pubsub_subscription" "gcf_calculate_average_daily_measurements_for_last_28_days_us_central1_calculate_average_daily_measurements_for_last_28_days" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-calculate_average_daily_measurements_for_last_28_days-us-central1-calculate_average_daily_measurements_for_last_28_days"
  project                    = var.project-id

  push_config {
    push_endpoint = "https://69d3120494dd6f631bde9ba220b4117d-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/${var.project-id}/topics/calculate_average_daily_measurements_for_last_28_days?pubsub_trigger=true"
  }

  topic = "projects/${var.project-id}/topics/calculate_average_daily_measurements_for_last_28_days"
}
# terraform import google_pubsub_subscription.gcf_calculate_average_daily_measurements_for_last_28_days_us_central1_calculate_average_daily_measurements_for_last_28_days projects/${var.project-id}/subscriptions/gcf-calculate_average_daily_measurements_for_last_28_days-us-central1-calculate_average_daily_measurements_for_last_28_days
