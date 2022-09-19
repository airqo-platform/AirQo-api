resource "google_project_service" "static_maps_backend_googleapis_com" {
  project = "702081712633"
  service = "static-maps-backend.googleapis.com"
}
# terraform import google_project_service.static_maps_backend_googleapis_com 702081712633/static-maps-backend.googleapis.com
