resource "google_project_service" "firebase_googleapis_com" {
  project = "702081712633"
  service = "firebase.googleapis.com"
}
# terraform import google_project_service.firebase_googleapis_com 702081712633/firebase.googleapis.com
