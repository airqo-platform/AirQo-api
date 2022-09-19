resource "google_project_service" "automl_googleapis_com" {
  project = "702081712633"
  service = "automl.googleapis.com"
}
# terraform import google_project_service.automl_googleapis_com 702081712633/automl.googleapis.com
