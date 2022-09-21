resource "google_project_service" "earthengine_googleapis_com" {
  project = "702081712633"
  service = "earthengine.googleapis.com"
}
# terraform import google_project_service.earthengine_googleapis_com 702081712633/earthengine.googleapis.com
