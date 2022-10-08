resource "google_project_service" "appengine_googleapis_com" {
  project = "${var.project-number}"
  service = "appengine.googleapis.com"
}
# terraform import google_project_service.appengine_googleapis_com ${var.project-number}/appengine.googleapis.com
