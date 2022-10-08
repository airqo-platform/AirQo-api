resource "google_project_service" "deploymentmanager_googleapis_com" {
  project = var.project-number
  service = "deploymentmanager.googleapis.com"
}
# terraform import google_project_service.deploymentmanager_googleapis_com ${var.project-number}/deploymentmanager.googleapis.com
