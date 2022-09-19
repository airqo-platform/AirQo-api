resource "google_project_service" "realtime_googleapis_com" {
  project = "702081712633"
  service = "realtime.googleapis.com"
}
# terraform import google_project_service.realtime_googleapis_com 702081712633/realtime.googleapis.com
