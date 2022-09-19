resource "google_project_service" "firestore_googleapis_com" {
  project = "702081712633"
  service = "firestore.googleapis.com"
}
# terraform import google_project_service.firestore_googleapis_com 702081712633/firestore.googleapis.com
