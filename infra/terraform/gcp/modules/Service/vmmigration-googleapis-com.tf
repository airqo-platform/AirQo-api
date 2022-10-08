resource "google_project_service" "vmmigration_googleapis_com" {
  project = "${var.project-number}"
  service = "vmmigration.googleapis.com"
}
# terraform import google_project_service.vmmigration_googleapis_com ${var.project-number}/vmmigration.googleapis.com
