resource "google_project_service" "directions_backend_googleapis_com" {
  project = "702081712633"
  service = "directions-backend.googleapis.com"
}
# terraform import google_project_service.directions_backend_googleapis_com 702081712633/directions-backend.googleapis.com
