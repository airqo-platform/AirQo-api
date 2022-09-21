resource "google_project_service" "cloudapis_googleapis_com" {
  project = "702081712633"
  service = "cloudapis.googleapis.com"
}
# terraform import google_project_service.cloudapis_googleapis_com 702081712633/cloudapis.googleapis.com
