resource "google_project_service" "osconfig_googleapis_com" {
  project = var.project-number
  service = "osconfig.googleapis.com"
}
# terraform import google_project_service.osconfig_googleapis_com ${var.project-number}/osconfig.googleapis.com
