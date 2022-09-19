resource "google_project_service" "cloudbuild_googleapis_com" {
  project = "702081712633"
  service = "cloudbuild.googleapis.com"
}
# terraform import google_project_service.cloudbuild_googleapis_com 702081712633/cloudbuild.googleapis.com
