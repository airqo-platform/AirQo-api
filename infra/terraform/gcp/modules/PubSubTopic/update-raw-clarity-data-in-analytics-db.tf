resource "google_pubsub_topic" "update_raw_clarity_data_in_analytics_db" {
  name    = "update_raw_clarity_data_in_analytics_db"
  project = var.project-id
}
# terraform import google_pubsub_topic.update_raw_clarity_data_in_analytics_db projects/${var.project-id}/topics/update_raw_clarity_data_in_analytics_db
