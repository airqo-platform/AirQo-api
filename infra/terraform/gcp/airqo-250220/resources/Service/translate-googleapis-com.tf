resource "google_project_service" "translate_googleapis_com" {
  project = "702081712633"
  service = "translate.googleapis.com"
}
# terraform import google_project_service.translate_googleapis_com 702081712633/translate.googleapis.com
