resource "google_project_service" "earthengine_googleapis_com" {
  project = "${var.project-number}"
  service = "earthengine.googleapis.com"
}
# terraform import google_project_service.earthengine_googleapis_com ${var.project-number}/earthengine.googleapis.com
