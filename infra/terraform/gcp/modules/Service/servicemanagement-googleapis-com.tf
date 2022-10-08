resource "google_project_service" "servicemanagement_googleapis_com" {
  project = "702081712633"
  service = "servicemanagement.googleapis.com"
}
# terraform import google_project_service.servicemanagement_googleapis_com 702081712633/servicemanagement.googleapis.com
