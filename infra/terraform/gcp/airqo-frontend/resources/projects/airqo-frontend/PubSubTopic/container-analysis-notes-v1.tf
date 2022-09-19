resource "google_pubsub_topic" "container_analysis_notes_v1" {
  name    = "container-analysis-notes-v1"
  project = "airqo-frontend"
}
# terraform import google_pubsub_topic.container_analysis_notes_v1 projects/airqo-frontend/topics/container-analysis-notes-v1
