resource "google_pubsub_topic" "update_processed_data" {
  name    = "update_processed_data"
  project = var.project-id
}
# terraform import google_pubsub_topic.update_processed_data projects/${var.project-id}/topics/update_processed_data
