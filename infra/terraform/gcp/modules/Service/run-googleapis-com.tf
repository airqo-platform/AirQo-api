resource "google_project_service" "run_googleapis_com" {
  project = var.project-number
  service = "run.googleapis.com"
}
# terraform import google_project_service.run_googleapis_com ${var.project-number}/run.googleapis.com
