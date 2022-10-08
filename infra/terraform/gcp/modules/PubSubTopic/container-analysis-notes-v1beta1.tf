resource "google_pubsub_topic" "container_analysis_notes_v1beta1" {
  name    = "container-analysis-notes-v1beta1"
  project = var.project-id
}
# terraform import google_pubsub_topic.container_analysis_notes_v1beta1 projects/${var.project-id}/topics/container-analysis-notes-v1beta1
