resource "google_pubsub_topic" "container_analysis_occurrences_v1" {
  name    = "container-analysis-occurrences-v1"
  project = "${var.project-id}"
}
# terraform import google_pubsub_topic.container_analysis_occurrences_v1 projects/airqo-250220/topics/container-analysis-occurrences-v1
