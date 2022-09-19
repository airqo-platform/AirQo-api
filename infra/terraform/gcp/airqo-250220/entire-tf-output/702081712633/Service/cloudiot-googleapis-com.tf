resource "google_project_service" "cloudiot_googleapis_com" {
  project = "702081712633"
  service = "cloudiot.googleapis.com"
}
# terraform import google_project_service.cloudiot_googleapis_com 702081712633/cloudiot.googleapis.com
