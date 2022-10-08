resource "google_project_service" "androidcheck_googleapis_com" {
  project = var.project-number
  service = "androidcheck.googleapis.com"
}
# terraform import google_project_service.androidcheck_googleapis_com ${var.project-number}/androidcheck.googleapis.com
