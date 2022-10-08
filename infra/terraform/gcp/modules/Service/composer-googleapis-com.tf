resource "google_project_service" "composer_googleapis_com" {
  project = "702081712633"
  service = "composer.googleapis.com"
}
# terraform import google_project_service.composer_googleapis_com 702081712633/composer.googleapis.com
