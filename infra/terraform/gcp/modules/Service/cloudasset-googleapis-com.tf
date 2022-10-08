resource "google_project_service" "cloudasset_googleapis_com" {
  project = "${var.project-number}"
  service = "cloudasset.googleapis.com"
}
# terraform import google_project_service.cloudasset_googleapis_com ${var.project-number}/cloudasset.googleapis.com
