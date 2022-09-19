resource "google_project_service" "logging_googleapis_com" {
  project = "4127550141"
  service = "logging.googleapis.com"
}
# terraform import google_project_service.logging_googleapis_com 4127550141/logging.googleapis.com
