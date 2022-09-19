resource "google_project_service" "timezone_backend_googleapis_com" {
  project = "702081712633"
  service = "timezone-backend.googleapis.com"
}
# terraform import google_project_service.timezone_backend_googleapis_com 702081712633/timezone-backend.googleapis.com
