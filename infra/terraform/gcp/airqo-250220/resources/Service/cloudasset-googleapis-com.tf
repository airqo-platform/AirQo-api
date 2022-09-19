resource "google_project_service" "cloudasset_googleapis_com" {
  project = "702081712633"
  service = "cloudasset.googleapis.com"
}
# terraform import google_project_service.cloudasset_googleapis_com 702081712633/cloudasset.googleapis.com
