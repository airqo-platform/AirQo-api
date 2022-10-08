resource "google_project_service" "containerregistry_googleapis_com" {
  project = var.project-number
  service = "containerregistry.googleapis.com"
}
# terraform import google_project_service.containerregistry_googleapis_com ${var.project-number}/containerregistry.googleapis.com
