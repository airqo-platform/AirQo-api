resource "google_project_service" "storage_component_googleapis_com" {
  project = "${var.project-number}"
  service = "storage-component.googleapis.com"
}
# terraform import google_project_service.storage_component_googleapis_com ${var.project-number}/storage-component.googleapis.com
