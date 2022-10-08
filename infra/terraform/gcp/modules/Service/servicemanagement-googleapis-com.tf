resource "google_project_service" "servicemanagement_googleapis_com" {
  project = "${var.project-number}"
  service = "servicemanagement.googleapis.com"
}
# terraform import google_project_service.servicemanagement_googleapis_com ${var.project-number}/servicemanagement.googleapis.com
