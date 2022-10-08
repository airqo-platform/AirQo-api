resource "google_project_service" "geocoding_backend_googleapis_com" {
  project = var.project-number
  service = "geocoding-backend.googleapis.com"
}
# terraform import google_project_service.geocoding_backend_googleapis_com ${var.project-number}/geocoding-backend.googleapis.com
