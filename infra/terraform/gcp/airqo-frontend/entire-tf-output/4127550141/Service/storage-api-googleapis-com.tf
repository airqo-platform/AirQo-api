resource "google_project_service" "storage_api_googleapis_com" {
  project = "4127550141"
  service = "storage-api.googleapis.com"
}
# terraform import google_project_service.storage_api_googleapis_com 4127550141/storage-api.googleapis.com
