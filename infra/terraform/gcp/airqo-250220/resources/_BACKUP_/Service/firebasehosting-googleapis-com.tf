resource "google_project_service" "firebasehosting_googleapis_com" {
  project = "702081712633"
  service = "firebasehosting.googleapis.com"
}
# terraform import google_project_service.firebasehosting_googleapis_com 702081712633/firebasehosting.googleapis.com
