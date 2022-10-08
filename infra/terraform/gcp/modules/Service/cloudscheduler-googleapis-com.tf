resource "google_project_service" "cloudscheduler_googleapis_com" {
  project = var.project-number
  service = "cloudscheduler.googleapis.com"
}
# terraform import google_project_service.cloudscheduler_googleapis_com ${var.project-number}/cloudscheduler.googleapis.com
