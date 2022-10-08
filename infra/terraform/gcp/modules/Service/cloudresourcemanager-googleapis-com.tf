resource "google_project_service" "cloudresourcemanager_googleapis_com" {
  project = var.project-number
  service = "cloudresourcemanager.googleapis.com"
}
# terraform import google_project_service.cloudresourcemanager_googleapis_com ${var.project-number}/cloudresourcemanager.googleapis.com
