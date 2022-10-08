resource "google_project_service" "elevation_backend_googleapis_com" {
  project = var.project-number
  service = "elevation-backend.googleapis.com"
}
# terraform import google_project_service.elevation_backend_googleapis_com ${var.project-number}/elevation-backend.googleapis.com
