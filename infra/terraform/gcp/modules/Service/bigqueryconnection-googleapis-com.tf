resource "google_project_service" "bigqueryconnection_googleapis_com" {
  project = "${var.project-number}"
  service = "bigqueryconnection.googleapis.com"
}
# terraform import google_project_service.bigqueryconnection_googleapis_com ${var.project-number}/bigqueryconnection.googleapis.com
