resource "google_project_service" "maps_ios_backend_googleapis_com" {
  project = "702081712633"
  service = "maps-ios-backend.googleapis.com"
}
# terraform import google_project_service.maps_ios_backend_googleapis_com 702081712633/maps-ios-backend.googleapis.com
