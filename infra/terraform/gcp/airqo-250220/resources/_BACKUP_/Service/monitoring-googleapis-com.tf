resource "google_project_service" "monitoring_googleapis_com" {
  project = "702081712633"
  service = "monitoring.googleapis.com"
}
# terraform import google_project_service.monitoring_googleapis_com 702081712633/monitoring.googleapis.com
