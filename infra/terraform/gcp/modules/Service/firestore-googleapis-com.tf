resource "google_project_service" "firestore_googleapis_com" {
  project = var.project-number
  service = "firestore.googleapis.com"
}
# terraform import google_project_service.firestore_googleapis_com ${var.project-number}/firestore.googleapis.com
