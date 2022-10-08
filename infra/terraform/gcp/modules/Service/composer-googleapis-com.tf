resource "google_project_service" "composer_googleapis_com" {
  project = var.project-number
  service = "composer.googleapis.com"
}
# terraform import google_project_service.composer_googleapis_com ${var.project-number}/composer.googleapis.com
