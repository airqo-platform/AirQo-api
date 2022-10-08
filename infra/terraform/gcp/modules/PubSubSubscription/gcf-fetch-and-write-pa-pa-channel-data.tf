resource "google_pubsub_subscription" "gcf_fetch_and_write_pa_pa_channel_data" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-fetch_and_write_pa-pa-channel-data"
  project                    = "${var.project-id}"

  push_config {
    push_endpoint = "https://af57346ac07f43bcc419e1204605c1d6-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/pa-channel-data?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/pa-channel-data"
}
# terraform import google_pubsub_subscription.gcf_fetch_and_write_pa_pa_channel_data projects/airqo-250220/subscriptions/gcf-fetch_and_write_pa-pa-channel-data
