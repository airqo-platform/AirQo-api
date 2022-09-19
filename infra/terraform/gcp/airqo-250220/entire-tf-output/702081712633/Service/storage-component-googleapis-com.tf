resource "google_project_service" "storage_component_googleapis_com" {
  project = "702081712633"
  service = "storage-component.googleapis.com"
}
# terraform import google_project_service.storage_component_googleapis_com 702081712633/storage-component.googleapis.com
