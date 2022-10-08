resource "google_project_service" "datastore_googleapis_com" {
  project = var.project-number
  service = "datastore.googleapis.com"
}
# terraform import google_project_service.datastore_googleapis_com ${var.project-number}/datastore.googleapis.com
