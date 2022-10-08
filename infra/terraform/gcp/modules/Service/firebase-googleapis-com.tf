resource "google_project_service" "firebase_googleapis_com" {
  project = var.project-number
  service = "firebase.googleapis.com"
}
# terraform import google_project_service.firebase_googleapis_com ${var.project-number}/firebase.googleapis.com
