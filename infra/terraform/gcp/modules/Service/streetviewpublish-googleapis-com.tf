resource "google_project_service" "streetviewpublish_googleapis_com" {
  project = var.project-number
  service = "streetviewpublish.googleapis.com"
}
# terraform import google_project_service.streetviewpublish_googleapis_com ${var.project-number}/streetviewpublish.googleapis.com
