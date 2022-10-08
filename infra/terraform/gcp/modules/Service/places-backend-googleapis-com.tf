resource "google_project_service" "places_backend_googleapis_com" {
  project = "${var.project-number}"
  service = "places-backend.googleapis.com"
}
# terraform import google_project_service.places_backend_googleapis_com ${var.project-number}/places-backend.googleapis.com
