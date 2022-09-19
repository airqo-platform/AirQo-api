resource "google_project_service" "storage_api_googleapis_com" {
  project = "702081712633"
  service = "storage-api.googleapis.com"
}
# terraform import google_project_service.storage_api_googleapis_com 702081712633/storage-api.googleapis.com
