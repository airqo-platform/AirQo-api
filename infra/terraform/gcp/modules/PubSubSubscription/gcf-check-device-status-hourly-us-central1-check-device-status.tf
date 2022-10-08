resource "google_pubsub_subscription" "gcf_check_device_status_hourly_us_central1_check_device_status" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-check_device_status_hourly-us-central1-check_device_status"
  project                    = var.project-id

  push_config {
    push_endpoint = "https://bbd58e8371be1b7bc932d217cee9550b-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/${var.project-id}/topics/check_device_status?pubsub_trigger=true"
  }

  topic = "projects/${var.project-id}/topics/check_device_status"
}
# terraform import google_pubsub_subscription.gcf_check_device_status_hourly_us_central1_check_device_status projects/${var.project-id}/subscriptions/gcf-check_device_status_hourly-us-central1-check_device_status
