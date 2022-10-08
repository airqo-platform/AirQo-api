resource "google_project_service" "static_maps_backend_googleapis_com" {
  project = "${var.project-number}"
  service = "static-maps-backend.googleapis.com"
}
# terraform import google_project_service.static_maps_backend_googleapis_com ${var.project-number}/static-maps-backend.googleapis.com
