resource "google_project_service" "stackdriver_googleapis_com" {
  project = "702081712633"
  service = "stackdriver.googleapis.com"
}
# terraform import google_project_service.stackdriver_googleapis_com 702081712633/stackdriver.googleapis.com
