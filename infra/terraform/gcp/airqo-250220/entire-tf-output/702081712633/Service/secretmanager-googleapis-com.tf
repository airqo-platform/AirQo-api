resource "google_project_service" "secretmanager_googleapis_com" {
  project = "702081712633"
  service = "secretmanager.googleapis.com"
}
# terraform import google_project_service.secretmanager_googleapis_com 702081712633/secretmanager.googleapis.com
