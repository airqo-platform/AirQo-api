resource "google_project_service" "oslogin_googleapis_com" {
  project = "${var.project-number}"
  service = "oslogin.googleapis.com"
}
# terraform import google_project_service.oslogin_googleapis_com ${var.project-number}/oslogin.googleapis.com
