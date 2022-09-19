resource "google_project_service" "securetoken_googleapis_com" {
  project = "702081712633"
  service = "securetoken.googleapis.com"
}
# terraform import google_project_service.securetoken_googleapis_com 702081712633/securetoken.googleapis.com
