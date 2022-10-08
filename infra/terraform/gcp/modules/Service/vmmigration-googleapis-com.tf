resource "google_project_service" "vmmigration_googleapis_com" {
  project = "702081712633"
  service = "vmmigration.googleapis.com"
}
# terraform import google_project_service.vmmigration_googleapis_com 702081712633/vmmigration.googleapis.com
