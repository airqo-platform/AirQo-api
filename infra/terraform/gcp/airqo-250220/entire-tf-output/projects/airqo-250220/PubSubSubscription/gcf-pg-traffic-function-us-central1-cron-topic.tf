resource "google_pubsub_subscription" "gcf_pg_traffic_function_us_central1_cron_topic" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-pg-traffic-function-us-central1-cron-topic"
  project                    = "airqo-250220"

  push_config {
    push_endpoint = "https://b1a05c63d5fde60502bc72cb0127c437-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/cron-topic?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/cron-topic"
}
# terraform import google_pubsub_subscription.gcf_pg_traffic_function_us_central1_cron_topic projects/airqo-250220/subscriptions/gcf-pg-traffic-function-us-central1-cron-topic
