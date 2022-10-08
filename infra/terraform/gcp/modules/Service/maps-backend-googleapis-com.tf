resource "google_project_service" "maps_backend_googleapis_com" {
  project = var.project-number
  service = "maps-backend.googleapis.com"
}
# terraform import google_project_service.maps_backend_googleapis_com ${var.project-number}/maps-backend.googleapis.com
