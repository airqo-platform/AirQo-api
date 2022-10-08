resource "google_project_service" "logging_googleapis_com" {
  project = "${var.project-number}"
  service = "logging.googleapis.com"
}
# terraform import google_project_service.logging_googleapis_com ${var.project-number}/logging.googleapis.com
