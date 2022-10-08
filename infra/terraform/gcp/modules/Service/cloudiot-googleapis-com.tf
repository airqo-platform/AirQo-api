resource "google_project_service" "cloudiot_googleapis_com" {
  project = "${var.project-number}"
  service = "cloudiot.googleapis.com"
}
# terraform import google_project_service.cloudiot_googleapis_com ${var.project-number}/cloudiot.googleapis.com
