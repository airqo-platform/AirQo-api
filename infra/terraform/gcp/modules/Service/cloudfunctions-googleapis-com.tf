resource "google_project_service" "cloudfunctions_googleapis_com" {
  project = "702081712633"
  service = "cloudfunctions.googleapis.com"
}
# terraform import google_project_service.cloudfunctions_googleapis_com 702081712633/cloudfunctions.googleapis.com
