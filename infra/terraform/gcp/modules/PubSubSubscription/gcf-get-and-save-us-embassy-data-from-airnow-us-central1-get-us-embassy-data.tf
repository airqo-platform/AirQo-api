resource "google_pubsub_subscription" "gcf_get_and_save_us_embassy_data_from_airnow_us_central1_get_us_embassy_data" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-get_and_save_us_embassy_data_from_airnow-us-central1-get_us_embassy_data"
  project                    = var.project-id

  push_config {
    push_endpoint = "https://e18bce69725cdbcb8798cfa4026de247-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/${var.project-id}/topics/get_us_embassy_data?pubsub_trigger=true"
  }

  topic = "projects/${var.project-id}/topics/get_us_embassy_data"
}
# terraform import google_pubsub_subscription.gcf_get_and_save_us_embassy_data_from_airnow_us_central1_get_us_embassy_data projects/${var.project-id}/subscriptions/gcf-get_and_save_us_embassy_data_from_airnow-us-central1-get_us_embassy_data
