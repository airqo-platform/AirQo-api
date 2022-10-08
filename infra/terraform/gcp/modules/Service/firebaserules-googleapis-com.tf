resource "google_project_service" "firebaserules_googleapis_com" {
  project = var.project-number
  service = "firebaserules.googleapis.com"
}
# terraform import google_project_service.firebaserules_googleapis_com ${var.project-number}/firebaserules.googleapis.com
