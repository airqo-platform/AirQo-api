resource "google_project_service" "containerregistry_googleapis_com" {
  project = "702081712633"
  service = "containerregistry.googleapis.com"
}
# terraform import google_project_service.containerregistry_googleapis_com 702081712633/containerregistry.googleapis.com
