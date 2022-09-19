resource "google_project_service" "container_googleapis_com" {
  project = "702081712633"
  service = "container.googleapis.com"
}
# terraform import google_project_service.container_googleapis_com 702081712633/container.googleapis.com
