resource "google_project_service" "iamcredentials_googleapis_com" {
  project = "${var.project-number}"
  service = "iamcredentials.googleapis.com"
}
# terraform import google_project_service.iamcredentials_googleapis_com ${var.project-number}/iamcredentials.googleapis.com
