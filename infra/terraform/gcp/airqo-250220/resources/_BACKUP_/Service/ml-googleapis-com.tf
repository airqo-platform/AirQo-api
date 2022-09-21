resource "google_project_service" "ml_googleapis_com" {
  project = "702081712633"
  service = "ml.googleapis.com"
}
# terraform import google_project_service.ml_googleapis_com 702081712633/ml.googleapis.com
