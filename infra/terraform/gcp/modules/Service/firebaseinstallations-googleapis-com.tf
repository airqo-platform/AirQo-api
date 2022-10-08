resource "google_project_service" "firebaseinstallations_googleapis_com" {
  project = "${var.project-number}"
  service = "firebaseinstallations.googleapis.com"
}
# terraform import google_project_service.firebaseinstallations_googleapis_com ${var.project-number}/firebaseinstallations.googleapis.com
