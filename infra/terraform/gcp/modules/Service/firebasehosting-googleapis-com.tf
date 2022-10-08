resource "google_project_service" "firebasehosting_googleapis_com" {
  project = "${var.project-number}"
  service = "firebasehosting.googleapis.com"
}
# terraform import google_project_service.firebasehosting_googleapis_com ${var.project-number}/firebasehosting.googleapis.com
