resource "google_project_service" "dlp_googleapis_com" {
  project = "702081712633"
  service = "dlp.googleapis.com"
}
# terraform import google_project_service.dlp_googleapis_com 702081712633/dlp.googleapis.com
