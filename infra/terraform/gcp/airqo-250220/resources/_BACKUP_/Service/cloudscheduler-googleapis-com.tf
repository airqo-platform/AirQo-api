resource "google_project_service" "cloudscheduler_googleapis_com" {
  project = "702081712633"
  service = "cloudscheduler.googleapis.com"
}
# terraform import google_project_service.cloudscheduler_googleapis_com 702081712633/cloudscheduler.googleapis.com
