resource "google_project_service" "firebaserules_googleapis_com" {
  project = "702081712633"
  service = "firebaserules.googleapis.com"
}
# terraform import google_project_service.firebaserules_googleapis_com 702081712633/firebaserules.googleapis.com
