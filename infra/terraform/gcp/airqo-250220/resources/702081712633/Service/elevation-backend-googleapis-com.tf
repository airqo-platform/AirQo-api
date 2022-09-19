resource "google_project_service" "elevation_backend_googleapis_com" {
  project = "702081712633"
  service = "elevation-backend.googleapis.com"
}
# terraform import google_project_service.elevation_backend_googleapis_com 702081712633/elevation-backend.googleapis.com
