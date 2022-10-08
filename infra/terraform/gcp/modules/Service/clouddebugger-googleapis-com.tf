resource "google_project_service" "clouddebugger_googleapis_com" {
  project = var.project-number
  service = "clouddebugger.googleapis.com"
}
# terraform import google_project_service.clouddebugger_googleapis_com ${var.project-number}/clouddebugger.googleapis.com
