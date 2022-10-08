resource "google_project_service" "cloudfunctions_googleapis_com" {
  project = "${var.project-number}"
  service = "cloudfunctions.googleapis.com"
}
# terraform import google_project_service.cloudfunctions_googleapis_com ${var.project-number}/cloudfunctions.googleapis.com
