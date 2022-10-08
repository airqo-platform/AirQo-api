resource "google_project_service" "maps_backend_googleapis_com" {
  project = "702081712633"
  service = "maps-backend.googleapis.com"
}
# terraform import google_project_service.maps_backend_googleapis_com 702081712633/maps-backend.googleapis.com
