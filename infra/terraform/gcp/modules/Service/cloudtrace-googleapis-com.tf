resource "google_project_service" "cloudtrace_googleapis_com" {
  project = var.project-number
  service = "cloudtrace.googleapis.com"
}
# terraform import google_project_service.cloudtrace_googleapis_com ${var.project-number}/cloudtrace.googleapis.com
