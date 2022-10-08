resource "google_project_service" "cloudbuild_googleapis_com" {
  project = var.project-number
  service = "cloudbuild.googleapis.com"
}
# terraform import google_project_service.cloudbuild_googleapis_com ${var.project-number}/cloudbuild.googleapis.com
