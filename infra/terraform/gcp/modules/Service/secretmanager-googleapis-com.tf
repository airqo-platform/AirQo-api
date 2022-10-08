resource "google_project_service" "secretmanager_googleapis_com" {
  project = var.project-number
  service = "secretmanager.googleapis.com"
}
# terraform import google_project_service.secretmanager_googleapis_com ${var.project-number}/secretmanager.googleapis.com
