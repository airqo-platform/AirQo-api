resource "google_pubsub_subscription" "gcf_update_all_monitoring_sites_latest_hourly_measurements_us_central1_update_monitoring_site_hourly_measurements" {
  ack_deadline_seconds       = 600
  message_retention_duration = "604800s"
  name                       = "gcf-update_all_monitoring_sites_latest_hourly_measurements-us-central1-update_monitoring_site_hourly_measurements"
  project                    = "${var.project-id}"

  push_config {
    push_endpoint = "https://731144f1b32614c24d434d7d2dac1687-dot-o46fbf1c487424862-tp.appspot.com/_ah/push-handlers/pubsub/projects/airqo-250220/topics/update_monitoring_site_hourly_measurements?pubsub_trigger=true"
  }

  topic = "projects/airqo-250220/topics/update_monitoring_site_hourly_measurements"
}
# terraform import google_pubsub_subscription.gcf_update_all_monitoring_sites_latest_hourly_measurements_us_central1_update_monitoring_site_hourly_measurements projects/airqo-250220/subscriptions/gcf-update_all_monitoring_sites_latest_hourly_measurements-us-central1-update_monitoring_site_hourly_measurements
