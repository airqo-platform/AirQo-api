resource "google_project_service" "monitoring_googleapis_com" {
  project = var.project-number
  service = "monitoring.googleapis.com"
}
# terraform import google_project_service.monitoring_googleapis_com ${var.project-number}/monitoring.googleapis.com
