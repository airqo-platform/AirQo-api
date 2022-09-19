resource "google_project_service" "testing_googleapis_com" {
  project = "702081712633"
  service = "testing.googleapis.com"
}
# terraform import google_project_service.testing_googleapis_com 702081712633/testing.googleapis.com
