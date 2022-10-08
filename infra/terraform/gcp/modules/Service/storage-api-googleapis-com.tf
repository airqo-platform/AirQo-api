resource "google_project_service" "storage_api_googleapis_com" {
  project = var.project-number
  service = "storage-api.googleapis.com"
}
# terraform import google_project_service.storage_api_googleapis_com ${var.project-number}/storage-api.googleapis.com
