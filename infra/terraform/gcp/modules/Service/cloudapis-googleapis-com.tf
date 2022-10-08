resource "google_project_service" "cloudapis_googleapis_com" {
  project = var.project-number
  service = "cloudapis.googleapis.com"
}
# terraform import google_project_service.cloudapis_googleapis_com ${var.project-number}/cloudapis.googleapis.com
