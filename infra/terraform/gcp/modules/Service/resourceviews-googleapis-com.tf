resource "google_project_service" "resourceviews_googleapis_com" {
  project = var.project-number
  service = "resourceviews.googleapis.com"
}
# terraform import google_project_service.resourceviews_googleapis_com ${var.project-number}/resourceviews.googleapis.com
