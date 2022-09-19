resource "google_project_service" "geolocation_googleapis_com" {
  project = "702081712633"
  service = "geolocation.googleapis.com"
}
# terraform import google_project_service.geolocation_googleapis_com 702081712633/geolocation.googleapis.com
