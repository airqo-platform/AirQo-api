resource "google_project_service" "language_googleapis_com" {
  project = "702081712633"
  service = "language.googleapis.com"
}
# terraform import google_project_service.language_googleapis_com 702081712633/language.googleapis.com
