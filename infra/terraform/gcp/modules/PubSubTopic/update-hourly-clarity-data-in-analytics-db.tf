resource "google_pubsub_topic" "update_hourly_clarity_data_in_analytics_db" {
  name    = "update_hourly_clarity_data_in_analytics_db"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.update_hourly_clarity_data_in_analytics_db projects/airqo-250220/topics/update_hourly_clarity_data_in_analytics_db
