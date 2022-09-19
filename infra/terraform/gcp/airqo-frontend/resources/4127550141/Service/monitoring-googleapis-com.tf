resource "google_project_service" "monitoring_googleapis_com" {
  project = "4127550141"
  service = "monitoring.googleapis.com"
}
# terraform import google_project_service.monitoring_googleapis_com 4127550141/monitoring.googleapis.com
