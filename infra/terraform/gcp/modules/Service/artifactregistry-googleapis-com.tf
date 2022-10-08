resource "google_project_service" "artifactregistry_googleapis_com" {
  project = "702081712633"
  service = "artifactregistry.googleapis.com"
}
# terraform import google_project_service.artifactregistry_googleapis_com 702081712633/artifactregistry.googleapis.com
