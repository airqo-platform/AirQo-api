resource "google_project_service" "realtime_googleapis_com" {
  project = var.project-number
  service = "realtime.googleapis.com"
}
# terraform import google_project_service.realtime_googleapis_com ${var.project-number}/realtime.googleapis.com
