resource "google_pubsub_topic" "container_analysis_notes_v1" {
  name    = "container-analysis-notes-v1"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.container_analysis_notes_v1 projects/airqo-250220/topics/container-analysis-notes-v1
