resource "google_project_service" "language_googleapis_com" {
  project = "${var.project-number}"
  service = "language.googleapis.com"
}
# terraform import google_project_service.language_googleapis_com ${var.project-number}/language.googleapis.com
