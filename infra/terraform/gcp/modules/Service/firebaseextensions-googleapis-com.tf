resource "google_project_service" "firebaseextensions_googleapis_com" {
  project = "${var.project-number}"
  service = "firebaseextensions.googleapis.com"
}
# terraform import google_project_service.firebaseextensions_googleapis_com ${var.project-number}/firebaseextensions.googleapis.com
