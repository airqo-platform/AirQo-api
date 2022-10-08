resource "google_pubsub_subscription" "gcf_get_gcp_billing_alerts_us_central1_billing_notification" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-get_gcp_billing_alerts-us-central1-billing-notification"
  project                    = "${var.project-id}"

  push_config {
    push_endpoint = "https://09d96a7d5c84e98104de0151abc36cac-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/billing-notification?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/billing-notification"
}
# terraform import google_pubsub_subscription.gcf_get_gcp_billing_alerts_us_central1_billing_notification projects/airqo-250220/subscriptions/gcf-get_gcp_billing_alerts-us-central1-billing-notification
