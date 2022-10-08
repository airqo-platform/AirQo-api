resource "google_project_service" "serviceusage_googleapis_com" {
  project = "702081712633"
  service = "serviceusage.googleapis.com"
}
# terraform import google_project_service.serviceusage_googleapis_com 702081712633/serviceusage.googleapis.com
