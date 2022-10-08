resource "google_project_service" "directions_backend_googleapis_com" {
  project = "${var.project-number}"
  service = "directions-backend.googleapis.com"
}
# terraform import google_project_service.directions_backend_googleapis_com ${var.project-number}/directions-backend.googleapis.com
