resource "google_project_service" "serviceusage_googleapis_com" {
  project = "${var.project-number}"
  service = "serviceusage.googleapis.com"
}
# terraform import google_project_service.serviceusage_googleapis_com ${var.project-number}/serviceusage.googleapis.com
