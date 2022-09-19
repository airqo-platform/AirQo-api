resource "google_pubsub_topic" "update_processed_data" {
  name    = "update_processed_data"
  project = "airqo-250220"
}
# terraform import google_pubsub_topic.update_processed_data projects/airqo-250220/topics/update_processed_data
