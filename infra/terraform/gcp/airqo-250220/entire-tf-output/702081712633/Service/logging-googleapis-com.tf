resource "google_project_service" "logging_googleapis_com" {
  project = "702081712633"
  service = "logging.googleapis.com"
}
# terraform import google_project_service.logging_googleapis_com 702081712633/logging.googleapis.com
