resource "google_project_service" "datastore_googleapis_com" {
  project = "702081712633"
  service = "datastore.googleapis.com"
}
# terraform import google_project_service.datastore_googleapis_com 702081712633/datastore.googleapis.com
