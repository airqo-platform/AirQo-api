resource "google_project_service" "maps_backend_googleapis_com" {
  project = "4127550141"
  service = "maps-backend.googleapis.com"
}
# terraform import google_project_service.maps_backend_googleapis_com 4127550141/maps-backend.googleapis.com
