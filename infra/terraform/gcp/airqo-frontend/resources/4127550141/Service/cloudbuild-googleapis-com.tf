resource "google_project_service" "cloudbuild_googleapis_com" {
  project = "4127550141"
  service = "cloudbuild.googleapis.com"
}
# terraform import google_project_service.cloudbuild_googleapis_com 4127550141/cloudbuild.googleapis.com
