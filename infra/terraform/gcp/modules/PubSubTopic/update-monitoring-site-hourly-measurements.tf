resource "google_pubsub_topic" "update_monitoring_site_hourly_measurements" {
  name    = "update_monitoring_site_hourly_measurements"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.update_monitoring_site_hourly_measurements projects/airqo-250220/topics/update_monitoring_site_hourly_measurements
