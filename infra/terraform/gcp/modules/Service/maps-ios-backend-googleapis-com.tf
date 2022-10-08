resource "google_project_service" "maps_ios_backend_googleapis_com" {
  project = var.project-number
  service = "maps-ios-backend.googleapis.com"
}
# terraform import google_project_service.maps_ios_backend_googleapis_com ${var.project-number}/maps-ios-backend.googleapis.com
