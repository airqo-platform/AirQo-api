resource "google_project_service" "androidcheck_googleapis_com" {
  project = "702081712633"
  service = "androidcheck.googleapis.com"
}
# terraform import google_project_service.androidcheck_googleapis_com 702081712633/androidcheck.googleapis.com
