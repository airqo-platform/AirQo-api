resource "google_project_service" "cloudtrace_googleapis_com" {
  project = "4127550141"
  service = "cloudtrace.googleapis.com"
}
# terraform import google_project_service.cloudtrace_googleapis_com 4127550141/cloudtrace.googleapis.com
