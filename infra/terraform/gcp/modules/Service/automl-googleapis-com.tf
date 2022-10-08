resource "google_project_service" "automl_googleapis_com" {
  project = var.project-number
  service = "automl.googleapis.com"
}
# terraform import google_project_service.automl_googleapis_com ${var.project-number}/automl.googleapis.com
