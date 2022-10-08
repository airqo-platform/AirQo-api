resource "google_pubsub_topic" "billing_notification" {
  name    = "billing-notification"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.billing_notification projects/airqo-250220/topics/billing-notification
