resource "google_project_service" "runtimeconfig_googleapis_com" {
  project = var.project-number
  service = "runtimeconfig.googleapis.com"
}
# terraform import google_project_service.runtimeconfig_googleapis_com ${var.project-number}/runtimeconfig.googleapis.com
