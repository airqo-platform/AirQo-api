resource "google_project_service" "iamcredentials_googleapis_com" {
  project = "702081712633"
  service = "iamcredentials.googleapis.com"
}
# terraform import google_project_service.iamcredentials_googleapis_com 702081712633/iamcredentials.googleapis.com
