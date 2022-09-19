resource "google_pubsub_subscription" "gcf_fetch_and_write_cron_channel_data" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-fetch_and_write-cron-channel-data"
  project                    = "airqo-250220"

  push_config {
    push_endpoint = "https://6efed04cdfc6838a5f622e7cc785f4ee-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/cron-channel-data?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/cron-channel-data"
}
# terraform import google_pubsub_subscription.gcf_fetch_and_write_cron_channel_data projects/airqo-250220/subscriptions/gcf-fetch_and_write-cron-channel-data
