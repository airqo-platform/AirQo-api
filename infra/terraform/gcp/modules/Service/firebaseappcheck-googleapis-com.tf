resource "google_project_service" "firebaseappcheck_googleapis_com" {
  project = "${var.project-number}"
  service = "firebaseappcheck.googleapis.com"
}
# terraform import google_project_service.firebaseappcheck_googleapis_com ${var.project-number}/firebaseappcheck.googleapis.com
