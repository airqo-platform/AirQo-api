resource "google_pubsub_subscription" "gcf_fetch_and_write_alphasense_alpha_channel_data" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-fetch_and_write-alphasense-alpha-channel-data"
  project                    = "airqo-250220"

  push_config {
    push_endpoint = "https://0ce96ece1722b04075a6326a5502c033-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/alpha-channel-data?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/alpha-channel-data"
}
# terraform import google_pubsub_subscription.gcf_fetch_and_write_alphasense_alpha_channel_data projects/airqo-250220/subscriptions/gcf-fetch_and_write-alphasense-alpha-channel-data
