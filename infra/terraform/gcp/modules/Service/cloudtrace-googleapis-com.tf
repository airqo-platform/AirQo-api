resource "google_project_service" "cloudtrace_googleapis_com" {
  project = "702081712633"
  service = "cloudtrace.googleapis.com"
}
# terraform import google_project_service.cloudtrace_googleapis_com 702081712633/cloudtrace.googleapis.com
