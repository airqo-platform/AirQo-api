resource "google_project_service" "timezone_backend_googleapis_com" {
  project = "${var.project-number}"
  service = "timezone-backend.googleapis.com"
}
# terraform import google_project_service.timezone_backend_googleapis_com ${var.project-number}/timezone-backend.googleapis.com
