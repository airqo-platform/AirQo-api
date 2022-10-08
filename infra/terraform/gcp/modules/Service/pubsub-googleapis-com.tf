resource "google_project_service" "pubsub_googleapis_com" {
  project = "${var.project-number}"
  service = "pubsub.googleapis.com"
}
# terraform import google_project_service.pubsub_googleapis_com ${var.project-number}/pubsub.googleapis.com
