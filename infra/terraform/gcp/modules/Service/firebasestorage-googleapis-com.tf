resource "google_project_service" "firebasestorage_googleapis_com" {
  project = "${var.project-number}"
  service = "firebasestorage.googleapis.com"
}
# terraform import google_project_service.firebasestorage_googleapis_com ${var.project-number}/firebasestorage.googleapis.com
